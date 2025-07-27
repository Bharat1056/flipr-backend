import { Request, Response } from "express"
import bcrypt from "bcryptjs"
import { ZodError } from "zod"
import asyncHandler from "../utils/asyncHandler"
import { registerAdminSchema, loginAdminSchema } from "../types/admin.types"
import { CONFIGS_KEYS } from "../utils/error"
import { BCRYPT_SALT_ROUNDS } from "../constants"
import prisma from "../utils/prisma"
import ApiError from "../utils/apiError"
import tokenService from "../utils/tokenService"
import ApiResponse from "../utils/apiResponse"

export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { fullName, username, email, password, confirmPassword } = req.body

        const validatedData = registerAdminSchema.parse({
            fullName,
            username,
            email,
            password,
            confirmPassword,
        })

        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: [
                    { username: validatedData.username },
                    { email: validatedData.email }
                ]
            }
        })

        if (existingAdmin) {
            throw new ApiError(CONFIGS_KEYS.ADMIN_ALREADY_EXISTS.statusCode, CONFIGS_KEYS.ADMIN_ALREADY_EXISTS.message)
        }
        const hashedPassword = await bcrypt.hash(validatedData.password, BCRYPT_SALT_ROUNDS)

        const admin = await prisma.admin.create({
            data: {
                fullName: validatedData.fullName,
                username: validatedData.username,
                email: validatedData.email,
                password: hashedPassword,
            }
        })

        if (!admin) {
            throw new ApiError(CONFIGS_KEYS.INTERNAL_SERVER_ERROR.statusCode, CONFIGS_KEYS.INTERNAL_SERVER_ERROR.message)
        }

        // Generate tokens
        const tokens = tokenService.generateToken({
            id: admin.id,
            email: admin.email,
            username: admin.username,
            role: 'ADMIN',
        })

        // Set cookies
        // tokenService.setAuthCookies(res, tokens)

        // Update admin with refresh token
        await prisma.admin.update({
            where: { id: admin.id },
            data: { refreshToken: tokens.refreshToken }
        })

        return res.status(201).json(
            new ApiResponse(201, {
                admin: {
                    id: admin.id,
                    fullName: admin.fullName,
                    username: admin.username,
                    email: admin.email,
                },
                expiresIn: tokens.expiresIn,
            }, "Admin registered successfully")
        )
    } catch (error: any) {
        console.log(error)
        // Handle Zod validation errors
        if (error instanceof ZodError) {
            const validationErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));
            
            return res.status(400).json(
                new ApiResponse(400, {
                    errors: validationErrors,
                    message: "Validation failed"
                }, "Please check your input data")
            );
        }

        // Handle Prisma unique constraint errors
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'field';
            return res.status(409).json(
                new ApiResponse(409, {
                    field,
                    message: `${field} already exists`
                }, "Duplicate entry found")
            );
        }

        // Handle Prisma other errors
        if (error.code?.startsWith('P')) {
            return res.status(500).json(
                new ApiResponse(500, {
                    message: "Database operation failed"
                }, "Internal server error")
            );
        }

        // Handle ApiError instances
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(
                new ApiResponse(error.statusCode, {
                    message: error.message
                }, error.message)
            );
        }

        // Handle bcrypt errors
        if (error.message?.includes('bcrypt')) {
            return res.status(500).json(
                new ApiResponse(500, {
                    message: "Password hashing failed"
                }, "Internal server error")
            );
        }

        // Handle JWT errors
        if (error.message?.includes('jwt') || error.message?.includes('token')) {
            return res.status(401).json(
                new ApiResponse(401, {
                    message: "Token generation failed"
                }, "Authentication error")
            );
        }

        // Handle network/database connection errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json(
                new ApiResponse(503, {
                    message: "Service temporarily unavailable"
                }, "Database connection failed")
            );
        }

        // Generic error handler
        console.error('Admin registration error:', error);
        return res.status(500).json(
            new ApiResponse(500, {
                message: "Something went wrong during registration"
            }, "Internal server error")
        );
    }
})

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body

        const validatedData = loginAdminSchema.parse({
            email,
            password,
        })

        const admin = await prisma.admin.findUnique({
            where: { email: validatedData.email }
        })

        if (!admin) {
            throw new ApiError(401, "Invalid credentials")
        }

        const isPasswordValid = await bcrypt.compare(validatedData.password, admin.password)

        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid credentials")
        }

        // Generate tokens
        const tokens = tokenService.generateToken({
            id: admin.id,
            email: admin.email,
            username: admin.username,
            role: 'ADMIN',
        })

        // Set cookies
        // tokenService.setAuthCookies(res, tokens)

        // Update admin with refresh token
        await prisma.admin.update({
            where: { id: admin.id },
            data: { refreshToken: tokens.refreshToken }
        })

        return res.status(200).json(
            new ApiResponse(200, {
                user: {
                    id: admin.id,
                    fullName: admin.fullName,
                    username: admin.username,
                    email: admin.email,
                    role: "ADMIN"
                },
                token: tokens.refreshToken,
                expiresIn: tokens.expiresIn,
            }, "Admin logged in successfully")
        )
    } catch (error: any) {
        // Handle Zod validation errors
        if (error instanceof ZodError) {
            const validationErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));
            
            return res.status(400).json(
                new ApiResponse(400, {
                    errors: validationErrors,
                    message: "Validation failed"
                }, "Please check your login credentials")
            );
        }

        // Handle ApiError instances
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(
                new ApiResponse(error.statusCode, {
                    message: error.message
                }, error.message)
            );
        }

        // Handle bcrypt errors
        if (error.message?.includes('bcrypt')) {
            return res.status(500).json(
                new ApiResponse(500, {
                    message: "Password verification failed"
                }, "Internal server error")
            );
        }

        // Handle JWT errors
        if (error.message?.includes('jwt') || error.message?.includes('token')) {
            return res.status(401).json(
                new ApiResponse(401, {
                    message: "Token generation failed"
                }, "Authentication error")
            );
        }

        // Handle Prisma errors
        if (error.code?.startsWith('P')) {
            return res.status(500).json(
                new ApiResponse(500, {
                    message: "Database operation failed"
                }, "Internal server error")
            );
        }

        // Generic error handler
        console.error('Admin login error:', error);
        return res.status(500).json(
            new ApiResponse(500, {
                message: "Something went wrong during login"
            }, "Internal server error")
        );
    }
})
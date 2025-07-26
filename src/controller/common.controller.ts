import { Response } from "express";
import bcrypt from "bcryptjs";
import asyncHandler from "../utils/asyncHandler";
import prisma from "../utils/prisma";
import ApiResponse from "../utils/apiResponse";
import tokenService from "../utils/tokenService";
import ApiError from "../utils/apiError";
import { BCRYPT_SALT_ROUNDS } from "../constants";
import { AuthenticatedRequest } from "../types/authentication.types";

export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id, role } = req.user!

        if (role === 'ADMIN') {
            await prisma.admin.update({
                where: { id },
                data: { refreshToken: null }
            })
        }

        if (role === 'STAFF') {
            await prisma.staff.update({
                where: { id },
                data: { refreshToken: null }
            })
        }

        tokenService.clearAuthCookies(res)

        return res.status(200).json(
            new ApiResponse(200, {}, "Logged out successfully")
        )
    } catch (error: any) {
        // Handle Prisma errors
        if (error.code?.startsWith('P')) {
            return res.status(500).json(
                new ApiResponse(500, {
                    message: "Failed to clear session"
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
        
    }
})

export const getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { role, ...user } = req.user!

        return res.status(200).json(
            new ApiResponse(200, { user }, "User retrieved successfully")
        )
    } catch (error: any) {
        // Handle Prisma errors
        if (error.code?.startsWith('P')) {
            return res.status(500).json(
                new ApiResponse(500, { message: "Failed to retrieve user" }, "Internal server error")
            );
        }
        
        // Handle ApiError instances
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(
                new ApiResponse(error.statusCode, { message: error.message }, error.message)
            );
        }
        
    }
})

export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id, role } = req.user!
        const { newPassword } = req.body

        if (role === 'ADMIN') {
            await prisma.admin.update({
                where: { id },
                data: { password: await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS) }
            })
        } else if (role === 'STAFF') {
            await prisma.staff.update({
                where: { id },
                data: { password: await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS) }
            })
        }

        return res.status(200).json(
            new ApiResponse(200, {}, "Password reset successfully")
        )
        
    } catch (error: any) {
        // Handle Prisma errors
        if (error.code?.startsWith('P')) {
            return res.status(500).json(
                new ApiResponse(500, { message: "Failed to retrieve user" }, "Internal server error")
            );
        }
        
        // Handle ApiError instances
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(
                new ApiResponse(error.statusCode, { message: error.message }, error.message)
            );
        }
    }
})
import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const registerUser = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { name, email, password, role = 'USER' } = req.body;

        if (!name || !email || !password) {
            throw new ApiError(400, 'All fields are required')
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            throw new ApiError(400, 'User already exists')
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role.toUpperCase()
            },
            select: { id: true, name: true, email: true, role: true }
        });

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        (req as any).session.userId = user.id;

        return res.status(201).json(new ApiResponse(201, {user , token},'User registered successfully'))
    } catch (error: any) {
        console.error('Error registering user:', error);
        throw new ApiError(500, error.message || 'Internal server error');
    }
})

const loginUser = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required');
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new ApiError(401, 'Invalid credentials');
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        // Set session
        (req as any).session.userId = user.id;
        (req as any).session.role = user.role;

        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        return res.status(200).json(
            new ApiResponse(200, {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }, 'Login successful')
        );
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Internal server error');
    }
});

const logOutUser = asyncHandler(async (req: Request, res: Response) => {
    try {
        
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        
        (req as any).session.destroy((err: any) => {
            if (err) {
                throw new ApiError(500, 'Could not log out, please try again');
            }

            return res.status(200).json(
                new ApiResponse(200, 'Logout successful')
            );
        });
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Internal server error');
    }
});
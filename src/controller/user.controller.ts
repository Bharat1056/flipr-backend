import prisma from "../utils/prisma";
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registerUser = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { name, email, password, role = 'ADMIN' } = req.body;

        if (!name || !email || !password) {
            throw new ApiError(400, 'All fields are required')
        }
        if (role.toUpperCase() !== 'ADMIN') {
            throw new ApiError(400, 'Only Admin registration allowed here');
        }

        const existingAdmin = await prisma.admin.findUnique({ where: { email } });
        if (existingAdmin) throw new ApiError(400, 'Admin already exists');

        const hashedPassword = await bcrypt.hash(password, 12);

        const admin = await prisma.admin.create({
            data: { name, email, password: hashedPassword },
            select: { id: true, name: true, email: true }
        });

        const token = jwt.sign(
            { userId: admin.id, role: 'ADMIN' },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '48h' }
        );

        (req as any).session.userId = admin.id;
        (req as any).session.role = 'ADMIN';

        return res.status(201).json(
            new ApiResponse(201, { user: { ...admin, role: 'ADMIN' }, token }, 'Admin registered successfully')
        );
    }
    catch (error: any) {
        console.error('Error registering user:', error);
        throw new ApiError(500, error.message || 'Internal server error');
    }
});

const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            throw new ApiError(400, 'Email, password, and role are required');
        }

        const userRole = role.toUpperCase();
        if (!['ADMIN', 'STAFF'].includes(userRole)) {
            throw new ApiError(400, 'Invalid role selected');
        }

        let user: any = null;

        if (userRole === 'ADMIN') {
            user = await prisma.admin.findUnique({ where: { email } });

            if (!user) throw new ApiError(404, 'You are not an admin');
            if (!(await bcrypt.compare(password, user.password))) {
                throw new ApiError(401, 'Incorrect password');
            }

            const token = jwt.sign(
                { userId: user.id, role: 'ADMIN' },
                process.env.JWT_SECRET || 'fallback-secret',
                { expiresIn: '24h' }
            );

            (req as any).session.userId = user.id;
            (req as any).session.role = 'ADMIN';

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000
            });

            return res.status(200).json(
                new ApiResponse(200, {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: 'ADMIN'
                    },
                    token
                }, 'Admin login successful')
            );
        }

        if (userRole === 'STAFF') {
            user = await prisma.staff.findUnique({
                where: { email },
                include: {
                    admin: { select: { id: true, name: true, email: true } },
                    assignedCategories: { include: { category: true } }
                }
            });

            if (!user) throw new ApiError(404, 'You are not a staff member');
            if (!(await bcrypt.compare(password, user.password))) {
                throw new ApiError(401, 'Incorrect password');
            }
            if (!user.adminId || !user.admin) {
                throw new ApiError(403, 'Staff is not assigned to any Admin');
            }

            const token = jwt.sign(
                { userId: user.id, role: 'STAFF' },
                process.env.JWT_SECRET || 'fallback-secret',
                { expiresIn: '24h' }
            );

            (req as any).session.userId = user.id;
            (req as any).session.role = 'STAFF';

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000
            });

            return res.status(200).json(
                new ApiResponse(200, {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: 'STAFF',
                        admin: user.admin,
                        // categories: user.assignedCategories.map(a => a.category)
                    },
                    token
                }, 'Staff login successful')
            );
        }
    } catch (error: any) {
        next(error);
        throw new ApiError(500, error.message || 'Internal server error');
    }
};



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

export {
    registerUser,
    loginUser,
    logOutUser
}
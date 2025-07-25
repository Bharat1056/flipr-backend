import asyncHandler from "../utils/asyncHandler";
import prisma from "../utils/prisma";
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/apiError";
import { User } from "@prisma/client";

const jwt = require('jsonwebtoken');

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'email' | 'role' | 'name'>;
    }
  }
}

const authenticateToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new ApiError(401, 'Authentication token is required');    
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, role: true, name: true }
        });

        if (!user) {
            throw new ApiError(401, 'Invalid Token')
        }

        req.user = user;
        next();
    } catch (error: any) {
        throw new ApiError(401, error.message || 'Unauthorized');
    }
})

const authorizeRoles = (...roles : String[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Access denied: insufficient permissions');
    }
    next();
  };
};
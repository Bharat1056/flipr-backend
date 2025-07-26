
import asyncHandler from "../utils/asyncHandler";
import prisma from "../utils/prisma";
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/apiError";
const jwt = require('jsonwebtoken');

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: "ADMIN" | "STAFF";
        adminId?: string;
      };
    }
  }
}

const authenticateToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) throw new ApiError(401, 'Authentication token is required');

  const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

  if (!decoded?.role || !decoded?.userId) {
    throw new ApiError(400, "Invalid token payload");
  }

  if (decoded.role === "ADMIN") {
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    });

    if (!admin) throw new ApiError(403, "You are not an admin");

    req.user = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
    };

  } else if (decoded.role === "STAFF") {
    const staff = await prisma.staff.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, adminId: true }
    });

    if (!staff || !staff.adminId) {
      throw new ApiError(403, "You are not a valid staff or not linked to any admin");
    }

    req.user = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: "STAFF",
      adminId: staff.adminId,
    };

  } else {
    throw new ApiError(400, "Invalid role");
  }

  next();
});

const authorizeRoles = (...roles: ("ADMIN" | "STAFF")[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Access denied: insufficient permissions');
    }
    next();
  };
};

export { authenticateToken, authorizeRoles };


import asyncHandler from "../utils/asyncHandler";
import prisma from "../utils/prisma";
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/apiError";
import tokenService from "../utils/tokenService";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        role: "ADMIN" | "STAFF";
        adminId?: string;
      };
    }
  }
}

const authenticateToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = tokenService.extractToken(req);

    if (!token) {
      throw new ApiError(401, 'Authentication token is required');
    }

    const decoded = tokenService.verifyRefreshToken(token);

    if (!decoded?.id || !decoded?.role) {
      throw new ApiError(400, "Invalid token payload");
    }

    if (decoded.role === "ADMIN") {
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: { 
          id: true, 
          email: true, 
          username: true,
          fullName: true 
        }
      });

      if (!admin) {
        throw new ApiError(403, "Admin not found");
      }

      req.user = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: "ADMIN",
      };

    } else if (decoded.role === "STAFF") {
      const staff = await prisma.staff.findUnique({
        where: { id: decoded.id },
        select: { 
          id: true, 
          email: true, 
          username: true,
          fullName: true,
          adminId: true 
        }
      });

      if (!staff || !staff.adminId) {
        throw new ApiError(403, "Staff not found or not linked to any admin");
      }

      req.user = {
        id: staff.id,
        username: staff.username,
        email: staff.email,
        role: "STAFF",
        adminId: staff.adminId,
      };

    } else {
      throw new ApiError(400, "Invalid role");
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'Invalid or expired token');
  }
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

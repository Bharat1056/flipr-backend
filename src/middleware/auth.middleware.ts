import { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import prisma from "../utils/prisma";
import tokenService from "../utils/tokenService";
import ApiError from "../utils/apiError";
import { AuthenticatedRequest } from "../types/authentication.types";

const authenticateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      });

      if (!admin) {
        throw new ApiError(403, "Admin not found");
      }

      req.user = {
        ...admin,
        role: "ADMIN",
      }

    } else if (decoded.role === "STAFF") {
      const staff = await prisma.staff.findUnique({
        where: { id: decoded.id },
      });

      if (!staff || !staff.adminId) {
        throw new ApiError(403, "Staff not found or not linked to any admin");
      }

      req.user = { ...staff, role: "STAFF" };

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
    const request = req as AuthenticatedRequest
    if (!request.user || !roles.includes(request.user.role)) {
      throw new ApiError(403, 'Access denied: insufficient permissions');
    }
    next();
  };
};

export { authenticateToken, authorizeRoles };

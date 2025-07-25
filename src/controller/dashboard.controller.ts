import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

// Admin Dashboard
const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
    try {
        const [
            totalProducts,
            totalCategories,
            totalUsers,
            lowStockProducts,
            recentLogs
        ] = await Promise.all([
            prisma.product.count(),
            prisma.category.count(),
            prisma.user.count(),
            prisma.product.findMany({
                where: {
                    stock: { lte: prisma.product.fields.alertThreshold }
                },
                select: { id: true, name: true, stock: true, alertThreshold: true }
            }),
            prisma.inventoryLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true } },
                    user: { select: { name: true } }
                }
            })
        ]);

        return res.status(200).json(new ApiResponse(200, {
            stats: {
                totalProducts,
                totalCategories,
                totalUsers,
                lowStockCount: lowStockProducts.length
            },
            lowStockProducts,
            recentLogs
        }, 'Admin dashboard data fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch admin dashboard');
    }
});

// Staff Dashboard
const getStaffDashboard = asyncHandler(async (req: Request, res: Response) => {
    try {
        const [
            totalProducts,
            lowStockProducts,
            recentLogs
        ] = await Promise.all([
            prisma.product.count(),
            prisma.product.findMany({
                where: {
                    stock: { lte: prisma.product.fields.alertThreshold }
                },
                select: { id: true, name: true, stock: true, alertThreshold: true }
            }),
            prisma.inventoryLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true } },
                    user: { select: { name: true } }
                }
            })
        ]);

        return res.status(200).json(new ApiResponse(200,{
            stats: {
                totalProducts,
                lowStockCount: lowStockProducts.length
            },
            lowStockProducts,
            recentLogs
        }, 'Staff dashboard data fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch staff dashboard');
    }
});

// User Dashboard
const getUserDashboard = asyncHandler(async (req: Request, res: Response) => {
    try {
        const [
            availableProducts,
            userPurchases
        ] = await Promise.all([
            prisma.product.count({
                where: { stock: { gt: 0 } }
            }),
            prisma.inventoryLog.findMany({
                where: { 
                    userId: req.user.id,
                    action: 'REMOVE',
                    note: { contains: 'Purchase' }
                },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true, imageUrl: true } }
                }
            })
        ]);

        return res.status(200).json(new ApiResponse(200,{
            stats: {
                availableProducts
            },
            recentPurchases: userPurchases
        }, 'User dashboard data fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch user dashboard');
    }
});
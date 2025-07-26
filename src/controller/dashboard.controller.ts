import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

// Admin Dashboard
const getAdminDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        const [
            totalProducts,
            totalCategories,
            totalStaff,
            lowStockProducts,
            recentLogs
        ] = await Promise.all([
            // Count products in admin's categories only
            prisma.product.count({
                where: {
                    category: {
                        adminId: user.id
                    }
                }
            }),
            // Count admin's categories
            prisma.category.count({
                where: { adminId: user.id }
            }),
            // Count staff under this admin
            prisma.staff.count({
                where: { adminId: user.id }
            }),
            // Get low stock products in admin's categories
            prisma.$queryRaw`
                SELECT p.id, p.name, p.stock, p."alertThreshold", c.name as categoryName
                FROM "Product" p
                JOIN "Category" c ON p."categoryId" = c.id
                WHERE c."adminId" = ${user.id} AND p.stock <= p."alertThreshold"
                ORDER BY p.stock ASC
                LIMIT 10
            `,
            // Get recent logs for admin's products
            prisma.inventoryLog.findMany({
                where: {
                    OR: [
                        { adminId: user.id },
                        {
                            product: {
                                category: {
                                    adminId: user.id
                                }
                            }
                        }
                    ]
                },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true } },
                    admin: { select: { name: true } },
                    staff: { select: { name: true } }
                }
            })
        ]);

        res.status(200).json(new ApiResponse(200, {
            stats: {
                totalProducts,
                totalCategories,
                totalStaff,
                lowStockCount: (lowStockProducts as any[]).length
            },
            lowStockProducts,
            recentLogs
        }, 'Admin dashboard data fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch admin dashboard');
    }
});

// Staff Dashboard
const getStaffDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        // Get staff's assigned categories
        const assignedCategories = await prisma.userCategory.findMany({
            where: { staffId: user.id },
            select: { categoryId: true }
        });

        if (assignedCategories.length === 0) {
            res.status(200).json(new ApiResponse(200, {
                stats: {
                    totalProducts: 0,
                    lowStockCount: 0
                },
                lowStockProducts: [],
                recentLogs: []
            }, 'No assigned categories found'));
            return;
        }

        const categoryIds = assignedCategories.map((cat: { categoryId: string }) => cat.categoryId);

        const [
            totalProducts,
            lowStockProducts,
            recentLogs
        ] = await Promise.all([
            // Count products in assigned categories
            prisma.product.count({
                where: {
                    categoryId: { in: categoryIds }
                }
            }),
            // Get low stock products in assigned categories
            prisma.$queryRaw`
                SELECT p.id, p.name, p.stock, p."alertThreshold", c.name as categoryName
                FROM "Product" p
                JOIN "Category" c ON p."categoryId" = c.id
                WHERE p."categoryId" = ANY(${categoryIds}) AND p.stock <= p."alertThreshold"
                ORDER BY p.stock ASC
                LIMIT 10
            `,
            // Get recent logs for staff's assigned products
            prisma.inventoryLog.findMany({
                where: {
                    OR: [
                        { staffId: user.id },
                        {
                            product: {
                                categoryId: { in: categoryIds }
                            }
                        }
                    ]
                },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true } },
                    admin: { select: { name: true } },
                    staff: { select: { name: true } }
                }
            })
        ]);

        res.status(200).json(new ApiResponse(200, {
            stats: {
                totalProducts,
                lowStockCount: (lowStockProducts as any[]).length
            },
            lowStockProducts,
            recentLogs
        }, 'Staff dashboard data fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch staff dashboard');
    }
});

// User Dashboard (if you have regular users who can purchase)
const getUserDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        const [
            availableProducts,
            userPurchases
        ] = await Promise.all([
            // Count products with stock > 0
            prisma.product.count({
                where: { stock: { gt: 0 } }
            }),
            // Get user's purchase history (if you track purchases)
            prisma.inventoryLog.findMany({
                where: { 
                    OR: [
                        { adminId: user.id },
                        { staffId: user.id }
                    ],
                    actionType: 'REMOVE',
                    reason: { contains: 'Purchase' }
                },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { name: true, imageUrl: true } }
                }
            })
        ]);

        res.status(200).json(new ApiResponse(200, {
            stats: {
                availableProducts
            },
            recentPurchases: userPurchases
        }, 'User dashboard data fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch user dashboard');
    }
});

// Get inventory alerts (for both Admin and Staff)
const getInventoryAlerts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        let whereCondition: any = {};

        if (user.role === 'ADMIN') {
            whereCondition = {
                category: {
                    adminId: user.id
                }
            };
        } else if (user.role === 'STAFF') {
            // Get staff's assigned categories
            const assignedCategories = await prisma.userCategory.findMany({
                where: { staffId: user.id },
                select: { categoryId: true }
            });

            if (assignedCategories.length === 0) {
                res.status(200).json(new ApiResponse(200, [], 'No accessible categories'));
                return;
            }

            whereCondition = {
                categoryId: {
                    in: assignedCategories.map((cat: { categoryId: string }) => cat.categoryId)
                }
            };
        }

        // Get products where stock <= alertThreshold
        const alertProducts = await prisma.product.findMany({
            where: {
                ...whereCondition,
                stock: { lte: 10 } // You can make this dynamic or use a raw query for exact comparison
            },
            include: {
                category: { select: { name: true } }
            },
            orderBy: { stock: 'asc' }
        });

        res.status(200).json(new ApiResponse(200, alertProducts, 'Inventory alerts fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch inventory alerts');
    }
});

// Get recent activity (logs)
const getRecentActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { limit = 20 } = req.query;

        let whereCondition: any = {};

        if (user.role === 'ADMIN') {
            whereCondition = {
                OR: [
                    { adminId: user.id },
                    {
                        product: {
                            category: {
                                adminId: user.id
                            }
                        }
                    }
                ]
            };
        } else if (user.role === 'STAFF') {
            whereCondition = {
                OR: [
                    { staffId: user.id },
                    {
                        product: {
                            category: {
                                assignedStaffs: {
                                    some: {
                                        staffId: user.id
                                    }
                                }
                            }
                        }
                    }
                ]
            };
        }

        const recentLogs = await prisma.inventoryLog.findMany({
            where: whereCondition,
            take: parseInt(limit as string, 10),
            orderBy: { createdAt: 'desc' },
            include: {
                product: { select: { name: true, sku: true } },
                admin: { select: { name: true } },
                staff: { select: { name: true } }
            }
        });

        res.status(200).json(new ApiResponse(200, recentLogs, 'Recent activity fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch recent activity');
    }
});

export {
    getAdminDashboard,
    getStaffDashboard,
    getUserDashboard,
    getInventoryAlerts,
    getRecentActivity
};
import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

// Update inventory (Admin and Staff)
const updateInventory = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { productId, quantity, action, reason, warehouseId } = req.body;
        const user = (req as any).user;

        if (!productId || !quantity || !action || !warehouseId) {
            throw new ApiError(400, 'Product ID, quantity, action, and warehouse ID are required');
        }

        // Validate action type
        if (!['ADD', 'REMOVE', 'TRANSFER'].includes(action)) {
            throw new ApiError(400, 'Invalid action type. Must be ADD, REMOVE, or TRANSFER');
        }

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { category: true }
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        // Check if staff has access to this product's category
        if (user.role === 'STAFF') {
            const hasAccess = await prisma.userCategory.findFirst({
                where: {
                    staffId: user.id,
                    categoryId: product.categoryId
                }
            });

            if (!hasAccess) {
                throw new ApiError(403, 'You do not have access to this product category');
            }
        }

        let newStock = product.stock;
        const oldStock = product.stock;
        
        switch (action) {
            case 'ADD':
                newStock += quantity;
                break;
            case 'REMOVE':
                if (product.stock < quantity) {
                    throw new ApiError(400, 'Insufficient stock for removal');
                }
                newStock = product.stock - quantity;
                break;
            case 'TRANSFER':
                // For transfer, we'll handle source removal here
                // Transfer destination would be handled in a separate call
                if (product.stock < quantity) {
                    throw new ApiError(400, 'Insufficient stock for transfer');
                }
                newStock = product.stock - quantity;
                break;
        }

        const [updatedProduct, inventoryLog] = await prisma.$transaction([
            prisma.product.update({
                where: { id: productId },
                data: { stock: newStock }
            }),
            prisma.inventoryLog.create({
                data: {
                    warehouseId,
                    adminId: user.role === 'ADMIN' ? user.id : null,
                    staffId: user.role === 'STAFF' ? user.id : null,
                    actionType: action,
                    entity: 'Product',
                    entityId: productId,
                    oldValue: oldStock.toString(),
                    newValue: newStock.toString(),
                    reason: reason || `${action} operation by ${user.name}`,
                    ipAddress: req.ip,
                    productId
                }
            })
        ]);

        return res.status(200).json(new ApiResponse(200, {
            product: updatedProduct,
            log: inventoryLog
        }, 'Inventory updated successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to update inventory');
    }
});

// Purchase product (User only) - This might be for customers, not admin/staff
const purchaseProduct = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { quantity = 1, warehouseId } = req.body;
        const productId = req.params.id;
        const user = (req as any).user;

        if (!warehouseId) {
            throw new ApiError(400, 'Warehouse ID is required');
        }

        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        if (product.stock < quantity) {
            throw new ApiError(400, 'Insufficient stock');
        }

        const [updatedProduct, purchaseLog] = await prisma.$transaction([
            prisma.product.update({
                where: { id: productId },
                data: { stock: product.stock - quantity }
            }),
            prisma.inventoryLog.create({
                data: {
                    warehouseId,
                    adminId: user.role === 'ADMIN' ? user.id : null,
                    staffId: user.role === 'STAFF' ? user.id : null,
                    actionType: 'REMOVE',
                    entity: 'Product',
                    entityId: productId,
                    oldValue: product.stock.toString(),
                    newValue: (product.stock - quantity).toString(),
                    reason: `Purchase by ${user.name}`,
                    ipAddress: req.ip,
                    productId
                }
            })
        ]);

        return res.status(200).json(new ApiResponse(200, {
            product: updatedProduct,
            purchaseLog
        }, 'Purchase successful'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Purchase failed');
    }
});

interface InventoryLogWhereInput {
    productId?: string | { in: string[] };
    adminId?: string;
    staffId?: string;
    warehouseId?: string;
    actionType?: string;
}

const getInventoryLogs = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, productId, warehouseId, actionType } = req.query;
        const user = (req as any).user;
        
        const where: InventoryLogWhereInput = {};
        
        if (productId) {
            where.productId = productId as string;
        }
        
        if (warehouseId) {
            where.warehouseId = warehouseId as string;
        }

        if (actionType) {
            where.actionType = actionType as string;
        }

        // If staff, only show logs for products in their assigned categories
        if (user.role === 'STAFF') {
            // Get staff's assigned categories
            const assignedCategories = await prisma.userCategory.findMany({
                where: { staffId: user.id },
                select: { categoryId: true }
            });

            if (assignedCategories.length === 0) {
                return res.status(200).json(new ApiResponse(200, {
                    logs: [],
                    pagination: { page: 1, limit: 20, total: 0, pages: 0 }
                }, 'No logs found'));
            }

            // Get products in assigned categories
            const allowedProducts = await prisma.product.findMany({
                where: {
                    categoryId: {
                        in: assignedCategories.map(cat => cat.categoryId)
                    }
                },
                select: { id: true }
            });

            if (allowedProducts.length > 0) {
                where.productId = {
                    in: allowedProducts.map(p => p.id)
                };
            } else {
                return res.status(200).json(new ApiResponse(200, {
                    logs: [],
                    pagination: { page: 1, limit: 20, total: 0, pages: 0 }
                }, 'No logs found'));
            }
        }

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const logs = await prisma.inventoryLog.findMany({
            where,
            include: {
                product: { select: { name: true, sku: true } },
                admin: { select: { name: true, email: true } },
                staff: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
        });

        const total = await prisma.inventoryLog.count({ where });

        return res.status(200).json(new ApiResponse(200, {
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        }, 'Inventory logs fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch logs');
    }
});

// Get products accessible to current user
const getAccessibleProducts = asyncHandler(async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { page = 1, limit = 20, categoryId } = req.query;

        interface ProductWhereInput {
            categoryId?: string | { in: string[] };
        }

        const where: ProductWhereInput = {};

        if (user.role === 'STAFF') {
            // Get staff's assigned categories
            const assignedCategories = await prisma.userCategory.findMany({
                where: { staffId: user.id },
                select: { categoryId: true }
            });

            if (assignedCategories.length === 0) {
                return res.status(200).json(new ApiResponse(200, {
                    products: [],
                    pagination: { page: 1, limit: 20, total: 0, pages: 0 }
                }, 'No accessible products found'));
            }

            where.categoryId = {
                in: assignedCategories.map(cat => cat.categoryId)
            };
        }

        if (categoryId) {
            if (user.role === 'STAFF') {
                // Verify staff has access to this category
                const hasAccess = await prisma.userCategory.findFirst({
                    where: {
                        staffId: user.id,
                        categoryId: categoryId as string
                    }
                });

                if (!hasAccess) {
                    throw new ApiError(403, 'You do not have access to this category');
                }
            }
            where.categoryId = categoryId as string;
        }

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const products = await prisma.product.findMany({
            where,
            include: {
                category: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
        });

        const total = await prisma.product.count({ where });

        return res.status(200).json(new ApiResponse(200, {
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        }, 'Products fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch products');
    }
});

export {
    updateInventory,
    purchaseProduct,
    getInventoryLogs,
    getAccessibleProducts
}
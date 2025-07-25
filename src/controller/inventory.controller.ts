import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

// Update inventory (Admin and Staff)
const updateInventory = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { productId, quantity, action, note } = req.body;

        if (!productId || !quantity || !action) {
            throw new ApiError(400, 'Product ID, quantity, and action are required');
        }

        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        let newStock = product.stock;
        
        switch (action) {
            case 'ADD':
                newStock += quantity;
                break;
            case 'REMOVE':
                newStock = Math.max(0, newStock - quantity);
                break;
            case 'TRANSFER':
                // Handle transfer logic
                break;
        }

        const [updatedProduct, inventoryLog] = await prisma.$transaction([
            prisma.product.update({
                where: { id: productId },
                data: { stock: newStock }
            }),
            prisma.inventoryLog.create({
                data: {
                    productId,
                    userId: req.user.id,
                    quantity,
                    action,
                    note
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

// Purchase product (User only)
const purchaseProduct = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { quantity = 1 } = req.body;
        const productId = req.params.id;

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
                    productId,
                    userId: req.user.id,
                    quantity: -quantity,
                    action: 'REMOVE',
                    note: `Purchase by ${req.user.name}`
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

// Get inventory logs (Admin and Staff)
const getInventoryLogs = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, productId, userId } = req.query;
        
        const where = {};
        if (productId) where.productId = productId as string;
        if (userId) where.userId = userId as string;

        const logs = await prisma.inventoryLog.findMany({
            where,
            include: {
                product: { select: { name: true, sku: true } },
                user: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * parseInt(limit as string),
            take: parseInt(limit as string)
        });

        const total = await prisma.inventoryLog.count({ where });

        return res.status(200).json(new ApiResponse(200, {
            logs,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        }, 'Inventory logs fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch logs');
    }
});
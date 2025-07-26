import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

interface ProductWhereInput {
    categoryId?: string | { in: string[] };
    OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        sku?: { contains: string; mode: 'insensitive' };
    }>;
    stock?: { gt: number };
}

const getProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, search, page = 1, limit = 10 } = req.query;
        const user = (req as any).user;

        const where: ProductWhereInput = {};

        // Role-based access control
        if (user.role === 'STAFF') {
            // Get staff's assigned categories
            const assignedCategories = await prisma.userCategory.findMany({
                where: { staffId: user.id },
                select: { categoryId: true }
            });

            if (assignedCategories.length === 0) {
                res.status(200).json(new ApiResponse(200, {
                    products: [],
                    pagination: { page: 1, limit: 10, total: 0, pages: 0 }
                }, 'No accessible products found'));
                return;
            }

            where.categoryId = {
                in: assignedCategories.map((cat: { categoryId: string }) => cat.categoryId)
            };
        }

        if (category) {
            if (user.role === 'STAFF') {
                // Verify staff has access to this category
                const hasAccess = await prisma.userCategory.findFirst({
                    where: {
                        staffId: user.id,
                        categoryId: category as string
                    }
                });

                if (!hasAccess) {
                    throw new ApiError(403, 'You do not have access to this category');
                }
            }
            where.categoryId = category as string;
        }

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { sku: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        // Show only in-stock products for regular users (if you have USER role)
        if (user.role === 'USER') {
            where.stock = { gt: 0 };
        }

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        const products = await prisma.product.findMany({
            where,
            include: {
                category: true,
                logs: user.role !== 'USER' ? {
                    include: { 
                        admin: { select: { name: true } },
                        staff: { select: { name: true } }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                } : false
            },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
        });

        const total = await prisma.product.count({ where });

        res.status(200).json(new ApiResponse(200, {
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

// Get single product
const getProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        // First check if product exists
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: { category: true }
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        // Check staff access to category
        if (user.role === 'STAFF') {
            const hasAccess = await prisma.userCategory.findFirst({
                where: {
                    staffId: user.id,
                    categoryId: product.categoryId
                }
            });

            if (!hasAccess) {
                throw new ApiError(403, 'You do not have access to this product');
            }
        }

        // Get product with logs if admin/staff
        const productWithLogs = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: {
                category: true,
                logs: user.role !== 'USER' ? {
                    include: { 
                        admin: { select: { name: true } },
                        staff: { select: { name: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                } : false
            }
        });

        if (user.role === 'USER' && product.stock <= 0) {
            throw new ApiError(404, 'Product not available');
        }

        res.status(200).json(new ApiResponse(200, productWithLogs, 'Product fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch product');
    }
});

// Create product (Admin only)
const createProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, sku, imageUrl, stock, alertThreshold, categoryId } = req.body;
        const user = (req as any).user;

        if (!name || !sku || !categoryId) {
            throw new ApiError(400, 'Name, SKU, and category are required');
        }

        // Verify category exists and belongs to admin
        const category = await prisma.category.findFirst({
            where: { 
                id: categoryId,
                adminId: user.id
            }
        });

        if (!category) {
            throw new ApiError(404, 'Category not found or you do not have access to it');
        }

        const product = await prisma.product.create({
            data: {
                name,
                sku,
                imageUrl,
                stock: stock || 0,
                alertThreshold: alertThreshold || 10,
                categoryId
            },
            include: { category: true }
        });

        // Log the creation
        await prisma.inventoryLog.create({
            data: {
                warehouseId: 'default', // You can make this dynamic based on your needs
                adminId: user.id,
                actionType: 'ADD',
                entity: 'Product',
                entityId: product.id,
                oldValue: '0',
                newValue: stock?.toString() || '0',
                reason: `Product created by ${user.name}`,
                ipAddress: req.ip,
                productId: product.id
            }
        });

        res.status(201).json(new ApiResponse(201, product, 'Product created successfully'));
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new ApiError(400, 'SKU already exists');
        }
        throw new ApiError(500, error.message || 'Failed to create product');
    }
});

// Update product (Admin only)
const updateProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, sku, imageUrl, stock, alertThreshold, categoryId } = req.body;
        const user = (req as any).user;

        // Get current product
        const currentProduct = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: { category: true }
        });

        if (!currentProduct) {
            throw new ApiError(404, 'Product not found');
        }

        // Verify admin owns the current category
        const currentCategory = await prisma.category.findFirst({
            where: { 
                id: currentProduct.categoryId,
                adminId: user.id
            }
        });

        if (!currentCategory) {
            throw new ApiError(403, 'You do not have access to this product');
        }

        // If changing category, verify new category belongs to admin
        if (categoryId && categoryId !== currentProduct.categoryId) {
            const newCategory = await prisma.category.findFirst({
                where: { 
                    id: categoryId,
                    adminId: user.id
                }
            });

            if (!newCategory) {
                throw new ApiError(404, 'New category not found or you do not have access to it');
            }
        }

        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: {
                name,
                sku,
                imageUrl,
                stock,
                alertThreshold,
                categoryId
            },
            include: { category: true }
        });

        // Log stock changes if any
        if (stock !== undefined && stock !== currentProduct.stock) {
            await prisma.inventoryLog.create({
                data: {
                    warehouseId: 'default', // You can make this dynamic based on your needs
                    adminId: user.id,
                    actionType: stock > currentProduct.stock ? 'ADD' : 'REMOVE',
                    entity: 'Product',
                    entityId: product.id,
                    oldValue: currentProduct.stock.toString(),
                    newValue: stock.toString(),
                    reason: `Product updated by ${user.name}`,
                    ipAddress: req.ip,
                    productId: product.id
                }
            });
        }

        res.status(200).json(new ApiResponse(200, product, 'Product updated successfully'));
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new ApiError(400, 'SKU already exists');
        }
        throw new ApiError(500, error.message || 'Failed to update product');
    }
});

// Delete product (Admin only)
const deleteProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        // Get current product
        const currentProduct = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: { category: true }
        });

        if (!currentProduct) {
            throw new ApiError(404, 'Product not found');
        }

        // Verify admin owns the category
        const category = await prisma.category.findFirst({
            where: { 
                id: currentProduct.categoryId,
                adminId: user.id
            }
        });

        if (!category) {
            throw new ApiError(403, 'You do not have access to this product');
        }

        // Log the deletion before deleting
        await prisma.inventoryLog.create({
            data: {
                warehouseId: 'default', // You can make this dynamic based on your needs
                adminId: user.id,
                actionType: 'REMOVE',
                entity: 'Product',
                entityId: currentProduct.id,
                oldValue: currentProduct.stock.toString(),
                newValue: '0',
                reason: `Product deleted by ${user.name}`,
                ipAddress: req.ip,
                productId: currentProduct.id
            }
        });

        await prisma.product.delete({
            where: { id: req.params.id }
        });

        res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to delete product');
    }
});

// Get low stock products (Admin and Staff)
const getLowStockProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { page = 1, limit = 10 } = req.query;

        const where: ProductWhereInput = {};

        // Role-based access control
        if (user.role === 'STAFF') {
            const assignedCategories = await prisma.userCategory.findMany({
                where: { staffId: user.id },
                select: { categoryId: true }
            });

            if (assignedCategories.length === 0) {
                res.status(200).json(new ApiResponse(200, {
                    products: [],
                    pagination: { page: 1, limit: 10, total: 0, pages: 0 }
                }, 'No accessible products found'));
                return;
            }

            where.categoryId = {
                in: assignedCategories.map((cat: { categoryId: string }) => cat.categoryId)
            };
        }

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        // Get products where stock <= alertThreshold
        const products = await prisma.product.findMany({
            where: {
                ...where,
                OR: [
                    { stock: { lte: prisma.product.fields.alertThreshold } }
                ]
            },
            include: {
                category: true
            },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { stock: 'asc' }
        });

        const total = await prisma.product.count({
            where: {
                ...where,
                OR: [
                    { stock: { lte: prisma.product.fields.alertThreshold } }
                ]
            }
        });

        res.status(200).json(new ApiResponse(200, {
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        }, 'Low stock products fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch low stock products');
    }
});

export {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts
};
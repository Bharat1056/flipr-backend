import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

// Get all products
const getProducts = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { category, search, page = 1, limit = 10 } = req.query;
        
        const where = {};
        if (category) where.categoryId = category;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (req.user.role === 'USER') {
            where.stock = { gt: 0 };
        }

        const products = await prisma.product.findMany({
            where,
            include: {
                category: true,
                logs: req.user.role !== 'USER' ? {
                    include: { user: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                } : false
            },
            skip: (page - 1) * limit,
            take: parseInt(limit as string)
        });

        const total = await prisma.product.count({ where });

        return res.status(200).json(new ApiResponse(200, {
            products,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        } ,'Products fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch products');
    }
});

// Get single product
const getProduct = asyncHandler(async (req: Request, res: Response) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: {
                category: true,
                logs: req.user.role !== 'USER' ? {
                    include: { user: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' }
                } : false
            }
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        if (req.user.role === 'USER' && product.stock <= 0) {
            throw new ApiError(404, 'Product not available');
        }

        return res.status(200).json(new ApiResponse(200, product, 'Product fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch product');
    }
});

// Create product (Admin only)
const createProduct = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { name, sku, imageUrl, stock, alertThreshold, categoryId } = req.body;

        if (!name || !sku || !categoryId) {
            throw new ApiError(400, 'Name, SKU, and category are required');
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

        return res.status(201).json(new ApiResponse(201, product, 'Product created successfully'));
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new ApiError(400, 'SKU already exists');
        }
        throw new ApiError(500, error.message || 'Failed to create product');
    }
});

// Update product (Admin only)
const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { name, sku, imageUrl, stock, alertThreshold, categoryId } = req.body;

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

        return res.status(200).json(new ApiResponse(200, product,'Product updated successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to update product');
    }
});

// Delete product (Admin only)
const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    try {
        await prisma.product.delete({
            where: { id: req.params.id }
        });
        return res.status(200).json(new ApiResponse(200, 'Product deleted successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to delete product');
    }
});
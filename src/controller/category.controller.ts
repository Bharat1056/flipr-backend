import prisma from "../utils/prisma";
import { Request, Response } from "express";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";

// Get all categories
const getCategories = asyncHandler(async (req: Request, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            include: {
                products: (req as any).user.role !== 'USER' ? true : { select: { id: true, name: true, stock: true } }
            }
        });
        return res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to fetch categories');
    }
});

const createCategory = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            throw new ApiError(400, 'Category name is required');
        }

        const category = await prisma.category.create({
            data: { name, description }
        });

        return res.status(201).json(new ApiResponse(201,category, 'Category created successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to create category');
    }
});

const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        
        const category = await prisma.category.update({
            where: { id: req.params.id },
            data: { name, description }
        });

        return res.status(200).json(new ApiResponse(200,  category, 'Category updated successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to update category');
    }
});

const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    try {
        await prisma.category.delete({
            where: { id: req.params.id }
        });
        return res.status(200).json(new ApiResponse(200, 'Category deleted successfully'));
    } catch (error: any) {
        throw new ApiError(500, error.message || 'Failed to delete category');
    }
});
import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import prisma from "../utils/prisma";
import { createCategorySchema } from "../types/category.types";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import { AuthenticatedRequest } from "../types/authentication.types";


export const createCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, type } = req.body
    const { id, role } = req.user!
    createCategorySchema.parse({ name, description, type })
    if (role !== "ADMIN") {
        throw new ApiError(403, "You are not authorized to create a category")
    }
    const admin = await prisma.admin.findUnique({
        where: {
            id,
        },
    })

    if (!admin) {
        throw new ApiError(404, "Admin not found")
    }

    const category = await prisma.category.create({
        data: {
            name,
            description,
            categoryType: type,
            adminId: admin.id,
        },
    })

    return res.status(201).json(
        new ApiResponse(201, category, "Category created successfully")
    )
})

export const getCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.user!
    const admin = await prisma.admin.findUnique({
        where: {
            id,
        },
    })

    if (!admin) {
        throw new ApiError(404, "Admin not found")
    }

    const categories = await prisma.category.findMany({
        where: {
            adminId: admin.id,
        },
    })

    return res.status(200).json(
        new ApiResponse(200, categories, "Categories fetched successfully")
    )
})

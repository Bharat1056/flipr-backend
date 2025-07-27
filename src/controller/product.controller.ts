import { Request, Response } from "express"
import asyncHandler from "../utils/asyncHandler"
import prisma from "../utils/prisma"
import ApiError from "../utils/apiError"
import ApiResponse from "../utils/apiResponse"
import { AuthenticatedRequest } from "../types/authentication.types"
import { ProductStatus } from "@prisma/client"

export const createProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    
    // Only ADMIN can create products
    if (role !== "ADMIN") {
        throw new ApiError(403, "Only admins can create products")
    }

    const { name, description, category, imageUrl, numberOfStocks, value, threshold } = req.body

    // Validate required fields
    if (!name || !category) {
        throw new ApiError(400, "Name and categoryId are required")
    }

    // Check if admin exists
    const admin = await prisma.admin.findUnique({
        where: { id }
    })
    if (!admin) {
        throw new ApiError(404, "Admin not found")
    }

    // Check if category exists and belongs to this admin
    const categoryObj = await prisma.category.findFirst({
        where: {
            name: category,
            adminId: id
        }
    })
    if (!categoryObj) {
        throw new ApiError(404, "Category not found or doesn't belong to this admin")
    }

    let status = "GOOD"
    if(numberOfStocks <= threshold){
        status = "CRITICAL"
    }

    // Create product
    const product = await prisma.product.create({
        data: {
            name,
            description,
            imageUrl,
            numberOfStocks: numberOfStocks || 0,
            value: value || 0,
            threshold: threshold || 10,
            categoryId: categoryObj.id,
            status: status as ProductStatus
        },
        include: {
            category: true
        }
    })

    return res.status(201).json(
        new ApiResponse(201, product, "Product created successfully")
    )
})

export const getProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { category, page = "1", limit = "10", sortBy = "createdAt", sortOrder = "desc", search, status } = req.query
    
    const pageNumber = parseInt(page as string) || 1
    const limitNumber = parseInt(limit as string) || 10
    const skip = (pageNumber - 1) * limitNumber

    let whereClause: any = {}
    let includeClause = {
        category: true,
        assignees: true
    }

    // Validate sortBy and sortOrder
    const validSortFields = ['name', 'createdAt', 'updatedAt', 'numberOfStocks', 'value']
    const validSortOrders = ['asc', 'desc']
    
    if (!validSortFields.includes(sortBy as string)) {
        throw new ApiError(400, "Invalid sortBy parameter")
    }
    
    if (!validSortOrders.includes(sortOrder as string)) {
        throw new ApiError(400, "Invalid sortOrder parameter")
    }

    if (role === "STAFF") {
        // Get staff and their assigned products
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: {
                Product: true
            }
        })
        
        if (!staff) {
            throw new ApiError(404, "Staff not found")
        }

        // Get staff's product IDs
        const staffProductIds = staff.Product.map(product => product.id)
        
        if (staffProductIds.length === 0) {
            return res.status(200).json(
                new ApiResponse(200, {
                    products: [],
                    pagination: {
                        page: pageNumber,
                        limit: limitNumber,
                        total: 0,
                        totalPages: 0
                    }
                }, "No products assigned to this staff")
            )
        }

        whereClause.id = { in: staffProductIds }

        // Filter by category if provided
        if (category) {
            const categoryObj = await prisma.category.findFirst({
                where: {
                    name: category as string,
                    adminId: staff.adminId
                }
            })
            
            if (!categoryObj) {
                throw new ApiError(404, "Category not found")
            }
            
            whereClause.categoryId = categoryObj.id
        }

        if (search) {
            whereClause.name = { contains: search as string, mode: "insensitive" }
        }

        if (status) {
            whereClause.status = status as ProductStatus
        }

    } else if (role === "ADMIN") {
        // Admin can see all products under their categories
        const admin = await prisma.admin.findUnique({
            where: { id },
            include: {
                categories: true
            }
        })
        
        if (!admin) {
            throw new ApiError(404, "Admin not found")
        }

        // Get admin's category IDs
        const adminCategoryIds = admin.categories.map(category => category.id)
        
        if (adminCategoryIds.length === 0) {
            return res.status(200).json(
                new ApiResponse(200, {
                    products: [],
                    pagination: {
                        page: pageNumber,
                        limit: limitNumber,
                        total: 0,
                        totalPages: 0
                    }
                }, "No categories found for this admin")
            )
        }

        whereClause.categoryId = { in: adminCategoryIds }

        // Filter by category if provided
        if (category) {
            const categoryObj = await prisma.category.findFirst({
                where: {
                    name: category as string,
                    adminId: id
                }
            })
            
            if (!categoryObj) {
                throw new ApiError(404, "Category not found")
            }
            
            whereClause.categoryId = categoryObj.id
        }

        if (search) {
            whereClause.name = { contains: search as string, mode: "insensitive" }
        }

        if (status) {
            whereClause.status = status as ProductStatus
        }

    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Get total count for pagination
    const total = await prisma.product.count({
        where: whereClause
    })

    // Get products with pagination and sorting
    const products = await prisma.product.findMany({
        where: whereClause,
        include: includeClause,
        skip,
        take: limitNumber,
        orderBy: {
            [sortBy as string]: sortOrder as 'asc' | 'desc'
        }
    })

    // Transform products to match the required format
    const transformedProducts = products.map((product: any) => ({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        description: product.description,
        numberOfStocks: product.numberOfStocks,
        value: product.value,
        threshold: product.threshold,
        status: product.status,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        assignees: product.assignees.map((assignee: any) => ({
            id: assignee.id,
            name: assignee.fullName,
            username: assignee.username
        }))
    }))

    const totalPages = Math.ceil(total / limitNumber)

    return res.status(200).json(
        new ApiResponse(200, {
            products: transformedProducts,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages
            }
        }, "Products fetched successfully")
    )
})

export const deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { productId } = req.params

    if(role !== "ADMIN"){
        throw new ApiError(403, "Only admins can delete products")
    }

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            category: true
        }
    })

    if(!product){
        throw new ApiError(404, "Product not found")
    }
    
    if(product.category.adminId !== id){
        throw new ApiError(403, "You are not authorized to delete this product")
    }

    await prisma.product.delete({
        where: { id: productId }
    })

    return res.status(200).json(
        new ApiResponse(200, null, "Product deleted successfully")
    )
})

export const individualProduct = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            category: true,
            assignees: true
        }
    })

    
    if(!product){
        throw new ApiError(404, "Product not found")
    }
    
    const { adminId } = product.category
    
    const admin = await prisma.admin.findUnique({
        where: { id: adminId }
    })

    if(!admin){
        throw new ApiError(404, "Admin not found for this product")
    }

    return res.status(200).json(
        new ApiResponse(200, {...product, adminName: admin.fullName, assignees: product.assignees.map(assignee => assignee.fullName)  }, "Product fetched successfully")
    )
})

export const increaseProductQuantity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { productId } = req.params
    const { quantity, note } = req.body

    // Validate required fields
    if (!quantity || quantity <= 0) {
        throw new ApiError(400, "Quantity must be a positive number")
    }

    // Find the product
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            category: true,
            assignees: true
        }
    })

    if (!product) {
        throw new ApiError(404, "Product not found")
    }

    // Check authorization based on role
    if (role === "STAFF") {
        // Check if staff is assigned to this product
        const isAssigned = product.assignees.some(assignee => assignee.id === id)
        if (!isAssigned) {
            throw new ApiError(403, "You are not authorized to modify this product")
        }
    } else if (role === "ADMIN") {
        // Check if admin owns the category of this product
        if (product.category.adminId !== id) {
            throw new ApiError(403, "You are not authorized to modify this product")
        }
    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Update product quantity
    const newQuantity = product.numberOfStocks + quantity
    let newStatus = product.status

    // Update status based on new quantity
    if (newQuantity <= product.threshold) {
        newStatus = "CRITICAL"
    } else {
        newStatus = "GOOD"
    }

    const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
            numberOfStocks: newQuantity,
            status: newStatus as ProductStatus
        },
        include: {
            category: true
        }
    })

    // Create inventory log
    await prisma.inventoryLog.create({
        data: {
            note: note || "Manual quantity increase",
            actionType: "UPDATE_PRODUCT_NUMBER_OF_STOCKS",
            productId: productId,
            quantity: `+${quantity}`,
            ...(role === "ADMIN" ? { adminId: id } : { staffId: id })
        }
    })

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product quantity increased successfully")
    )
})

export const decreaseProductQuantity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { productId } = req.params
    const { quantity, note } = req.body

    // Validate required fields
    if (!quantity || quantity <= 0) {
        throw new ApiError(400, "Quantity must be a positive number")
    }

    // Find the product
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            category: true,
            assignees: true
        }
    })

    if (!product) {
        throw new ApiError(404, "Product not found")
    }

    // Check authorization based on role
    if (role === "STAFF") {
        // Check if staff is assigned to this product
        const isAssigned = product.assignees.some(assignee => assignee.id === id)
        if (!isAssigned) {
            throw new ApiError(403, "You are not authorized to modify this product")
        }
    } else if (role === "ADMIN") {
        // Check if admin owns the category of this product
        if (product.category.adminId !== id) {
            throw new ApiError(403, "You are not authorized to modify this product")
        }
    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Check if there's enough stock to decrease
    if (product.numberOfStocks < quantity) {
        throw new ApiError(400, "Insufficient stock to decrease by the requested amount")
    }

    // Update product quantity
    const newQuantity = product.numberOfStocks - quantity
    let newStatus = product.status

    // Update status based on new quantity
    if (newQuantity <= product.threshold) {
        newStatus = "CRITICAL"
    } else {
        newStatus = "GOOD"
    }

    const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
            numberOfStocks: newQuantity,
            status: newStatus as ProductStatus
        },
        include: {
            category: true
        }
    })

    // Create inventory log
    await prisma.inventoryLog.create({
        data: {
            note: note || "Manual quantity decrease",
            actionType: "UPDATE_PRODUCT_NUMBER_OF_STOCKS",
            productId: productId,
            quantity: `-${quantity}`,
            ...(role === "ADMIN" ? { adminId: id } : { staffId: id })
        }
    })

    // Create notification for threshold reached
    if (newQuantity <= product.threshold && product.numberOfStocks > product.threshold) {
        await prisma.notification.create({
            data: {
                type: "STOCK_THRESHOLD_REACHED",
                message: `Product "${product.name}" has reached critical threshold. Current stock: ${newQuantity}`,
                productId: productId,
                ...(role === "ADMIN" ? { adminId: id } : { staffId: id })
            }
        })
    }

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product quantity decreased successfully")
    )
})
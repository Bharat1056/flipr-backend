import { Request, Response } from "express"
import asyncHandler from "../utils/asyncHandler"
import prisma from "../utils/prisma"
import ApiError from "../utils/apiError"
import ApiResponse from "../utils/apiResponse"
import { AuthenticatedRequest } from "../types/authentication.types"
import { InventoryLogActionType } from "@prisma/client"

export const getInventoryLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { 
        page = "1", 
        limit = "10", 
        sortBy = "createdAt", 
        sortOrder = "desc", 
        actionType,
        productId,
        categoryId,
        startDate,
        endDate
    } = req.query
    
    const pageNumber = parseInt(page as string) || 1
    const limitNumber = parseInt(limit as string) || 10
    const skip = (pageNumber - 1) * limitNumber

    let whereClause: any = {}
    let includeClause = {
        Product: {
            include: {
                category: true
            }
        },
        Category: true,
        Admin: {
            select: {
                id: true,
                fullName: true,
                username: true
            }
        },
        Staff: {
            select: {
                id: true,
                fullName: true,
                username: true
            }
        }
    }

    // Validate sortBy and sortOrder
    const validSortFields = ['createdAt', 'actionType', 'quantity']
    const validSortOrders = ['asc', 'desc']
    
    if (!validSortFields.includes(sortBy as string)) {
        throw new ApiError(400, "Invalid sortBy parameter")
    }
    
    if (!validSortOrders.includes(sortOrder as string)) {
        throw new ApiError(400, "Invalid sortOrder parameter")
    }

    // Role-based filtering
    if (role === "STAFF") {
        // Staff can only see their own logs
        whereClause.staffId = id
    } else if (role === "ADMIN") {
        // Admin can see all logs related to their admin ID
        whereClause.adminId = id
    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Filter by action type
    if (actionType) {
        if (!Object.values(InventoryLogActionType).includes(actionType as InventoryLogActionType)) {
            throw new ApiError(400, "Invalid action type")
        }
        whereClause.actionType = actionType
    }

    // Filter by product
    if (productId) {
        whereClause.productId = productId
    }

    // Filter by category
    if (categoryId) {
        whereClause.categoryId = categoryId
    }

    // Filter by date range
    if (startDate || endDate) {
        whereClause.createdAt = {}
        
        if (startDate) {
            whereClause.createdAt.gte = new Date(startDate as string)
        }
        
        if (endDate) {
            whereClause.createdAt.lte = new Date(endDate as string)
        }
    }

    // Get total count for pagination
    const total = await prisma.inventoryLog.count({
        where: whereClause
    })

    // Get inventory logs with pagination and sorting
    const inventoryLogs = await prisma.inventoryLog.findMany({
        where: whereClause,
        include: includeClause,
        skip,
        take: limitNumber,
        orderBy: {
            [sortBy as string]: sortOrder as 'asc' | 'desc'
        }
    })

    console.log('Raw inventory logs from database:', inventoryLogs.map(log => ({
        id: log.id,
        productId: log.productId,
        actionType: log.actionType,
        note: log.note
    })))

    // Transform logs to match the required format
    const transformedLogs = inventoryLogs.map((log: any) => ({
        id: log.id,
        note: log.note,
        actionType: log.actionType,
        quantity: log.quantity,
        createdAt: log.createdAt,
        product: log.Product ? {
            id: log.Product.id,
            name: log.Product.name,
            categoryName: log.Product.category.name
        } : null,
        category: log.Category ? {
            id: log.Category.id,
            name: log.Category.name
        } : null,
        admin: log.Admin ? {
            id: log.Admin.id,
            fullName: log.Admin.fullName,
            username: log.Admin.username
        } : null,
        staff: log.Staff ? {
            id: log.Staff.id,
            fullName: log.Staff.fullName,
            username: log.Staff.username
        } : null
    }))

    const totalPages = Math.ceil(total / limitNumber)

    return res.status(200).json(
        new ApiResponse(200, {
            logs: transformedLogs,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages
            }
        }, "Inventory logs fetched successfully")
    )
})

export const getInventoryLogById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id: userId, role } = req.user!
    const { logId } = req.params

    const log = await prisma.inventoryLog.findUnique({
        where: { id: logId },
        include: {
            Product: {
                include: {
                    category: true
                }
            },
            Category: true,
            Admin: {
                select: {
                    id: true,
                    fullName: true,
                    username: true
                }
            },
            Staff: {
                select: {
                    id: true,
                    fullName: true,
                    username: true
                }
            }
        }
    })

    if (!log) {
        throw new ApiError(404, "Inventory log not found")
    }

    // Check authorization
    if (role === "STAFF") {
        if (log.staffId !== userId) {
            throw new ApiError(403, "You are not authorized to view this log")
        }
    } else if (role === "ADMIN") {
        if (log.adminId !== userId) {
            throw new ApiError(403, "You are not authorized to view this log")
        }
    }

    const transformedLog = {
        id: log.id,
        note: log.note,
        actionType: log.actionType,
        quantity: log.quantity,
        createdAt: log.createdAt,
        product: log.Product ? {
            id: log.Product.id,
            name: log.Product.name,
            categoryName: log.Product.category.name
        } : null,
        category: log.Category ? {
            id: log.Category.id,
            name: log.Category.name
        } : null,
        admin: log.Admin ? {
            id: log.Admin.id,
            fullName: log.Admin.fullName,
            username: log.Admin.username
        } : null,
        staff: log.Staff ? {
            id: log.Staff.id,
            fullName: log.Staff.fullName,
            username: log.Staff.username
        } : null
    }

    return res.status(200).json(
        new ApiResponse(200, transformedLog, "Inventory log fetched successfully")
    )
})

export const getInventoryStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { startDate, endDate } = req.query

    let whereClause: any = {}

    // Role-based filtering
    if (role === "STAFF") {
        whereClause.staffId = id
    } else if (role === "ADMIN") {
        whereClause.adminId = id
    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Filter by date range
    if (startDate || endDate) {
        whereClause.createdAt = {}
        
        if (startDate) {
            whereClause.createdAt.gte = new Date(startDate as string)
        }
        
        if (endDate) {
            whereClause.createdAt.lte = new Date(endDate as string)
        }
    }

    // Get statistics
    const totalLogs = await prisma.inventoryLog.count({
        where: whereClause
    })

    const increaseLogs = await prisma.inventoryLog.count({
        where: {
            ...whereClause,
            actionType: "INCREASE"
        }
    })

    const decreaseLogs = await prisma.inventoryLog.count({
        where: {
            ...whereClause,
            actionType: "DECREASE"
        }
    })

    // Get logs by date (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return date.toISOString().split('T')[0]
    }).reverse()

    const logsByDate = await Promise.all(
        last7Days.map(async (date) => {
            const startOfDay = new Date(date)
            const endOfDay = new Date(date)
            endOfDay.setDate(endOfDay.getDate() + 1)

            const count = await prisma.inventoryLog.count({
                where: {
                    ...whereClause,
                    createdAt: {
                        gte: startOfDay,
                        lt: endOfDay
                    }
                }
            })

            return {
                date,
                count
            }
        })
    )

    const stats = {
        totalLogs,
        increaseLogs,
        decreaseLogs,
        logsByDate
    }

    return res.status(200).json(
        new ApiResponse(200, stats, "Inventory statistics fetched successfully")
    )
}) 

export const testInventoryLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get all inventory logs without any filtering to see what's in the database
    const allLogs = await prisma.inventoryLog.findMany({
        include: {
            Product: true,
            Category: true,
            Admin: true,
            Staff: true
        }
    })

    console.log('All inventory logs in database:', allLogs)

    return res.status(200).json(
        new ApiResponse(200, {
            totalLogs: allLogs.length,
            logs: allLogs.map(log => ({
                id: log.id,
                productId: log.productId,
                categoryId: log.categoryId,
                adminId: log.adminId,
                staffId: log.staffId,
                actionType: log.actionType,
                quantity: log.quantity,
                note: log.note,
                createdAt: log.createdAt,
                product: log.Product ? {
                    id: log.Product.id,
                    name: log.Product.name
                } : null
            }))
        }, "Test inventory logs")
    )
}) 
import { Request, Response } from "express"
import asyncHandler from "../utils/asyncHandler"
import prisma from "../utils/prisma"
import ApiError from "../utils/apiError"
import ApiResponse from "../utils/apiResponse"
import { AuthenticatedRequest } from "../types/authentication.types"

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
        note: (log as any).note,
        actionType: log.actionType,
        quantity: (log as any).quantity,
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
                quantity: (log as any).quantity,
                note: (log as any).note,
                createdAt: log.createdAt,
                product: log.Product ? {
                    id: log.Product.id,
                    name: log.Product.name
                } : null
            }))
        }, "Test inventory logs")
    )
}) 

export const getStockVariance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { 
        productId, 
        categoryId, 
        startDate, 
        endDate,
        targetDate,
        comparisonType = "previous" // "previous", "average", "baseline"
    } = req.query

    let whereClause: any = {}

    // Role-based filtering
    if (role === "STAFF") {
        whereClause.staffId = id
    } else if (role === "ADMIN") {
        whereClause.adminId = id
    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Filter by product
    if (productId) {
        whereClause.productId = productId as string
    }

    // Filter by category
    if (categoryId) {
        whereClause.categoryId = categoryId as string
    }

    // Parse target date
    const targetDateTime = targetDate ? new Date(targetDate as string) : new Date()
    
    // Get current stock levels
    const currentProducts = await prisma.product.findMany({
        where: {
            ...(productId && { id: productId as string }),
            ...(categoryId && { categoryId: categoryId as string }),
            category: {
                ...(role === "ADMIN" && { adminId: id }),
                ...(role === "STAFF" && { 
                    assignees: { some: { id } }
                })
            }
        },
        include: {
            category: true
        }
    })

    const varianceResults = await Promise.all(
        currentProducts.map(async (product) => {
            // Calculate stock level at target date
            const stockAtTargetDate = await calculateStockAtDate(product.id, targetDateTime)
            
            // Calculate comparison value based on type
            let comparisonValue = 0
            let comparisonDate = null
            
            if (comparisonType === "previous") {
                // Compare with previous day
                const previousDate = new Date(targetDateTime)
                previousDate.setDate(previousDate.getDate() - 1)
                comparisonValue = await calculateStockAtDate(product.id, previousDate)
                comparisonDate = previousDate
            } else if (comparisonType === "average") {
                // Compare with average of last 7 days
                const sevenDaysAgo = new Date(targetDateTime)
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
                comparisonValue = await calculateAverageStock(product.id, sevenDaysAgo, targetDateTime)
                comparisonDate = sevenDaysAgo
            } else if (comparisonType === "baseline") {
                // Compare with baseline (first recorded stock)
                comparisonValue = await getBaselineStock(product.id)
                comparisonDate = null
            }

            // Calculate variance
            const variance = stockAtTargetDate - comparisonValue
            const variancePercentage = comparisonValue !== 0 
                ? ((variance / comparisonValue) * 100) 
                : 0

            return {
                productId: product.id,
                productName: product.name,
                categoryName: (product as any).category?.name || 'Unknown',
                currentStock: product.numberOfStocks,
                stockAtTargetDate,
                comparisonValue,
                comparisonDate,
                variance,
                variancePercentage,
                varianceType: variance > 0 ? "INCREASE" : variance < 0 ? "DECREASE" : "NO_CHANGE",
                targetDate: targetDateTime,
                comparisonType
            }
        })
    )

    return res.status(200).json(
        new ApiResponse(200, {
            varianceResults,
            summary: {
                totalProducts: varianceResults.length,
                increasedProducts: varianceResults.filter(r => r.variance > 0).length,
                decreasedProducts: varianceResults.filter(r => r.variance < 0).length,
                unchangedProducts: varianceResults.filter(r => r.variance === 0).length,
                averageVariance: varianceResults.reduce((sum, r) => sum + r.variance, 0) / varianceResults.length
            }
        }, "Stock variance analysis completed successfully")
    )
})

// Helper function to calculate stock at a specific date
async function calculateStockAtDate(productId: string, targetDate: Date): Promise<number> {
    const logs = await prisma.inventoryLog.findMany({
        where: {
            productId,
            createdAt: {
                lte: targetDate
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    })

    let stockLevel = 0
    logs.forEach(log => {
        const quantity = parseInt((log as any).quantity || '0')
        if (log.actionType === 'INCREASE') {
            stockLevel += quantity
        } else if (log.actionType === 'DECREASE') {
            stockLevel -= Math.abs(quantity)
        }
    })

    return stockLevel
}

// Helper function to calculate average stock over a period
async function calculateAverageStock(productId: string, startDate: Date, endDate: Date): Promise<number> {
    const logs = await prisma.inventoryLog.findMany({
        where: {
            productId,
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    })

    if (logs.length === 0) return 0

    let totalStock = 0
    let currentStock = 0

    // Group logs by day and calculate daily averages
    const dailyStocks = new Map<string, number>()
    
    logs.forEach(log => {
        const dateKey = log.createdAt.toISOString().split('T')[0]
        const quantity = parseInt((log as any).quantity || '0')
        
        if (log.actionType === 'INCREASE') {
            currentStock += quantity
        } else if (log.actionType === 'DECREASE') {
            currentStock -= Math.abs(quantity)
        }
        
        dailyStocks.set(dateKey, currentStock)
    })

    const averageStock = Array.from(dailyStocks.values()).reduce((sum, stock) => sum + stock, 0) / dailyStocks.size
    return averageStock
}

// Helper function to get baseline stock (first recorded stock)
async function getBaselineStock(productId: string): Promise<number> {
    const firstLog = await prisma.inventoryLog.findFirst({
        where: {
            productId
        },
        orderBy: {
            createdAt: 'asc'
        }
    })

    if (!firstLog) return 0

    const quantity = parseInt((firstLog as any).quantity || '0')
    return firstLog.actionType === 'INCREASE' ? quantity : 0
} 

export const getStockSnapshots = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, role } = req.user!
    const { 
        productId, 
        categoryId, 
        startDate, 
        endDate,
        page = "1", 
        limit = "10", 
        sortBy = "timestamp", 
        sortOrder = "desc"
    } = req.query
    
    const pageNumber = parseInt(page as string) || 1
    const limitNumber = parseInt(limit as string) || 10
    const skip = (pageNumber - 1) * limitNumber

    let whereClause: any = {}

    // Role-based filtering
    if (role === "STAFF") {
        whereClause.product = {
            assignees: { some: { id } }
        }
    } else if (role === "ADMIN") {
        whereClause.product = {
            category: { adminId: id }
        }
    } else {
        throw new ApiError(403, "Invalid role")
    }

    // Filter by product
    if (productId) {
        whereClause.productId = productId as string
    }

    // Filter by category
    if (categoryId) {
        whereClause.product = {
            ...whereClause.product,
            categoryId: categoryId as string
        }
    }

    // Filter by date range
    if (startDate || endDate) {
        whereClause.timestamp = {}
        
        if (startDate) {
            whereClause.timestamp.gte = new Date(startDate as string)
        }
        
        if (endDate) {
            whereClause.timestamp.lte = new Date(endDate as string)
        }
    }

    // Validate sortBy and sortOrder
    const validSortFields = ['timestamp', 'quantity', 'value', 'createdAt']
    const validSortOrders = ['asc', 'desc']
    
    if (!validSortFields.includes(sortBy as string)) {
        throw new ApiError(400, "Invalid sortBy parameter")
    }
    
    if (!validSortOrders.includes(sortOrder as string)) {
        throw new ApiError(400, "Invalid sortOrder parameter")
    }

    // Get total count for pagination
    const total = await prisma.stockSnapshot.count({
        where: whereClause
    })

    // Get stock snapshots with pagination and sorting
    const stockSnapshots = await prisma.stockSnapshot.findMany({
        where: whereClause,
        include: {
            product: {
                include: {
                    category: true
                }
            }
        },
        skip,
        take: limitNumber,
        orderBy: {
            [sortBy as string]: sortOrder as 'asc' | 'desc'
        }
    })

    // Transform snapshots to match the required format
    const transformedSnapshots = stockSnapshots.map((snapshot: any) => ({
        id: snapshot.id,
        productId: snapshot.productId,
        productName: snapshot.product.name,
        categoryName: snapshot.product.category.name,
        quantity: snapshot.quantity,
        value: snapshot.value,
        timestamp: snapshot.timestamp,
        createdAt: snapshot.createdAt
    }))

    const totalPages = Math.ceil(total / limitNumber)

    return res.status(200).json(
        new ApiResponse(200, {
            snapshots: transformedSnapshots,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages
            }
        }, "Stock snapshots fetched successfully")
    )
})

export const getStockSnapshotById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id: userId, role } = req.user!
    const { productId } = req.params

    const snapshot = await prisma.stockSnapshot.findFirst({
        where: { productId },
        include: {
            product: {
                include: {
                    category: true,
                    assignees: true
                }
            }
        }
    })

    if (!snapshot) {
        throw new ApiError(404, "Stock snapshot not found")
    }

    // Check authorization
    if (role === "STAFF") {
        const isAssigned = (snapshot as any).product.assignees?.some((assignee: any) => assignee.id === userId)
        if (!isAssigned) {
            throw new ApiError(403, "You are not authorized to view this snapshot")
        }
    } else if (role === "ADMIN") {
        if ((snapshot as any).product.category.adminId !== userId) {
            throw new ApiError(403, "You are not authorized to view this snapshot")
        }
    }

    const transformedSnapshot = {
        id: snapshot.id,
        productId: snapshot.productId,
        productName: (snapshot as any).product.name,
        categoryName: (snapshot as any).product.category.name,
        quantity: snapshot.quantity,
        value: snapshot.value,
        timestamp: snapshot.timestamp,
        createdAt: snapshot.createdAt
    }

    return res.status(200).json(
        new ApiResponse(200, transformedSnapshot, "Stock snapshot fetched successfully")
    )
}) 
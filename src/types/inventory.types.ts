
import { z } from "zod"

export const getInventoryLogsQuerySchema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.enum(['createdAt', 'actionType', 'quantity']).optional(),
    actionType: z.string().optional(),
    productId: z.string().optional(),
    categoryId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
})

export const getInventoryStatsQuerySchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
})

export const getStockVarianceQuerySchema = z.object({
    productId: z.string().optional(),
    categoryId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    targetDate: z.string().optional(),
    comparisonType: z.enum(['previous', 'average', 'baseline']).optional(),
})

export interface InventoryLogResponse {
    id: string
    note: string | null
    actionType: string
    quantity: string | null
    createdAt: Date
    product: {
        id: string
        name: string
        categoryName: string
    } | null
    category: {
        id: string
        name: string
    } | null
    admin: {
        id: string
        fullName: string
        username: string
    } | null
    staff: {
        id: string
        fullName: string
        username: string
    } | null
}

export interface InventoryStatsResponse {
    totalLogs: number
    increaseLogs: number
    decreaseLogs: number
    logsByDate: Array<{
        date: string
        count: number
    }>
}

export interface StockVarianceResult {
    productId: string
    productName: string
    categoryName: string
    currentStock: number
    stockAtTargetDate: number
    comparisonValue: number
    comparisonDate: Date | null
    variance: number
    variancePercentage: number
    varianceType: 'INCREASE' | 'DECREASE' | 'NO_CHANGE'
    targetDate: Date
    comparisonType: string
}

export interface StockVarianceResponse {
    varianceResults: StockVarianceResult[]
    summary: {
        totalProducts: number
        increasedProducts: number
        decreasedProducts: number
        unchangedProducts: number
        averageVariance: number
    }
} 
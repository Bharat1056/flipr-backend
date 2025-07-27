import { InventoryLogActionType } from "@prisma/client"
import { z } from "zod"

export const getInventoryLogsQuerySchema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.enum(['createdAt', 'actionType', 'quantity']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    actionType: z.enum(Object.values(InventoryLogActionType) as [string, ...string[]]).optional(),
    productId: z.string().optional(),
    categoryId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
})

export const getInventoryStatsQuerySchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
})

export interface InventoryLogResponse {
    id: string
    note: string | null
    actionType: InventoryLogActionType
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
import { ProductCategoryType } from "@prisma/client"
import { z } from "zod"

export const createCategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    type: z.enum(Object.values(ProductCategoryType) as [string, ...string[]]),
})
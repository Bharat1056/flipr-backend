import { Request } from "express"
import { Admin, Staff } from "@prisma/client"

export type AuthenticatedRequest = Request & {
    user: (Admin | Staff | null) & { role: "ADMIN" | "STAFF" }
}
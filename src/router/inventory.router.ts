import { Router } from "express"
import { 
    getInventoryLogs, 
    getInventoryLogById, 
    getInventoryStats,
    testInventoryLogs,
    getStockVariance
} from "../controller/inventory.controller"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware"

const router = Router()

// Test endpoint to check raw inventory logs
router.get("/test", authenticateToken, authorizeRoles("ADMIN", "STAFF"), testInventoryLogs)

// Get all inventory logs with filtering - Both ADMIN and STAFF can access with role-based filtering
router.get("/logs", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getInventoryLogs)

// Get specific inventory log by ID - Both ADMIN and STAFF can access with role-based filtering
router.get("/logs/:logId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getInventoryLogById)

// Get inventory statistics - Both ADMIN and STAFF can access with role-based filtering
router.get("/stats", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getInventoryStats)

// Get stock variance analysis - Both ADMIN and STAFF can access with role-based filtering
router.get("/variance", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getStockVariance)

export default router 
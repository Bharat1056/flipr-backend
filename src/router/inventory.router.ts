import { Router } from "express"
import { 
    getInventoryLogs, 
    getInventoryLogById, 
    getInventoryStats,
    testInventoryLogs,
    getStockVariance,
    getStockSnapshots,
    getStockSnapshotById
} from "../controller/inventory.controller"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware"

const router = Router()

router.get("/logs", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getInventoryLogs)

router.get("/logs/:logId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getInventoryLogById)

router.get("/stats", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getInventoryStats)

router.get("/variance", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getStockVariance)

router.get("/snapshots", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getStockSnapshots)

router.get("/snapshots/:productId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getStockSnapshotById)

export default router 
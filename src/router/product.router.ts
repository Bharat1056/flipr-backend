import { Router } from "express"
import { createProduct, deleteProduct, getProducts, individualProduct, increaseProductQuantity, decreaseProductQuantity } from "../controller/product.controller"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware"

const router = Router()

// Create product - Only ADMIN can create products
router.post("/create", authenticateToken, authorizeRoles("ADMIN"), createProduct)

// Get products - Both ADMIN and STAFF can access with role-based filtering
router.get("/get", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getProducts)

router.delete("/delete/:productId", authenticateToken, authorizeRoles("ADMIN"), deleteProduct)

router.get("/individual/:productId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), individualProduct)

router.patch("/increase/:productId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), increaseProductQuantity)

router.patch("/decrease/:productId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), decreaseProductQuantity)

export default router
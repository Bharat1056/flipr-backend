import { Router } from "express"
import { createProduct, deleteProduct, getProducts, individualProduct, updateProductQuantity } from "../controller/product.controller"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware"

const router = Router()

// Create product - Only ADMIN can create products
router.post("/create", authenticateToken, authorizeRoles("ADMIN"), createProduct)

// Get products - Both ADMIN and STAFF can access with role-based filtering
router.get("/get", authenticateToken, authorizeRoles("ADMIN", "STAFF"), getProducts)

router.delete("/delete/:productId", authenticateToken, authorizeRoles("ADMIN"), deleteProduct)

router.get("/individual/:productId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), individualProduct)

router.put("/update-stock/:productId", authenticateToken, authorizeRoles("ADMIN", "STAFF"), updateProductQuantity)


export default router
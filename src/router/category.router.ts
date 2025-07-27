import { Router } from "express"
import { createCategory, getCategories } from "../controller/category.controller"
import { authenticateToken } from "../middleware/auth.middleware"

const router = Router()

router.post('/create', authenticateToken, createCategory)
router.get('/get', authenticateToken, getCategories)   

export default router
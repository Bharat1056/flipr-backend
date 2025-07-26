import { Router } from "express"
import { getUser, logout, resetPassword } from "../controller/common.controller"
import { authenticateToken } from "../middleware/auth.middleware"

const router = Router()

router.post('/logout', authenticateToken, logout)
router.get('/me', authenticateToken, getUser)
router.post('/reset-password', authenticateToken, resetPassword)

export default router
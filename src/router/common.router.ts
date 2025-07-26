import { Router } from "express"
import { getUser, logout, resetPassword } from "../controller/common.controller"

const router = Router()

router.post('/logout', logout)
router.get('/user', getUser)
router.post('/reset-password', resetPassword)

export default router
import { Router } from "express";
import { authenticateToken , authorizeRoles } from "../middleware/auth.middleware";
import { registerUser , loginUser , logOutUser } from "../controller/user.controller";

const router = Router()

router.route('/register').post(registerUser)
router.route('/login').post(loginUser)
router.route('/logout').post(authenticateToken , logOutUser)

export default router;
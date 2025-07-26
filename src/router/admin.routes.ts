import { Router } from 'express';
import {
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    getAdminData
} from '../controller/admin.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/data', getAdminData);

// Protected routes
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

router.post('/logout', logoutAdmin);

export default router; 
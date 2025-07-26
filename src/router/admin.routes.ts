import { Router } from 'express';
import {
    registerAdmin,
    loginAdmin,
} from '../controller/admin.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/authentication.types';

const router = Router();

// Public routes
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

// Protected routes
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

export default router; 
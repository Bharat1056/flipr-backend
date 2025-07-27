import { Router } from 'express';
import { registerStaff } from '../controller/staff.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/authentication.types';

const router = Router();

// Public routes
router.post('/register', registerStaff);

// Protected routes
router.use(authenticateToken);
router.use(authorizeRoles('STAFF'));

export default router; 
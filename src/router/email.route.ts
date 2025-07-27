import { Router } from 'express';
import { sendInvitations } from '../controller/email.controller';
import { authenticateToken , authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.post('/send', authenticateToken , authorizeRoles('ADMIN') , sendInvitations)

export default router
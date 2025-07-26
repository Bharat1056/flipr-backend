import { Router } from "express";
import {
  getAdminDashboard,
  getStaffDashboard,
  getUserDashboard,
  getInventoryAlerts,
  getRecentActivity
} from "../controller/dashboard.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();


router.route('/admin')
  .get(authenticateToken, authorizeRoles('ADMIN'), getAdminDashboard);

router.route('/staff')
  .get(authenticateToken, authorizeRoles('STAFF'), getStaffDashboard);

// router.route('/user')
//   .get(authenticateToken, getUserDashboard);

router.route('/alerts')
  .get(authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getInventoryAlerts);

router.route('/activity')
  .get(authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getRecentActivity);

export default router;
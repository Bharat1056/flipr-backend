import { Router } from "express";
import {
  updateInventory,
  getInventoryLogs,
  purchaseProduct,
  getAccessibleProducts
} from "../controller/inventory.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.route('/update')
  .post(authenticateToken, authorizeRoles('ADMIN', 'STAFF'), updateInventory);

router.route('/logs')
  .get(authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getInventoryLogs);

router.route('/products')
  .get(authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getAccessibleProducts);

router.route('/purchase/:id')
  .post(authenticateToken, purchaseProduct);


export default router;
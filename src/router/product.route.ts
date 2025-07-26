import { Router } from "express";
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts
} from "../controller/product.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.route('/')
  .get(authenticateToken, getProducts)
  .post(authenticateToken, authorizeRoles('ADMIN'), createProduct);

router.route('/low-stock')
  .get(authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getLowStockProducts);

router.route('/:id')
  .get(authenticateToken, getProduct)
  .put(authenticateToken, authorizeRoles('ADMIN'), updateProduct)
  .delete(authenticateToken, authorizeRoles('ADMIN'), deleteProduct);

export default router;
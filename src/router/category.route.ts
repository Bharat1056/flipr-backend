import { Router } from "express";
import { 
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controller/category.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.route('/categories')
  .get(getCategories);

// Admin-only routes
router.route('/categories')
  .post(authenticateToken, authorizeRoles('ADMIN'), createCategory);

router.route('/categories/:id')
  .put(authenticateToken, authorizeRoles('ADMIN'), updateCategory)
  .delete(authenticateToken, authorizeRoles('ADMIN'), deleteCategory);

export default router;
const express = require('express');
const userController = require('../controllers/user.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { protect, authorize } = require('../middlewares/auth.middleware');
const router = express.Router();
router.get('/count',      protect, asyncHandler(userController.getActiveUsersCount));
router.get('/profile',    protect, asyncHandler(userController.getProfile));
router.patch('/profile',  protect, asyncHandler(userController.updateProfile));
// FIX: /all now restricted to super_admin only
router.get('/all', protect, authorize('super_admin'), asyncHandler(userController.getAllSystemUsers));
// /  returns society-scoped list for admin
router.get('/',           protect, authorize('admin','super_admin'), asyncHandler(userController.getAllUsers));
router.post('/residents', protect, authorize('admin','chairman'), asyncHandler(userController.registerResident));
router.patch('/:id/role', protect, authorize('admin','super_admin'), asyncHandler(userController.updateRole));
router.delete('/:id',     protect, authorize('admin','super_admin'), asyncHandler(userController.deleteUser));
module.exports = router;

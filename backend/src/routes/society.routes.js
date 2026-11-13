const express = require('express');
const societyController = require('../controllers/society.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { protect, authorize } = require('../middlewares/auth.middleware');
const router = express.Router();
// FIX: list societies still public (needed for registration), but details require auth
router.get('/',      asyncHandler(societyController.listSocieties));
router.post('/',     protect, authorize('admin'), asyncHandler(societyController.createSociety));
router.get('/:id',   protect, asyncHandler(societyController.getSocietyDetails));
router.post('/:id/wings', protect, authorize('admin'), asyncHandler(societyController.addWing));
router.delete('/:id', protect, authorize('admin','super_admin'), asyncHandler(societyController.deleteSociety));
module.exports = router;

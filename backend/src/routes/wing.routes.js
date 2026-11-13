const express = require('express');
const wingController = require('../controllers/wing.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { protect, authorize } = require('../middlewares/auth.middleware');
const router = express.Router();
// FIX: require auth on wings endpoint
router.get('/society/:id', protect, asyncHandler(wingController.getWingsBySociety));
router.patch('/:id/assign-chairman', protect, authorize('admin'), asyncHandler(wingController.assignChairman));
router.patch('/:id/assign-chairman-by-contact', protect, authorize('admin'), asyncHandler(wingController.assignChairmanByContact));
router.post('/:id/join-request', protect, authorize('resident'), asyncHandler(wingController.requestJoinWing));
router.get('/:id/requests', protect, authorize('chairman'), asyncHandler(wingController.listPendingRequests));
router.get('/:id/members',  protect, authorize('chairman','admin'), asyncHandler(wingController.listMembers));
router.patch('/:id/requests/:userId/approve', protect, authorize('chairman'), asyncHandler(wingController.approveRequest));
router.patch('/:id/requests/:userId/reject',  protect, authorize('chairman'), asyncHandler(wingController.rejectRequest));
router.patch('/:id/members/:userId/remove',   protect, authorize('chairman','admin'), asyncHandler(wingController.removeMember));
module.exports = router;

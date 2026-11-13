const express = require('express');
const noticeController = require('../controllers/notice.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { protect, authorize, requireApprovedResident } = require('../middlewares/auth.middleware');
const router = express.Router();
router.post('/',         protect, authorize('admin','chairman'), asyncHandler(noticeController.createNotice));
router.get('/',          protect, requireApprovedResident, asyncHandler(noticeController.getAllNotices));
// NEW: real edit and delete endpoints
router.patch('/:id',     protect, authorize('admin','chairman'), asyncHandler(noticeController.editNotice));
router.delete('/:id',    protect, authorize('admin','chairman'), asyncHandler(noticeController.deleteNotice));
module.exports = router;

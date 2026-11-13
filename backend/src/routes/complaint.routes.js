const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const complaintController = require('../controllers/complaint.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/AppError');
const { protect, authorize, requireApprovedResident } = require('../middlewares/auth.middleware');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/complaints');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `complaint-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype))
      return cb(new AppError('Only image files are allowed (jpeg, png, webp, heic)', 400));
    return cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── Specific routes FIRST (must come before /:id wildcards) ──────────────────
router.post('/',   protect, requireApprovedResident, authorize('resident', 'chairman', 'admin'), upload.single('photo'), asyncHandler(complaintController.createComplaint));
router.get('/my',  protect, requireApprovedResident, authorize('resident', 'chairman'), asyncHandler(complaintController.getMyComplaints));
router.get('/',    protect, authorize('admin', 'chairman'), asyncHandler(complaintController.getAllComplaints));

// SECURITY: authenticated file serving — MUST be before /:id to prevent 'attachment' matching as an ID
router.get('/attachment/:filename', protect, asyncHandler(complaintController.serveAttachment));

// ── Wildcard :id routes LAST ─────────────────────────────────────────────────
router.patch('/:id/status', protect, authorize('admin', 'chairman'), asyncHandler(complaintController.updateComplaintStatus));
router.patch('/:id',        protect, asyncHandler(complaintController.editComplaint));
router.delete('/:id',       protect, asyncHandler(complaintController.deleteComplaint));

module.exports = router;

const express = require('express');
const multer = require('multer');
const ragController = require('../controllers/rag.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError = require('../utils/AppError');
const { protect, authorize, requireApprovedResident } = require('../middlewares/auth.middleware');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf';
    if (!isPdf) {
      return cb(new AppError('Only PDF files are allowed', 400));
    }
    return cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// Routes layer: endpoint definitions and request preprocessing middleware.
router.post('/upload', protect, authorize('admin'), upload.single('file'), asyncHandler(ragController.uploadPdf));
router.post('/query', protect, requireApprovedResident, asyncHandler(ragController.queryRag));

module.exports = router;

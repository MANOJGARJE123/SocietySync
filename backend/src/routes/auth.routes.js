const express = require('express');
const authController = require('../controllers/auth.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { protect } = require('../middlewares/auth.middleware');
const router = express.Router();

router.post('/register',         asyncHandler(authController.register));
router.post('/login',            asyncHandler(authController.login));
// Change password (authenticated)
router.post('/change-password',  protect, asyncHandler(authController.changePassword));

module.exports = router;

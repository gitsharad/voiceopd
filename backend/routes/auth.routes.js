const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { register, login, refreshToken, logout, getMe, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Valid Indian mobile number required'),
];

router.post('/register',         registerValidation, register);
router.post('/login',            login);
router.post('/refresh',          refreshToken);
router.post('/logout',           protect, logout);
router.get('/me',                protect, getMe);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;

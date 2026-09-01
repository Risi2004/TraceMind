import express from 'express';
import {
  register,
  login,
  verifyOtp,
  resendOtp,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  changePasswordSendOtp,
  changePassword,
  getMe,
  updateProfile,
  deleteAccount,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/signup', register); // Alias for frontend compatibility
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Forgot Password routes (Public)
router.post('/forgot-password/send-otp', forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', forgotPasswordVerifyOtp);
router.post('/forgot-password/reset', forgotPasswordReset);

// Protected routes (require valid JWT token)
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/change-password/send-otp', protect, changePasswordSendOtp);
router.put('/change-password', protect, changePassword);
router.delete('/account', protect, deleteAccount);

export default router;

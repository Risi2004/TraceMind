import User from '../models/User.js';
import emailService from '../services/email.service.js';

/**
 * @desc    Register a new user account & send OTP
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Full name is required.',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email address is required.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password is required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      // If user exists but is unverified, refresh OTP and allow them to verify
      if (!existingUser.isEmailVerified) {
        const otp = existingUser.generateOtp('EMAIL_VERIFICATION');
        await existingUser.save();
        await emailService.sendOtpEmail({ to: existingUser.email, name: existingUser.name, otp });

        return res.status(200).json({
          success: true,
          message: 'An unverified account exists. A fresh verification code has been sent to your email.',
          isEmailVerified: false,
          email: existingUser.email,
        });
      }

      return res.status(409).json({
        success: false,
        error: 'DuplicateResource',
        message: 'An account with this email address already exists.',
      });
    }

    // Create new unverified user
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'user',
      isEmailVerified: false,
    });

    // Generate 6-digit OTP for email verification and store hash
    const otp = user.generateOtp('EMAIL_VERIFICATION');
    await user.save();

    // Send verification email
    await emailService.sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully. Please verify your email with the 6-digit code sent.',
      isEmailVerified: false,
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify 6-digit OTP for account activation
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email address and 6-digit verification code are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+otpHash +otpPurpose +otpExpiresAt +otpAttempts'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Account not found with this email.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Account is already verified. You can log in directly.',
        isEmailVerified: true,
      });
    }

    // Validate OTP with purpose EMAIL_VERIFICATION
    const result = user.verifyOtp(otp, 'EMAIL_VERIFICATION');
    if (!result.valid) {
      await user.save();

      if (result.reason === 'max_attempts') {
        return res.status(429).json({
          success: false,
          error: 'MaxAttemptsExceeded',
          message: 'Maximum verification attempts exceeded. Please request a new code.',
        });
      }
      if (result.reason === 'expired') {
        return res.status(400).json({
          success: false,
          error: 'OtpExpired',
          message: 'The verification code has expired. Please request a new code.',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'InvalidOtp',
        message: result.remainingAttempts !== undefined
          ? `Invalid verification code. ${result.remainingAttempts} attempt${result.remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid verification code. Please check and try again.',
      });
    }

    // Save verified user state
    await user.save();

    // Asynchronously dispatch Welcome onboarding email
    emailService.sendWelcomeEmail({
      to: user.email,
      name: user.name,
    }).catch(err => console.error('[Welcome Email Error]:', err.message));

    // Generate JWT authentication token
    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to TraceMind.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend 6-digit OTP verification email for account activation
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
export const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email address is required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+otpResendAfter');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Account not found with this email.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        error: 'AlreadyVerified',
        message: 'This email is already verified. You can log in directly.',
      });
    }

    // Check 60-second cooldown
    if (user.otpResendAfter && new Date() < user.otpResendAfter) {
      const remainingSeconds = Math.ceil((user.otpResendAfter.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: 'RateLimited',
        message: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting a new code.`,
        remainingSeconds,
      });
    }

    // Generate new OTP
    const otp = user.generateOtp('EMAIL_VERIFICATION');
    await user.save();

    // Send OTP email
    await emailService.sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    res.status(200).json({
      success: true,
      message: 'A fresh 6-digit verification code has been sent to your email.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate existing user & return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Please provide your email address.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Please provide your password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email and explicitly select password & status
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid email or password.',
      });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid email or password.',
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        error: 'EmailNotVerified',
        isEmailVerified: false,
        email: user.email,
        message: 'Please verify your email address before logging in. A verification code is required.',
      });
    }

    // Generate JWT token
    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request Password Reset OTP (Forgot Password)
 * @route   POST /api/auth/forgot-password/send-otp
 * @access  Public
 */
export const forgotPasswordSendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Please enter your registered email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+otpResendAfter');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'No account found with this email address.',
      });
    }

    // Check 60-second cooldown
    if (user.otpResendAfter && new Date() < user.otpResendAfter) {
      const remainingSeconds = Math.ceil((user.otpResendAfter.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: 'RateLimited',
        message: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting a new code.`,
        remainingSeconds,
      });
    }

    // Generate OTP with purpose PASSWORD_RESET
    const otp = user.generateOtp('PASSWORD_RESET');
    await user.save();

    // Send reset OTP email
    await emailService.sendPasswordResetOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    res.status(200).json({
      success: true,
      message: 'A 6-digit password reset code has been sent to your email.',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP for Password Reset
 * @route   POST /api/auth/forgot-password/verify-otp
 * @access  Public
 */
export const forgotPasswordVerifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email address and 6-digit reset code are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+otpHash +otpPurpose +otpExpiresAt +otpAttempts'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Account not found with this email.',
      });
    }

    // Verify OTP with strict purpose segregation
    const result = user.verifyOtp(otp, 'PASSWORD_RESET');
    if (!result.valid) {
      await user.save();

      if (result.reason === 'max_attempts') {
        return res.status(429).json({
          success: false,
          error: 'MaxAttemptsExceeded',
          message: 'Maximum verification attempts exceeded. Please request a new reset code.',
        });
      }
      if (result.reason === 'expired') {
        return res.status(400).json({
          success: false,
          error: 'OtpExpired',
          message: 'The reset code has expired. Please request a new code.',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'InvalidOtp',
        message: result.remainingAttempts !== undefined
          ? `Invalid reset code. ${result.remainingAttempts} attempt${result.remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid reset code. Please check and try again.',
      });
    }

    // Generate short-lived scoped reset token for next step
    const resetToken = user.generateResetToken();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Reset code verified successfully. Please enter your new password.',
      resetToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set new password after OTP verification (Forgot Password)
 * @route   POST /api/auth/forgot-password/reset
 * @access  Public
 */
export const forgotPasswordReset = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email, reset token, and new password are required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+resetTokenHash +resetTokenExpiresAt +password'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Account not found.',
      });
    }

    // Verify reset token
    const isValidToken = user.verifyResetToken(resetToken);
    if (!isValidToken) {
      return res.status(400).json({
        success: false,
        error: 'InvalidResetSession',
        message: 'Invalid or expired password reset session. Please request a new reset code.',
      });
    }

    // Ensure new password is not the same as previous
    const isSamePassword = await user.matchPassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: 'SamePassword',
        message: 'New password cannot be the same as your previous password.',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send confirmation email
    emailService.sendPasswordChangedNotification({
      to: user.email,
      name: user.name,
      actionType: 'reset',
    }).catch(err => console.error('[Password Changed Email Error]:', err.message));

    res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully! You can now log in.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send OTP to logged-in user for In-App Password Change
 * @route   POST /api/auth/change-password/send-otp
 * @access  Private (JWT Protected)
 */
export const changePasswordSendOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+otpResendAfter');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found.',
      });
    }

    // Check cooldown
    if (user.otpResendAfter && new Date() < user.otpResendAfter) {
      const remainingSeconds = Math.ceil((user.otpResendAfter.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: 'RateLimited',
        message: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting a new authorization code.`,
        remainingSeconds,
      });
    }

    // Generate OTP with purpose PASSWORD_CHANGE
    const otp = user.generateOtp('PASSWORD_CHANGE');
    await user.save();

    // Send authorization code email
    await emailService.sendPasswordChangeOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    res.status(200).json({
      success: true,
      message: 'A 6-digit authorization code has been sent to your registered email.',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password for logged-in user with OTP verification
 * @route   PUT /api/auth/change-password
 * @access  Private (JWT Protected)
 */
export const changePassword = async (req, res, next) => {
  try {
    const { otp, currentPassword, newPassword } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Please enter the 6-digit authorization code sent to your email.',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Please provide both your current and new password.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'New password must be at least 8 characters long.',
      });
    }

    // Retrieve user with password, OTP, and attempts fields
    const user = await User.findById(req.user._id).select(
      '+password +otpHash +otpPurpose +otpExpiresAt +otpAttempts'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User account not found.',
      });
    }

    // 1. Verify OTP with purpose PASSWORD_CHANGE
    const otpResult = user.verifyOtp(otp, 'PASSWORD_CHANGE');
    if (!otpResult.valid) {
      await user.save();

      if (otpResult.reason === 'max_attempts') {
        return res.status(429).json({
          success: false,
          error: 'MaxAttemptsExceeded',
          message: 'Maximum authorization code attempts exceeded. Please request a new code.',
        });
      }
      if (otpResult.reason === 'expired') {
        return res.status(400).json({
          success: false,
          error: 'OtpExpired',
          message: 'The authorization code has expired. Please request a new code.',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'InvalidOtp',
        message: otpResult.remainingAttempts !== undefined
          ? `Invalid authorization code. ${otpResult.remainingAttempts} attempt${otpResult.remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid authorization code. Please verify the code sent to your email.',
      });
    }

    // 2. Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Current password does not match.',
      });
    }

    // 3. Prevent reuse of current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'SamePassword',
        message: 'New password cannot be the same as your current password.',
      });
    }

    // 4. Save new password
    user.password = newPassword;
    await user.save();

    // 5. Send notification email
    emailService.sendPasswordChangedNotification({
      to: user.email,
      name: user.name,
      actionType: 'changed',
    }).catch(err => console.error('[Password Changed Email Error]:', err.message));

    res.status(200).json({
      success: true,
      message: 'Password updated successfully!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (JWT Protected)
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile information
 * @route   PUT /api/auth/profile
 * @access  Private (JWT Protected)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const user = req.user;

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailExists = await User.findOne({ email: normalizedEmail });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(409).json({
          success: false,
          error: 'DuplicateResource',
          message: 'An account with this email address already exists.',
        });
      }
      user.email = normalizedEmail;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user's own account permanently (requires password verification)
 * @route   DELETE /api/auth/account
 * @access  Private (JWT Protected)
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Your current password is required to delete your account.',
      });
    }

    // Retrieve user with password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User account not found.',
      });
    }

    // Verify password before allowing deletion
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Incorrect password. Account deletion aborted.',
      });
    }

    // Delete user from database
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Your TraceMind account has been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Do not return password by default in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'auditor'],
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    otpHash: {
      type: String,
      select: false,
    },
    otpPurpose: {
      type: String,
      enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGE'],
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
    otpResendAfter: {
      type: Date,
      select: false,
    },
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpiresAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.otpHash;
        delete ret.otpPurpose;
        delete ret.otpAttempts;
        delete ret.otpExpiresAt;
        delete ret.otpResendAfter;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate 6-digit OTP for a specific purpose
userSchema.methods.generateOtp = function (purpose = 'EMAIL_VERIFICATION') {
  // Generate random 6-digit numeric string (100000 - 999999)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP for secure storage
  const hash = crypto.createHash('sha256').update(otp).digest('hex');

  this.otpHash = hash;
  this.otpPurpose = purpose;
  this.otpAttempts = 0;
  this.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
  this.otpResendAfter = new Date(Date.now() + 60 * 1000); // 60 seconds cooldown

  return otp;
};

// Verify entered OTP with strict purpose segregation and attempt limits
userSchema.methods.verifyOtp = function (enteredOtp, expectedPurpose = 'EMAIL_VERIFICATION') {
  if (!this.otpHash || !this.otpExpiresAt || !this.otpPurpose) {
    return { valid: false, reason: 'no_otp' };
  }

  // Enforce purpose segregation
  if (this.otpPurpose !== expectedPurpose) {
    return { valid: false, reason: 'purpose_mismatch' };
  }

  // Check expiration
  if (new Date() > this.otpExpiresAt) {
    return { valid: false, reason: 'expired' };
  }

  // Check attempt limits (max 5 attempts)
  if (this.otpAttempts >= 5) {
    // Invalidate OTP on excessive failed attempts
    this.otpHash = undefined;
    this.otpPurpose = undefined;
    this.otpExpiresAt = undefined;
    this.otpAttempts = 0;
    return { valid: false, reason: 'max_attempts' };
  }

  const enteredHash = crypto.createHash('sha256').update(enteredOtp.trim()).digest('hex');
  if (enteredHash !== this.otpHash) {
    this.otpAttempts = (this.otpAttempts || 0) + 1;
    const remainingAttempts = Math.max(0, 5 - this.otpAttempts);

    if (remainingAttempts === 0) {
      this.otpHash = undefined;
      this.otpPurpose = undefined;
      this.otpExpiresAt = undefined;
      this.otpAttempts = 0;
    }

    return { valid: false, reason: 'invalid', remainingAttempts };
  }

  // Clear OTP fields upon successful verification
  this.otpHash = undefined;
  this.otpPurpose = undefined;
  this.otpExpiresAt = undefined;
  this.otpResendAfter = undefined;
  this.otpAttempts = 0;

  if (expectedPurpose === 'EMAIL_VERIFICATION') {
    this.isEmailVerified = true;
  }

  return { valid: true };
};

// Generate short-lived scoped reset token after OTP verification for forgot-password
userSchema.methods.generateResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  return rawToken;
};

// Verify short-lived reset token
userSchema.methods.verifyResetToken = function (rawToken) {
  if (!this.resetTokenHash || !this.resetTokenExpiresAt) {
    return false;
  }

  if (new Date() > this.resetTokenExpiresAt) {
    return false;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  if (tokenHash !== this.resetTokenHash) {
    return false;
  }

  this.resetTokenHash = undefined;
  this.resetTokenExpiresAt = undefined;
  return true;
};

// Generate JWT authentication token
userSchema.methods.generateAuthToken = function () {
  const secret = process.env.JWT_SECRET || 'tracemind_default_jwt_secret_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    secret,
    { expiresIn }
  );
};

const User = mongoose.model('User', userSchema);

export default User;

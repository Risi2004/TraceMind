import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { InputField } from '../components/auth/InputField';
import { PasswordField } from '../components/auth/PasswordField';
import {
  LogoIcon,
  MailIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshIcon,
  ArrowLeftIcon,
} from '../components/common/Icons';
import '../components/auth/AuthForm.css';
import './ForgotPasswordPage.css';

export const ForgotPasswordPage = ({ onNavigate, prefillEmail = '' }) => {
  const { forgotPasswordSendOtp, forgotPasswordVerifyOtp, forgotPasswordReset } = useAuth();

  // Wizard steps: 'email' | 'otp' | 'new_password' | 'success'
  const [step, setStep] = useState('email');

  // Form states
  const [email, setEmail] = useState(prefillEmail);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // Cooldown countdown timer (60s)
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef([]);

  // Cooldown interval effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Handle Send OTP (Step 1)
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email || !email.trim()) {
      setServerError('Please enter your registered email address.');
      return;
    }

    setServerError('');
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordSendOtp(email.trim());
      setSuccessInfo(response.message || 'Reset code sent to your email.');
      setCooldown(60);
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      if (err.data?.remainingSeconds) {
        setCooldown(err.data.remainingSeconds);
      }
      setServerError(err.message || 'Failed to send password reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP digit changes
  const handleDigitChange = (index, value) => {
    const rawVal = value.replace(/\D/g, '');
    const char = rawVal ? rawVal[rawVal.length - 1] : '';

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setServerError('');

    // Auto advance to next box
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);
    setServerError('');

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Handle Verify OTP (Step 2)
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const otpCode = digits.join('');
    if (otpCode.length !== 6) {
      setServerError('Please enter the full 6-digit verification code.');
      return;
    }

    setServerError('');
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordVerifyOtp({
        email: email.trim(),
        otp: otpCode,
      });

      if (response.resetToken) {
        setResetToken(response.resetToken);
        setSuccessInfo('Code verified successfully. Please choose a new password.');
        setStep('new_password');
      } else {
        throw new Error('Verification failed. Missing reset session token.');
      }
    } catch (err) {
      setServerError(err.message || 'Invalid or expired reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setServerError('');

    try {
      const response = await forgotPasswordSendOtp(email.trim());
      setSuccessInfo(response.message || 'A fresh reset code was sent to your email.');
      setCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      if (err.data?.remainingSeconds) {
        setCooldown(err.data.remainingSeconds);
      }
      setServerError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Reset Password (Step 3)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setServerError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setServerError('New passwords do not match. Please verify.');
      return;
    }

    setServerError('');
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordReset({
        email: email.trim(),
        resetToken,
        newPassword,
      });
      setSuccessInfo(response.message || 'Password updated successfully!');
      setStep('success');
    } catch (err) {
      setServerError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="forgot-password-page-container">
      {/* Background ambient glows */}
      <div className="forgot-glow-1" aria-hidden="true"></div>
      <div className="forgot-glow-2" aria-hidden="true"></div>

      <div className="forgot-password-card">
        {/* Top Back Navigation Link */}
        <div className="forgot-password-header-nav">
          <button
            type="button"
            className="btn-back-link"
            onClick={() => onNavigate('login')}
          >
            <ArrowLeftIcon size={16} />
            <span>Back to Sign In</span>
          </button>
        </div>

        {/* TraceMind Brand Header */}
        <div className="forgot-password-branding">
          <div className="brand-logo-container">
            <LogoIcon size={44} />
          </div>
          <h1 className="brand-title">TraceMind</h1>
          <p className="brand-subtitle">Account Recovery & Security</p>
        </div>

        {/* Step Indicator Pills */}
        <div className="step-indicator-bar">
          <div className={`step-pill ${step === 'email' ? 'active' : step !== 'email' ? 'completed' : ''}`}>
            1. Email
          </div>
          <div className={`step-divider ${step === 'otp' || step === 'new_password' || step === 'success' ? 'completed' : ''}`} />
          <div className={`step-pill ${step === 'otp' ? 'active' : (step === 'new_password' || step === 'success') ? 'completed' : ''}`}>
            2. Verify Code
          </div>
          <div className={`step-divider ${step === 'new_password' || step === 'success' ? 'completed' : ''}`} />
          <div className={`step-pill ${step === 'new_password' || step === 'success' ? 'active' : ''}`}>
            3. New Password
          </div>
        </div>

        {/* Success / Error Alerts */}
        {successInfo && (
          <div className="forgot-feedback-alert success" role="alert">
            <CheckCircleIcon size={18} />
            <span>{successInfo}</span>
          </div>
        )}

        {serverError && (
          <div className="forgot-feedback-alert error" role="alert">
            <AlertCircleIcon size={18} />
            <span>{serverError}</span>
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="forgot-form-body">
            <div className="step-prompt">
              <h2 className="step-heading">Reset your password</h2>
              <p className="step-description">
                Enter your verified TraceMind email address. We'll send you a 6-digit security code to verify your identity.
              </p>
            </div>

            <InputField
              id="forgot-email"
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setServerError(''); }}
              icon={MailIcon}
              required
              autoComplete="email"
            />

            <button
              type="submit"
              className={`btn-auth-submit ${isSubmitting ? 'is-loading' : ''}`}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <span>Send Verification Code</span>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Enter 6-Digit OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="forgot-form-body">
            <div className="step-prompt">
              <h2 className="step-heading">Check your email</h2>
              <p className="step-description">
                We sent a 6-digit security code to <strong className="highlight-email">{email}</strong>. Enter the code below within 10 minutes.
              </p>
            </div>

            <div className="otp-input-row" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`otp-digit-box ${digit ? 'filled' : ''} ${serverError ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  aria-label={`Digit ${index + 1}`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            <button
              type="submit"
              className={`btn-auth-submit ${isSubmitting ? 'is-loading' : ''}`}
              disabled={isSubmitting || digits.join('').length !== 6}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify Code & Continue</span>
              )}
            </button>

            {/* Resend OTP Section */}
            <div className="otp-resend-container">
              {cooldown > 0 ? (
                <p className="otp-cooldown-text">
                  Resend code in <span className="cooldown-timer">{cooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  className="btn-resend-otp"
                  onClick={handleResendOtp}
                  disabled={isResending}
                >
                  <RefreshIcon size={14} className={isResending ? 'spinning' : ''} />
                  <span>{isResending ? 'Sending...' : 'Resend Verification Code'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-switch-email"
              onClick={() => { setStep('email'); setServerError(''); }}
            >
              Entered the wrong email? Change email
            </button>
          </form>
        )}

        {/* STEP 3: Enter New Password */}
        {step === 'new_password' && (
          <form onSubmit={handleResetPassword} className="forgot-form-body">
            <div className="step-prompt">
              <h2 className="step-heading">Set new password</h2>
              <p className="step-description">
                Your email has been verified. Choose a strong password of at least 8 characters.
              </p>
            </div>

            <PasswordField
              id="newPassword"
              label="New Password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setServerError(''); }}
              required
              autoComplete="new-password"
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setServerError(''); }}
              required
              autoComplete="new-password"
            />

            <button
              type="submit"
              className={`btn-auth-submit ${isSubmitting ? 'is-loading' : ''}`}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        )}

        {/* STEP 4: Success Confirmation */}
        {step === 'success' && (
          <div className="forgot-success-body">
            <div className="success-icon-badge">
              <CheckCircleIcon size={44} />
            </div>
            <h2 className="step-heading">Password Reset Complete!</h2>
            <p className="step-description">
              Your TraceMind password has been successfully updated. You can now use your new password to sign in.
            </p>
            <button
              type="button"
              className="btn-auth-submit"
              onClick={() => onNavigate('login')}
            >
              <span>Proceed to Sign In</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

import { useState, useEffect, useRef } from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { MailIcon, CheckCircleIcon, AlertCircleIcon, RefreshIcon } from '../components/common/Icons';
import { useAuth } from '../context/useAuth';
import './VerifyOtpPage.css';

export const VerifyOtpPage = ({ onNavigate, initialEmail = '' }) => {
  const { verifyOtp, resendOtp } = useAuth();

  // Extract email from query param or props or storage
  const getInitialEmail = () => {
    if (initialEmail) return initialEmail;
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get('email');
    if (queryEmail) return queryEmail;
    return sessionStorage.getItem('tracemind_pending_email') || '';
  };

  const [email] = useState(getInitialEmail);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Cooldown countdown timer (60s)
  const [resendCooldown, setResendCooldown] = useState(60);

  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = (index, value) => {
    setServerError('');
    setSuccessMessage('');

    // Handle pasted content
    if (value.length > 1) {
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...digits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setDigits(newDigits);

      const nextFocusIndex = Math.min(pastedDigits.length, 5);
      if (inputRefs.current[nextFocusIndex]) {
        inputRefs.current[nextFocusIndex].focus();
      }
      return;
    }

    // Only allow single numeric character
    const singleDigit = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    // Auto-advance to next input
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newDigits = ['', '', '', '', '', ''];
      pastedData.split('').forEach((d, i) => {
        newDigits[i] = d;
      });
      setDigits(newDigits);
      const nextFocus = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setServerError('');
    setSuccessMessage('');

    const otpCode = digits.join('');
    if (otpCode.length !== 6) {
      setServerError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!email) {
      setServerError('No email address provided. Please return to Sign In.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp({ email, otp: otpCode });
      setIsVerified(true);
      sessionStorage.removeItem('tracemind_pending_email');
      setTimeout(() => {
        onNavigate('/chat');
      }, 1000);
    } catch (err) {
      setServerError(err.message || 'Invalid or expired verification code.');
      // Focus on first input for retry
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setServerError('');
    setSuccessMessage('');
    setIsResending(true);

    try {
      const response = await resendOtp(email);
      setSuccessMessage(response.message || 'A fresh verification code has been sent to your email.');
      setResendCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setServerError(err.message || 'Failed to resend verification code. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={email ? `Enter the 6-digit code sent to ${email}` : 'Enter the 6-digit code sent to your email'}
      onNavigate={onNavigate}
    >
      {isVerified ? (
        <div className="auth-success-banner" style={{ marginTop: '1rem', padding: '1.25rem' }}>
          <CheckCircleIcon size={24} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Email Verified Successfully!</div>
            <div style={{ fontSize: '0.825rem', opacity: 0.9 }}>Preparing your document workspace...</div>
          </div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Server Error Alert Banner */}
          {serverError && (
            <div className="auth-error-banner" role="alert">
              <AlertCircleIcon size={18} />
              <span>{serverError}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="auth-success-banner" role="status">
              <CheckCircleIcon size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Email Info Bar */}
          <div className="otp-email-target-card">
            <div className="target-icon">
              <MailIcon size={16} />
            </div>
            <div className="target-details">
              <span className="target-label">Verification sent to:</span>
              <span className="target-address">{email || 'your email'}</span>
            </div>
            <button
              type="button"
              className="btn-change-email"
              onClick={() => onNavigate('/signup')}
              title="Change email address"
            >
              Change
            </button>
          </div>

          {/* 6-Digit OTP Inputs */}
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

          {/* Primary Submit Button */}
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
              <span>Verify & Continue</span>
            )}
          </button>

          {/* Resend OTP Section with Cooldown Timer */}
          <div className="otp-resend-container">
            <span className="resend-text">Didn't receive the code?</span>
            {resendCooldown > 0 ? (
              <span className="resend-cooldown-badge">
                Resend in <strong>{resendCooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                className="btn-resend-action"
                onClick={handleResendOtp}
                disabled={isResending}
              >
                <RefreshIcon size={14} className={isResending ? 'spinning' : ''} />
                <span>{isResending ? 'Sending...' : 'Resend Code'}</span>
              </button>
            )}
          </div>

          {/* Return to Sign In Link */}
          <p className="auth-switch-prompt" style={{ marginTop: '0.75rem' }}>
            Already verified?
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => onNavigate('/login')}
            >
              Sign in
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};

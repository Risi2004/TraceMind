import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/useAuth';
import {
  UserIcon,
  LockIcon,
  CloseIcon,
  CheckCircleIcon,
  EditIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  TrashIcon,
  AlertTriangleIcon,
  RefreshIcon,
  MailIcon
} from '../common/Icons';
import { DeleteAccountModal } from './DeleteAccountModal';
import './ProfileModal.css';

export const ProfileModal = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
  onChangePassword,
  onDeleteAccount
}) => {
  const { changePasswordSendOtp } = useAuth();
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'password' | 'danger'

  // Edit Profile form state
  const [fullName, setFullName] = useState(user?.fullName || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Change Password multi-step state: 'request_otp' | 'otp' | 'new_password'
  const [passwordStep, setPasswordStep] = useState('request_otp');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const otpInputRefs = useRef([]);

  // Cooldown countdown effect
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (onUpdateUser) {
        await onUpdateUser({
          fullName: fullName.trim(),
          email: email.trim(),
        });
      }
      setFeedbackMessage('Profile information updated successfully!');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Send OTP to user email
  const handleSendChangePasswordOtp = async () => {
    if (otpCooldown > 0 || isSendingOtp) return;

    setIsSendingOtp(true);
    setErrorMessage(null);

    try {
      const response = await changePasswordSendOtp();
      setFeedbackMessage(response?.message || 'Authorization code sent to your email.');
      setOtpCooldown(60);
      setPasswordStep('otp');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      if (err.data?.remainingSeconds) {
        setOtpCooldown(err.data.remainingSeconds);
      }
      setErrorMessage(err.message || 'Failed to send authorization code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // OTP Digit handlers
  const handleOtpDigitChange = (index, value) => {
    const rawVal = value.replace(/\D/g, '');
    const char = rawVal ? rawVal[rawVal.length - 1] : '';

    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    setErrorMessage(null);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setOtpDigits(newDigits);
    setErrorMessage(null);

    const nextIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };

  // Step 2: Validate OTP format and move to Password Form
  const handleProceedToPasswordForm = (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter the full 6-digit authorization code.');
      return;
    }
    setErrorMessage(null);
    setPasswordStep('new_password');
  };

  // Step 3: Submit New Password with OTP and Current Password
  const handleSubmitPasswordChange = async (e) => {
    e.preventDefault();
    const otpCode = otpDigits.join('');

    if (!otpCode || otpCode.length !== 6) {
      setErrorMessage('Missing authorization code. Please restart verification.');
      setPasswordStep('otp');
      return;
    }
    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('New password cannot be the same as your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (onChangePassword) {
        await onChangePassword({
          otp: otpCode,
          currentPassword,
          newPassword,
        });
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpDigits(['', '', '', '', '', '']);
      setPasswordStep('request_otp');
      setFeedbackMessage('Password updated successfully! A confirmation email was sent.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password.');
      // If OTP failed or expired, return to OTP entry
      if (err.data?.error === 'InvalidOtp' || err.data?.error === 'OtpExpired' || err.data?.error === 'MaxAttemptsExceeded') {
        setPasswordStep('otp');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAccountDeletion = async (password) => {
    if (onDeleteAccount) {
      await onDeleteAccount(password);
      setDeleteModalOpen(false);
      onClose();
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
        <div className="profile-modal-dialog" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="profile-modal-header">
            <div className="profile-modal-title">
              <UserIcon size={20} className="header-icon" />
              <span>Account Profile</span>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* User Card Summary Banner */}
          <div className="profile-hero-banner">
            <div className="profile-avatar-large">
              <span>{user?.initials || 'TM'}</span>
            </div>
            <div className="profile-hero-details">
              <h3 className="profile-hero-name">{user?.fullName || user?.name}</h3>
              <p className="profile-hero-email">{user?.email}</p>
              <div className="profile-badges-row">
                <span className="badge-pill badge-primary">
                  <ShieldCheckIcon size={12} />
                  <span>{user?.role || 'Member'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Feedback Alert Banners */}
          {feedbackMessage && (
            <div className="profile-feedback-alert success" role="alert">
              <CheckCircleIcon size={16} />
              <span>{feedbackMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="profile-feedback-alert error" role="alert">
              <AlertCircleIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section Navigation Tabs */}
          <div className="profile-modal-tabs">
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => { setActiveTab('edit'); setErrorMessage(null); }}
            >
              <EditIcon size={15} />
              <span>Edit Profile</span>
            </button>
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => { setActiveTab('password'); setErrorMessage(null); }}
            >
              <LockIcon size={15} />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              className={`profile-tab-btn danger-tab ${activeTab === 'danger' ? 'active' : ''}`}
              onClick={() => { setActiveTab('danger'); setErrorMessage(null); }}
            >
              <TrashIcon size={15} />
              <span>Danger Zone</span>
            </button>
          </div>

          {/* Modal Body Forms */}
          <div className="profile-modal-body">
            {/* TAB 1: Edit Profile */}
            {activeTab === 'edit' && (
              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="form-group">
                  <label htmlFor="prof-name" className="form-label">Full Name</label>
                  <input
                    id="prof-name"
                    type="text"
                    className="profile-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prof-email" className="form-label">Email Address</label>
                  <input
                    id="prof-email"
                    type="email"
                    className="profile-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-actions-right">
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn-primary-action ${isSubmitting ? 'is-loading' : ''}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Change Password with Mandatory OTP Verification */}
            {activeTab === 'password' && (
              <div className="profile-change-password-flow">
                {/* Step 1: Request OTP */}
                {passwordStep === 'request_otp' && (
                  <div className="password-security-prompt">
                    <div className="security-prompt-card">
                      <div className="security-icon-circle">
                        <MailIcon size={24} />
                      </div>
                      <h4 className="security-prompt-title">Mandatory Email Verification</h4>
                      <p className="security-prompt-desc">
                        To protect your account, TraceMind requires a 6-digit authorization code sent to <strong className="user-email-highlight">{user?.email}</strong> before you can change your password.
                      </p>
                      <button
                        type="button"
                        className={`btn-send-security-otp ${isSendingOtp ? 'is-loading' : ''}`}
                        onClick={handleSendChangePasswordOtp}
                        disabled={isSendingOtp}
                      >
                        {isSendingOtp ? (
                          <>
                            <span className="btn-spinner" aria-hidden="true" />
                            <span>Sending Authorization Code...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheckIcon size={16} />
                            <span>Send Authorization Code to Email</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Enter 6-Digit OTP */}
                {passwordStep === 'otp' && (
                  <form onSubmit={handleProceedToPasswordForm} className="password-otp-form">
                    <div className="password-otp-heading">
                      <h4 className="otp-title">Enter 6-Digit Authorization Code</h4>
                      <p className="otp-subtitle">
                        Enter the security code sent to <strong>{user?.email}</strong>:
                      </p>
                    </div>

                    <div className="otp-input-row" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (otpInputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className={`otp-digit-box ${digit ? 'filled' : ''}`}
                          aria-label={`Digit ${index + 1}`}
                          autoComplete="one-time-code"
                        />
                      ))}
                    </div>

                    <div className="otp-resend-row">
                      {otpCooldown > 0 ? (
                        <span className="otp-cooldown-text">
                          Resend code in <strong className="cooldown-count">{otpCooldown}s</strong>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-link-resend"
                          onClick={handleSendChangePasswordOtp}
                          disabled={isSendingOtp}
                        >
                          <RefreshIcon size={13} className={isSendingOtp ? 'spinning' : ''} />
                          <span>Resend Code</span>
                        </button>
                      )}
                    </div>

                    <div className="form-actions-right">
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => setPasswordStep('request_otp')}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="btn-primary-action"
                        disabled={otpDigits.join('').length !== 6}
                      >
                        Verify & Continue &rarr;
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 3: Enter Current and New Password */}
                {passwordStep === 'new_password' && (
                  <form onSubmit={handleSubmitPasswordChange} className="profile-form">
                    <div className="verified-otp-badge">
                      <CheckCircleIcon size={14} />
                      <span>Authorization Code Verified: {otpDigits.join('')}</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="curr-pass" className="form-label">Current Password</label>
                      <div className="input-password-wrapper">
                        <input
                          id="curr-pass"
                          type={showCurrentPassword ? 'text' : 'password'}
                          className="profile-input"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••••••"
                          disabled={isSubmitting}
                          required
                        />
                        <button
                          type="button"
                          className="btn-toggle-eye"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label="Toggle current password visibility"
                        >
                          {showCurrentPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="new-pass" className="form-label">New Password</label>
                      <div className="input-password-wrapper">
                        <input
                          id="new-pass"
                          type={showNewPassword ? 'text' : 'password'}
                          className="profile-input"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          disabled={isSubmitting}
                          required
                        />
                        <button
                          type="button"
                          className="btn-toggle-eye"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label="Toggle new password visibility"
                        >
                          {showNewPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirm-new-pass" className="form-label">Confirm New Password</label>
                      <div className="input-password-wrapper">
                        <input
                          id="confirm-new-pass"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="profile-input"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          disabled={isSubmitting}
                          required
                        />
                        <button
                          type="button"
                          className="btn-toggle-eye"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label="Toggle confirm password visibility"
                        >
                          {showConfirmPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-actions-right">
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => setPasswordStep('otp')}
                        disabled={isSubmitting}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className={`btn-primary-action ${isSubmitting ? 'is-loading' : ''}`}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: Danger Zone */}
            {activeTab === 'danger' && (
              <div className="danger-zone-content">
                <div className="danger-card">
                  <div className="danger-card-info">
                    <div className="danger-badge-title">
                      <AlertTriangleIcon size={16} />
                      <span>Permanently Delete Account</span>
                    </div>
                    <p className="danger-card-desc">
                      Once you delete your account, there is no going back. All of your personal documents, conversations, and account configurations will be purged permanently.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-open-delete-modal"
                    onClick={() => setDeleteModalOpen(true)}
                  >
                    <TrashIcon size={16} />
                    <span>Delete Account</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmAccountDeletion}
      />
    </>
  );
};

export default ProfileModal;

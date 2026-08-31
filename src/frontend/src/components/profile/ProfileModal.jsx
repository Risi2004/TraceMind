import { useState, useEffect } from 'react';
import {
  UserIcon,
  LockIcon,
  CloseIcon,
  CheckCircleIcon,
  EditIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeOffIcon
} from '../common/Icons';
import './ProfileModal.css';

export const ProfileModal = ({
  user,
  isOpen,
  onClose,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'password'

  // Edit Profile form state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || '');

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Feedback states
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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

  const handleSaveProfile = (e) => {
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
    const names = fullName.trim().split(' ');
    const initials = names.length > 1
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : names[0].slice(0, 2).toUpperCase();

    onUpdateUser({
      ...user,
      fullName: fullName.trim(),
      email: email.trim(),
      department: department.trim(),
      initials
    });

    setFeedbackMessage('Profile information updated successfully!');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setErrorMessage(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFeedbackMessage('Password updated successfully!');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  return (
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
            <span>{user.initials || 'TM'}</span>
          </div>
          <div className="profile-hero-details">
            <h3 className="profile-hero-name">{user.fullName}</h3>
            <p className="profile-hero-email">{user.email}</p>
            <div className="profile-badges-row">
              <span className="badge-pill badge-primary">
                <ShieldCheckIcon size={12} />
                <span>{user.role}</span>
              </span>
              <span className="badge-pill badge-plan">{user.plan}</span>
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
        </div>

        {/* Modal Body Forms */}
        <div className="profile-modal-body">
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
                />
              </div>

              <div className="form-group">
                <label htmlFor="prof-dept" className="form-label">Department / Team</label>
                <input
                  id="prof-dept"
                  type="text"
                  className="profile-input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Security & Architecture"
                />
              </div>

              <div className="form-actions-right">
                <button type="button" className="btn-secondary-action" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="profile-form">
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
                <button type="button" className="btn-secondary-action" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  Update Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import {
  AlertTriangleIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon
} from '../common/Icons';
import './DeleteAccountModal.css';

export const DeleteAccountModal = ({
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setErrorMessage('Please enter your account password to confirm deletion.');
      return;
    }

    setErrorMessage('');
    setIsDeleting(true);

    try {
      await onConfirmDelete(password);
      // Navigation is handled by parent after successful deletion
    } catch (err) {
      setErrorMessage(err.message || 'Incorrect password. Account deletion failed.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="delete-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="delete-modal-header">
          <div className="delete-modal-title">
            <div className="delete-warning-icon">
              <AlertTriangleIcon size={20} />
            </div>
            <span>Delete Account Permanently</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            disabled={isDeleting}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Warning Content */}
        <div className="delete-modal-body">
          <p className="delete-warning-description">
            This action is <strong>irreversible</strong>. Deleting your account will immediately and permanently erase:
          </p>
          <ul className="delete-consequences-list">
            <li>Your user profile and security credentials</li>
            <li>All document conversation histories and saved investigation threads</li>
            <li>Customized scope preferences and workspace settings</li>
          </ul>

          {/* Error Message */}
          {errorMessage && (
            <div className="delete-error-alert" role="alert">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Confirmation Form */}
          <form onSubmit={handleSubmit} className="delete-account-form">
            <div className="delete-field-group">
              <label htmlFor="confirm-delete-pass" className="delete-field-label">
                Confirm your password to proceed:
              </label>
              <div className="delete-input-wrapper">
                <LockIcon size={16} className="delete-input-icon" />
                <input
                  id="confirm-delete-pass"
                  type={showPassword ? 'text' : 'password'}
                  className="delete-password-input"
                  placeholder="Enter your current password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  disabled={isDeleting}
                  autoFocus
                />
                <button
                  type="button"
                  className="delete-eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="delete-modal-actions">
              <button
                type="button"
                className="btn-cancel-delete"
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-confirm-delete"
                disabled={isDeleting || !password}
              >
                {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

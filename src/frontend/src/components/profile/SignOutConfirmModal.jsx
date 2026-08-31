import { useEffect } from 'react';
import { LogOutIcon, AlertCircleIcon } from '../common/Icons';
import './SignOutConfirmModal.css';

export const SignOutConfirmModal = ({
  isOpen,
  onClose,
  onConfirmSignOut
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="signout-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="signout-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="signout-icon-badge">
          <AlertCircleIcon size={24} className="alert-icon" />
        </div>

        <h3 className="signout-title">Sign out of TraceMind?</h3>
        <p className="signout-description">
          You are about to end your active workspace session. Any unsaved conversation drafts will be cleared.
        </p>

        <div className="signout-actions">
          <button
            type="button"
            className="btn-signout-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-signout-confirm"
            onClick={onConfirmSignOut}
          >
            <LogOutIcon size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

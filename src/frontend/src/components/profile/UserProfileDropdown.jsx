import { useEffect, useRef } from 'react';
import { UserIcon, SettingsIcon, LogOutIcon } from '../common/Icons';
import './UserProfileDropdown.css';

export const UserProfileDropdown = ({
  user,
  isOpen,
  onClose,
  onOpenProfile,
  onOpenSettings,
  onOpenSignOut
}) => {
  const dropdownRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="profile-dropdown-menu"
      role="menu"
      aria-label="User Account Menu"
    >
      {/* User Header Summary */}
      <div className="dropdown-user-header">
        <div className="dropdown-avatar">{user.initials || 'TM'}</div>
        <div className="dropdown-user-info">
          <span className="dropdown-user-name">{user.fullName}</span>
          <span className="dropdown-user-email">{user.email}</span>
          <span className="dropdown-plan-badge">{user.plan}</span>
        </div>
      </div>

      <div className="dropdown-divider"></div>

      {/* Menu Actions */}
      <div className="dropdown-actions-list">
        <button
          type="button"
          className="dropdown-item"
          onClick={() => {
            onClose();
            onOpenProfile();
          }}
          role="menuitem"
        >
          <UserIcon size={16} className="dropdown-item-icon" />
          <span>My Profile</span>
        </button>

        <button
          type="button"
          className="dropdown-item"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          role="menuitem"
        >
          <SettingsIcon size={16} className="dropdown-item-icon" />
          <span>Settings</span>
        </button>
      </div>

      <div className="dropdown-divider"></div>

      {/* Sign Out Action */}
      <button
        type="button"
        className="dropdown-item dropdown-item-danger"
        onClick={() => {
          onClose();
          onOpenSignOut();
        }}
        role="menuitem"
      >
        <LogOutIcon size={16} className="dropdown-item-icon" />
        <span>Sign Out</span>
      </button>
    </div>
  );
};

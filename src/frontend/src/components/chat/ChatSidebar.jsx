import { useState, useEffect, useRef } from 'react';
import {
  LogoIcon,
  PlusIcon,
  MessageSquareIcon,
  FileTextIcon,
  HistoryIcon,
  SettingsIcon,
  SidebarToggleIcon,
  CloseIcon,
  EditIcon,
  TrashIcon,
  CheckIcon
} from '../common/Icons';
import { UserProfileDropdown } from '../profile/UserProfileDropdown';
import { MOCK_USER_PROFILE } from '../../mock/chatMockData';
import './ChatSidebar.css';

/**
 * Format timestamp into dynamic relative human-readable time
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Just now';

  let date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    if (timestamp === 'Just now' || timestamp === 'Recent') {
      return 'Just now';
    }
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  }

  if (!date || isNaN(date.getTime())) {
    return 'Just now';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 45 * 1000) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  const isSameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' })
  });
};

export const ChatSidebar = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  activeView,
  onSelectView,
  onNewChat,
  onSelectHistory,
  onRenameHistory,
  onDeleteHistory,
  activeSessionId,
  onNavigate,
  user = MOCK_USER_PROFILE,
  onOpenProfile,
  onOpenSignOut,
  history = []
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [ticker, setTicker] = useState(0);
  const editInputRef = useRef(null);

  // Auto-refresh relative time labels every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (e, item) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title || '');
  };

  const handleSaveRename = (e, item) => {
    e?.stopPropagation();
    const trimmed = editingTitle.trim();
    if (trimmed && onRenameHistory) {
      onRenameHistory(item.id, trimmed);
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const handleKeyDownRename = (e, item) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(e, item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename(e);
    }
  };

  const handleDelete = (e, item) => {
    e.stopPropagation();
    if (window.confirm(`Delete conversation "${item.title}"?`)) {
      if (onDeleteHistory) {
        onDeleteHistory(item.id);
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="chat-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        ></div>
      )}

      <aside className={`chat-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Header */}
        <div className="chat-sidebar-header">
          {!collapsed && (
            <button
              type="button"
              className="chat-brand"
              onClick={() => onNavigate('/')}
              title="TraceMind Home"
            >
              <LogoIcon size={26} />
              <span className="chat-brand-name">TraceMind</span>
              <span className="chat-brand-badge">AI</span>
            </button>
          )}

          {collapsed && (
            <button
              type="button"
              className="chat-brand-icon-only"
              onClick={() => onNavigate('/')}
              title="TraceMind Home"
            >
              <LogoIcon size={26} />
            </button>
          )}

          {/* Collapse Toggle for Desktop */}
          <button
            type="button"
            className="sidebar-collapse-btn desktop-only"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <SidebarToggleIcon size={18} />
          </button>

          {/* Close for Mobile */}
          <button
            type="button"
            className="sidebar-close-btn mobile-only"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* New Chat Primary Action */}
        <div className="chat-sidebar-action">
          <button
            type="button"
            className="btn-sidebar-new-chat"
            onClick={onNewChat}
            title="Start New Chat"
          >
            <PlusIcon size={18} />
            {!collapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="chat-sidebar-nav" aria-label="Dashboard Navigation">
          <button
            type="button"
            className={`nav-item ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => onSelectView('chat')}
            title="Current Chat"
          >
            <MessageSquareIcon size={18} />
            {!collapsed && <span>Active Chat</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeView === 'documents' ? 'active' : ''}`}
            onClick={() => onSelectView('documents')}
            title="Document Repository"
          >
            <FileTextIcon size={18} />
            {!collapsed && <span>Documents</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectView('settings')}
            title="Settings"
          >
            <SettingsIcon size={18} />
            {!collapsed && <span>Settings</span>}
          </button>
        </nav>

        {/* History Section */}
        {!collapsed && (
          <div className="chat-history-section">
            <div className="history-header">
              <HistoryIcon size={14} />
              <span>Recent Conversations</span>
            </div>

            <div className="history-list">
              {history.length > 0 ? (
                history.map((item) => {
                  const isActive = activeSessionId === item.id;
                  const isEditing = editingId === item.id;
                  const timeLabel = formatRelativeTime(item.lastUpdated || item.createdAt || item.date);

                  return (
                    <div
                      key={item.id}
                      className={`history-item-container ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
                      onClick={() => !isEditing && onSelectHistory(item)}
                      title={!isEditing ? item.title : ''}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
                          onSelectHistory(item);
                        }
                      }}
                    >
                      {isEditing ? (
                        <div className="history-edit-row" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={editInputRef}
                            type="text"
                            className="history-rename-input"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyDownRename(e, item)}
                            aria-label="Rename conversation"
                          />
                          <div className="history-edit-actions">
                            <button
                              type="button"
                              className="btn-history-icon-action save"
                              onClick={(e) => handleSaveRename(e, item)}
                              title="Save Title (Enter)"
                            >
                              <CheckIcon size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-history-icon-action cancel"
                              onClick={handleCancelRename}
                              title="Cancel (Esc)"
                            >
                              <CloseIcon size={13} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="history-item-content">
                            <span className="history-item-title">{item.title}</span>
                            <span className="history-item-meta">{timeLabel}</span>
                          </div>

                          <div className="history-item-actions">
                            <button
                              type="button"
                              className="btn-history-action"
                              onClick={(e) => handleStartRename(e, item)}
                              title="Rename Conversation"
                              aria-label="Rename Conversation"
                            >
                              <EditIcon size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-history-action delete"
                              onClick={(e) => handleDelete(e, item)}
                              title="Delete Conversation"
                              aria-label="Delete Conversation"
                            >
                              <TrashIcon size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="history-empty-note">
                  <span>No conversations yet</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* User Profile Footer & Dropdown Popover */}
        <div className="chat-sidebar-footer">
          <button
            type="button"
            className={`user-profile-widget ${profileDropdownOpen ? 'active' : ''}`}
            onClick={() => setProfileDropdownOpen(prev => !prev)}
            aria-haspopup="true"
            aria-expanded={profileDropdownOpen}
            aria-label="User Account Options"
          >
            <div className="user-avatar" title={user.fullName}>
              <span>{user.initials || 'TM'}</span>
            </div>
            {!collapsed && (
              <div className="user-details">
                <span className="user-name">{user.fullName}</span>
                <span className="user-email-subtitle" title={user.email}>{user.email}</span>
              </div>
            )}
          </button>

          {/* Profile Dropdown Menu */}
          <UserProfileDropdown
            user={user}
            isOpen={profileDropdownOpen}
            onClose={() => setProfileDropdownOpen(false)}
            onOpenProfile={onOpenProfile}
            onOpenSettings={() => onSelectView('settings')}
            onOpenSignOut={onOpenSignOut}
          />
        </div>
      </aside>
    </>
  );
};

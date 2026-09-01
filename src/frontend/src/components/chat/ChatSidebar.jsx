import { useState } from 'react';
import {
  LogoIcon,
  PlusIcon,
  MessageSquareIcon,
  HistoryIcon,
  SettingsIcon,
  SidebarToggleIcon,
  CloseIcon
} from '../common/Icons';
import { UserProfileDropdown } from '../profile/UserProfileDropdown';
import { MOCK_HISTORY, MOCK_USER_PROFILE } from '../../mock/chatMockData';
import './ChatSidebar.css';

export const ChatSidebar = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  activeView,
  onSelectView,
  onNewChat,
  onSelectHistory,
  onNavigate,
  user = MOCK_USER_PROFILE,
  onOpenProfile,
  onOpenSignOut
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

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
              {MOCK_HISTORY.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="history-item"
                  onClick={() => onSelectHistory(item)}
                  title={item.title}
                >
                  <span className="history-item-title">{item.title}</span>
                  <span className="history-item-meta">{item.date}</span>
                </button>
              ))}
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

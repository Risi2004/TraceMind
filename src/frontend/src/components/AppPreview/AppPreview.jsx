import { useState } from 'react';
import {
  HistoryIcon,
  SettingsIcon,
  PlusIcon,
  SendIcon,
  PaperclipIcon,
  SparklesIcon,
  LogoIcon
} from '../common/Icons';
import './AppPreview.css';

export const AppPreview = ({ onNavigate = () => {} }) => {
  const [activeNav, setActiveNav] = useState('new');
  const [query, setQuery] = useState('');

  const suggestions = [
    "Summarize Q3 Financial Report",
    "Extract key compliance risks",
    "Compare Section 4 clauses"
  ];

  const handleChipClick = (suggestion) => {
    setQuery(suggestion);
    setTimeout(() => onNavigate('/chat'), 200);
  };

  return (
    <div className="preview-window">
      {/* Window Title Bar */}
      <div className="preview-header">
        <div className="window-controls">
          <span className="dot dot-close"></span>
          <span className="dot dot-minimize"></span>
          <span className="dot dot-maximize"></span>
        </div>
        <div className="window-title">
          <LogoIcon size={16} />
          <span>TraceMind Workspace</span>
        </div>
        <div className="status-badge">
          <span className="status-dot"></span>
          <span className="status-text">AI Connected</span>
        </div>
      </div>

      {/* Main App Body */}
      <div className="preview-body">
        {/* Left Sidebar */}
        <aside className="preview-sidebar" aria-label="App Navigation">
          <button
            type="button"
            className={`btn-new-chat ${activeNav === 'new' ? 'active' : ''}`}
            onClick={() => { setActiveNav('new'); setQuery(''); }}
          >
            <PlusIcon size={16} />
            <span>New Chat</span>
          </button>

          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-nav-item ${activeNav === 'history' ? 'active' : ''}`}
              onClick={() => setActiveNav('history')}
            >
              <HistoryIcon size={16} />
              <span>History</span>
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveNav('settings')}
            >
              <SettingsIcon size={16} />
              <span>Settings</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile-preview">
              <div className="avatar">TM</div>
              <div className="user-info">
                <span className="user-name">TraceMind Pro</span>
                <span className="user-plan">Enterprise Plan</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Chat Panel */}
        <main className="preview-main">
          <div className="assistant-welcome">
            <div className="ai-avatar-glow">
              <SparklesIcon size={24} className="sparkle-ai-icon" />
            </div>
            <h3 className="assistant-heading">How can I help you today?</h3>
            <p className="assistant-subheading">
              Search, analyze, and extract insights across all your connected documents.
            </p>
          </div>

          {/* Suggestion Chips */}
          <div className="chips-container" role="list">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="suggestion-chip"
                onClick={() => handleChipClick(item)}
              >
                <SparklesIcon size={13} className="chip-sparkle" />
                <span>{item}</span>
              </button>
            ))}
          </div>

          {/* Question Input Bar */}
          <form className="question-input-wrapper" onSubmit={(e) => e.preventDefault()}>
            <div className="input-field-container">
              <input
                type="text"
                className="question-input"
                placeholder="Ask a question about your uploaded documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Ask a document question"
              />
              <div className="input-actions">
                <button type="button" className="btn-icon-action" title="Attach Document" aria-label="Attach Document">
                  <PaperclipIcon size={17} />
                </button>
                <button type="submit" className="btn-send-action" title="Send Question" aria-label="Send Question">
                  <SendIcon size={15} />
                </button>
              </div>
            </div>
          </form>

          {/* Footer Note */}
          <p className="preview-footer-note">
            TraceMind AI provides sourced answers with verifiable document citations.
          </p>
        </main>
      </div>
    </div>
  );
};

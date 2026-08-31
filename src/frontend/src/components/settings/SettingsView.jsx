import { useState } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import {
  SettingsIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  LayersIcon,
  SparklesIcon,
  MessageSquareIcon
} from '../common/Icons';
import { MOCK_COLLECTIONS } from '../../mock/chatMockData';
import './SettingsView.css';

export const SettingsView = ({
  settings,
  onUpdateSetting,
  onClearHistory,
  onBackToChat
}) => {
  const [toastMessage, setToastMessage] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleThemeChange = (theme) => {
    onUpdateSetting('theme', theme);
    showToast(`Theme updated to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
  };

  const handleScopeChange = (e) => {
    onUpdateSetting('defaultScope', e.target.value);
    showToast('Default search scope updated');
  };

  const handleToggle = (key, value, label) => {
    onUpdateSetting(key, value);
    showToast(`${label} ${value ? 'enabled' : 'disabled'}`);
  };

  const handleExecuteClear = () => {
    onClearHistory();
    setConfirmClearOpen(false);
    showToast('Chat history cleared successfully');
  };

  return (
    <div className="settings-view-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="settings-toast-banner" role="status">
          <CheckCircleIcon size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="settings-header-bar">
        <div className="settings-header-left">
          <button
            type="button"
            className="btn-back-chat"
            onClick={onBackToChat}
            title="Return to Active Chat"
          >
            <ArrowLeftIcon size={16} />
            <span>Back to Chat</span>
          </button>
          <div className="settings-title-group">
            <h2 className="settings-page-title">
              <SettingsIcon size={22} className="title-icon" />
              <span>Workspace Settings</span>
            </h2>
            <p className="settings-page-subtitle">
              Manage interface preferences, AI reasoning behavior, and local conversation history.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid Content */}
      <div className="settings-content-grid">
        {/* 1. General Settings Section */}
        <section className="settings-card-section" aria-labelledby="heading-general">
          <div className="card-section-header">
            <LayersIcon size={18} className="section-icon" />
            <h3 id="heading-general" className="section-title">General Preferences</h3>
          </div>

          <div className="settings-group">
            {/* Theme Selector */}
            <div className="settings-item">
              <div className="item-text-group">
                <span className="item-label">Interface Theme</span>
                <span className="item-description">
                  Choose visual appearance for the TraceMind workspace.
                </span>
              </div>

              <div className="theme-toggle-group" role="radiogroup" aria-label="Interface Theme">
                <button
                  type="button"
                  className={`theme-option-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                  role="radio"
                  aria-checked={settings.theme === 'dark'}
                >
                  <MoonIcon size={15} />
                  <span>Dark</span>
                </button>

                <button
                  type="button"
                  className={`theme-option-btn ${settings.theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                  role="radio"
                  aria-checked={settings.theme === 'light'}
                >
                  <SunIcon size={15} />
                  <span>Light</span>
                </button>

                <button
                  type="button"
                  className={`theme-option-btn ${settings.theme === 'system' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('system')}
                  role="radio"
                  aria-checked={settings.theme === 'system'}
                >
                  <MonitorIcon size={15} />
                  <span>System</span>
                </button>
              </div>
            </div>

            {/* Default Document Scope */}
            <div className="settings-item">
              <div className="item-text-group">
                <span className="item-label">Default Document Scope</span>
                <span className="item-description">
                  Initial search target automatically applied when launching new investigations.
                </span>
              </div>

              <select
                className="settings-select-dropdown"
                value={settings.defaultScope}
                onChange={handleScopeChange}
                aria-label="Default document search scope"
              >
                <option value="all">All Documents (12 documents)</option>
                {MOCK_COLLECTIONS.filter(c => c.id !== 'all').map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.count} documents)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 2. AI & Search Settings Section */}
        <section className="settings-card-section" aria-labelledby="heading-ai-search">
          <div className="card-section-header">
            <SparklesIcon size={18} className="section-icon" />
            <h3 id="heading-ai-search" className="section-title">AI & Investigation Controls</h3>
          </div>

          <div className="settings-group">
            {/* Show Investigation Panel */}
            <div className="settings-item">
              <div className="item-text-group">
                <span className="item-label">Show Investigation Panel</span>
                <span className="item-description">
                  Display real-time multi-hop agent reasoning steps and evidence collected.
                </span>
              </div>

              <ToggleSwitch
                id="toggle-investigation-panel"
                checked={settings.showInvestigationPanel}
                onChange={(val) => handleToggle('showInvestigationPanel', val, 'Investigation Panel')}
                ariaLabel="Toggle Investigation Panel"
              />
            </div>

            {/* Show Source Citations */}
            <div className="settings-item">
              <div className="item-text-group">
                <span className="item-label">Show Source Citations</span>
                <span className="item-description">
                  Include clickable citations and verified source cards with passage snippets in AI answers.
                </span>
              </div>

              <ToggleSwitch
                id="toggle-source-citations"
                checked={settings.showSourceCitations}
                onChange={(val) => handleToggle('showSourceCitations', val, 'Source Citations')}
                ariaLabel="Toggle Source Citations"
              />
            </div>

            {/* Show Evidence Confidence */}
            <div className="settings-item">
              <div className="item-text-group">
                <span className="item-label">Show Evidence Confidence</span>
                <span className="item-description">
                  Display semantic similarity match percentages on cited source snippets.
                </span>
              </div>

              <ToggleSwitch
                id="toggle-evidence-confidence"
                checked={settings.showEvidenceConfidence}
                onChange={(val) => handleToggle('showEvidenceConfidence', val, 'Evidence Confidence')}
                ariaLabel="Toggle Evidence Confidence"
              />
            </div>
          </div>
        </section>

        {/* 3. Chat Settings Section */}
        <section className="settings-card-section" aria-labelledby="heading-chat">
          <div className="card-section-header">
            <MessageSquareIcon size={18} className="section-icon" />
            <h3 id="heading-chat" className="section-title">Chat & Privacy</h3>
          </div>

          <div className="settings-group">
            {/* Save Chat History */}
            <div className="settings-item">
              <div className="item-text-group">
                <span className="item-label">Save Chat History</span>
                <span className="item-description">
                  Persist recent conversations in the sidebar for quick continuity across sessions.
                </span>
              </div>

              <ToggleSwitch
                id="toggle-save-history"
                checked={settings.saveChatHistory}
                onChange={(val) => handleToggle('saveChatHistory', val, 'Save Chat History')}
                ariaLabel="Toggle Save Chat History"
              />
            </div>

            {/* Clear Chat History Button */}
            <div className="settings-item danger-item">
              <div className="item-text-group">
                <span className="item-label text-danger">Clear Chat History</span>
                <span className="item-description">
                  Permanently clear current conversation messages and reset investigation trace.
                </span>
              </div>

              {confirmClearOpen ? (
                <div className="confirm-clear-actions">
                  <span className="confirm-prompt">Are you sure?</span>
                  <button
                    type="button"
                    className="btn-danger-confirm"
                    onClick={handleExecuteClear}
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-clear"
                    onClick={() => setConfirmClearOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-clear-history"
                  onClick={() => setConfirmClearOpen(true)}
                >
                  <TrashIcon size={15} />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

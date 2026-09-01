import { useState } from 'react';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ScopeSelector } from '../components/chat/ScopeSelector';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { InvestigationPanel } from '../components/chat/InvestigationPanel';
import { SourcePreviewModal } from '../components/chat/SourcePreviewModal';
import { SettingsView } from '../components/settings/SettingsView';
import { ProfileModal } from '../components/profile/ProfileModal';
import { SignOutConfirmModal } from '../components/profile/SignOutConfirmModal';
import {
  MenuIcon,
  ActivityIcon,
  SparklesIcon,
  PlusIcon,
  SettingsIcon
} from '../components/common/Icons';
import { useAuth } from '../context/useAuth';
import {
  INITIAL_CHAT_CONVERSATION,
  MOCK_INVESTIGATION_STEPS,
  MOCK_COLLECTIONS,
  MOCK_DOCUMENTS,
  MOCK_USER_PROFILE
} from '../mock/chatMockData';
import './ChatDashboard.css';

export const ChatDashboard = ({ onNavigate }) => {
  const { user: authUser, logout, updateProfile, changePassword, deleteAccount } = useAuth();

  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'settings'

  // User Profile state
  const currentUser = authUser || MOCK_USER_PROFILE;
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);

  // Handle account deletion
  const handleDeleteAccount = async (password) => {
    await deleteAccount(password);
    onNavigate('/');
  };

  // Settings state with interactive controls
  const [settings, setSettings] = useState({
    theme: 'dark',
    defaultScope: 'all',
    showInvestigationPanel: true,
    showSourceCitations: true,
    showEvidenceConfidence: true,
    saveChatHistory: true
  });

  // Investigation panel state
  const [investigationOpen, setInvestigationOpen] = useState(true);

  // Chat conversation state
  const [messages, setMessages] = useState(INITIAL_CHAT_CONVERSATION);
  const [currentScope, setCurrentScope] = useState('finance');
  const [isLoading, setIsLoading] = useState(false);
  const [investigationStepText, setInvestigationStepText] = useState('Searching Documents...');
  const [activeInvestigationSteps, setActiveInvestigationSteps] = useState(MOCK_INVESTIGATION_STEPS);

  // Active Source Modal Preview
  const [selectedSource, setSelectedSource] = useState(null);

  // Handle setting changes
  const handleUpdateSetting = (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'showInvestigationPanel') {
        setInvestigationOpen(value);
      }
      return updated;
    });
  };

  // Clear chat history
  const handleClearHistory = () => {
    setMessages([]);
    setIsLoading(false);
  };

  // Handle sign out
  const handleConfirmSignOut = () => {
    logout();
    setSignOutModalOpen(false);
    onNavigate('/login');
  };

  // Scope label helper
  const getActiveScopeName = () => {
    const col = MOCK_COLLECTIONS.find(c => c.id === currentScope);
    if (col) return col.name;
    const doc = MOCK_DOCUMENTS.find(d => d.id === currentScope);
    if (doc) return doc.title;
    return 'All Documents';
  };

  // Start a new chat
  const handleNewChat = () => {
    setActiveView('chat');
    setMessages([]);
    setIsLoading(false);
    if (settings.defaultScope && settings.defaultScope !== 'all') {
      setCurrentScope(settings.defaultScope);
    }
  };

  // Select a history conversation
  const handleSelectHistory = (historyItem) => {
    setActiveView('chat');
    if (historyItem.id === 'chat-1') {
      setMessages(INITIAL_CHAT_CONVERSATION);
      setCurrentScope('finance');
    } else {
      setMessages([
        {
          id: `hist-${Date.now()}-1`,
          role: 'user',
          timestamp: 'Yesterday',
          content: `Review summary and risk obligations for: ${historyItem.title}`
        },
        {
          id: `hist-${Date.now()}-2`,
          role: 'assistant',
          timestamp: 'Yesterday',
          scope: historyItem.scope,
          content: `Here is the verified summary for **${historyItem.title}** based on indexed documents:\n\n* **Primary Coverage**: Multi-tier compliance standards met across all core criteria [cit-3].\n* **Risk Profile**: Limitation of direct damages capped at 12 months recurring fees [cit-3].\n* **Auditor Verification**: Passed independent validation with zero high-severity audit findings [cit-4].`,
          citations: ['cit-3', 'cit-4'],
          investigationSteps: MOCK_INVESTIGATION_STEPS
        }
      ]);
    }
  };

  // Send message simulation with multi-step investigation
  const handleSendMessage = (userText, overrideScope) => {
    if (overrideScope) setCurrentScope(overrideScope);

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: userText
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Multi-step reasoning simulation
    setInvestigationStepText('Searching Documents across selected scope...');
    setTimeout(() => {
      setInvestigationStepText('Analyzing Evidence & Similarity Chunks...');
    }, 600);

    setTimeout(() => {
      setInvestigationStepText('Cross-referencing verified citations & comparing sources...');
    }, 1200);

    setTimeout(() => {
      setInvestigationStepText('Synthesizing grounded answer...');
    }, 1800);

    setTimeout(() => {
      const assistantMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scope: getActiveScopeName(),
        content: `Based on the latest indexed records in **${getActiveScopeName()}**, here is the factual analysis regarding your inquiry:

### Key Findings & Document Syntheses
* **Verified Evidence**: The primary clauses confirm full operational compliance and verified service availability of **99.95%** [cit-1].
* **Financial & SLA Thresholds**: Revenue expansion and recurring gross margin improved by **210 bps**, reflecting accelerated customer adoption [cit-1].
* **Governance & Audit Trail**: Access controls and continuous monitoring are enforced with full cryptographic audit trails [cit-4].

Every assertion above is directly traceable to the cited document coordinates below.`,
        citations: ['cit-1', 'cit-4'],
        investigationSteps: MOCK_INVESTIGATION_STEPS
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      setActiveInvestigationSteps(MOCK_INVESTIGATION_STEPS);
    }, 2400);
  };

  return (
    <div className="dashboard-layout">
      {/* 1. Left Sidebar */}
      <ChatSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        activeView={activeView}
        onSelectView={setActiveView}
        onNewChat={handleNewChat}
        onSelectHistory={handleSelectHistory}
        onNavigate={onNavigate}
        user={currentUser}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenSignOut={() => setSignOutModalOpen(true)}
      />

      {/* 2. Main Workspace */}
      <div className="dashboard-main-area">
        {/* Top App Header */}
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <MenuIcon size={20} />
            </button>

            <div className="chat-title-group">
              {activeView === 'settings' ? (
                <>
                  <span className="chat-active-title">Workspace Settings</span>
                  <span className="chat-subtitle-badge">
                    <SettingsIcon size={12} />
                    <span>Preferences</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="chat-active-title">
                    {messages.length > 0 ? 'Document Analysis Workspace' : 'New Investigation'}
                  </span>
                  <span className="chat-subtitle-badge">
                    <SparklesIcon size={12} />
                    <span>AI Grounded</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {activeView === 'chat' && (
              <>
                {/* Scope Selector Dropdown */}
                <ScopeSelector
                  currentScope={currentScope}
                  onSelectScope={setCurrentScope}
                />

                {/* New Chat Quick Button */}
                <button
                  type="button"
                  className="btn-quick-new-chat"
                  onClick={handleNewChat}
                  title="Reset to New Chat"
                >
                  <PlusIcon size={16} />
                  <span className="hidden-xs">New</span>
                </button>

                {/* Toggle Investigation Panel Button */}
                {settings.showInvestigationPanel && (
                  <button
                    type="button"
                    className={`btn-investigation-toggle ${investigationOpen ? 'active' : ''}`}
                    onClick={() => setInvestigationOpen(prev => !prev)}
                    title="Toggle Investigation Activity Panel"
                    aria-label="Toggle Investigation Activity Panel"
                  >
                    <ActivityIcon size={18} />
                    <span className="hidden-sm">Investigation</span>
                  </button>
                )}
              </>
            )}

            {activeView === 'settings' && (
              <button
                type="button"
                className="btn-quick-new-chat"
                onClick={() => setActiveView('chat')}
                title="Return to Chat"
              >
                <span>Back to Chat</span>
              </button>
            )}
          </div>
        </header>

        {/* View Switcher: Settings View OR Chat Stream */}
        {activeView === 'settings' ? (
          <SettingsView
            settings={settings}
            onUpdateSetting={handleUpdateSetting}
            onClearHistory={handleClearHistory}
            onBackToChat={() => setActiveView('chat')}
          />
        ) : (
          <>
            {/* Message Stream Scroll Area */}
            <div className="dashboard-chat-stream">
              <div className="container chat-stream-container">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  investigationStep={investigationStepText}
                  onSelectSuggestion={(text, scope) => handleSendMessage(text, scope)}
                  onOpenSourcePreview={setSelectedSource}
                  onOpenInvestigation={() => setInvestigationOpen(true)}
                  showCitations={settings.showSourceCitations}
                  showConfidence={settings.showEvidenceConfidence}
                />
              </div>
            </div>

            {/* Fixed Bottom Input */}
            <ChatInput
              onSendMessage={(text) => handleSendMessage(text)}
              disabled={isLoading}
              activeScopeName={getActiveScopeName()}
              onTriggerScopeSelect={() => {}}
            />
          </>
        )}
      </div>

      {/* 3. Right Investigation Panel (Only shown in Chat view if enabled) */}
      {activeView === 'chat' && settings.showInvestigationPanel && (
        <InvestigationPanel
          steps={activeInvestigationSteps}
          isOpen={investigationOpen}
          onClose={() => setInvestigationOpen(false)}
          isInvestigating={isLoading}
        />
      )}

      {/* 4. Source Preview Modal / Drawer */}
      <SourcePreviewModal
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />

      {/* 5. Profile Modal Dialog */}
      <ProfileModal
        user={currentUser}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onUpdateUser={updateProfile}
        onChangePassword={changePassword}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* 6. Sign Out Confirmation Dialog */}
      <SignOutConfirmModal
        isOpen={signOutModalOpen}
        onClose={() => setSignOutModalOpen(false)}
        onConfirmSignOut={handleConfirmSignOut}
      />
    </div>
  );
};

import { useState, useEffect, useCallback } from 'react';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ScopeSelector } from '../components/chat/ScopeSelector';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { InvestigationPanel } from '../components/chat/InvestigationPanel';
import { DocumentsView } from '../components/documents/DocumentsView';
import { SettingsView } from '../components/settings/SettingsView';
import { SourcePreviewModal } from '../components/chat/SourcePreviewModal';
import { ProfileModal } from '../components/profile/ProfileModal';
import { SignOutConfirmModal } from '../components/profile/SignOutConfirmModal';
import { useAuth } from '../context/useAuth';
import { documentsApi } from '../services/api';

import {
  SparklesIcon,
  MenuIcon,
  ActivityIcon,
  PlusIcon,
  SettingsIcon,
  FileTextIcon,
  UploadCloudIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '../components/common/Icons';
import {
  MOCK_USER_PROFILE,
  MOCK_COLLECTIONS
} from '../mock/chatMockData';
import './ChatDashboard.css';

export const ChatDashboard = ({ onNavigate, initialView = 'chat' }) => {
  const { user: authUser, logout, updateProfile, changePassword, deleteAccount } = useAuth();

  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [localView, setLocalView] = useState(initialView);

  // Active view resolved directly from routing & local selection
  const activeView = initialView || localView || 'chat';

  // Unified view selection with URL sync
  const handleSelectView = (view) => {
    setLocalView(view);
    if (view === 'documents') {
      onNavigate('/document');
    } else if (view === 'settings') {
      onNavigate('/settings');
    } else if (view === 'chat') {
      onNavigate('/chat');
    }
  };

  // User Profile state
  const currentUser = authUser || MOCK_USER_PROFILE;
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);

  // Documents state (Real Cloudflare R2 / MongoDB Data)
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState('');

  // Upload state & progress tracking
  const [uploadState, setUploadState] = useState({
    active: false,
    progress: 0,
    filename: '',
    count: 0,
    status: 'idle', // 'idle' | 'uploading' | 'success' | 'error'
    message: '',
  });

  // Drag & drop state over chat workspace
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Fetch real documents from backend
  const refreshUserDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setDocsError('');
    try {
      const response = await documentsApi.getAll();
      if (response && response.documents) {
        setDocuments(response.documents);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setDocsError(err.message || 'Failed to load documents.');
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    documentsApi.getAll()
      .then((res) => {
        if (isMounted && res?.documents) {
          setDocuments(res.documents);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching documents:', err);
          setDocsError(err.message || 'Failed to load documents.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);


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

  // Chat conversation state — Clean initial state (no dummy data)
  const [messages, setMessages] = useState([]);
  const [currentScope, setCurrentScope] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [investigationStepText, setInvestigationStepText] = useState('Searching Documents...');
  const [activeInvestigationSteps, setActiveInvestigationSteps] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);

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
    setActiveInvestigationSteps([]);
    setChatHistory([]);
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
    if (currentScope === 'all') return `All Documents (${documents.length})`;
    const col = MOCK_COLLECTIONS.find(c => c.id === currentScope);
    if (col) return col.name;
    const doc = documents.find(d => (d._id || d.id) === currentScope);
    if (doc) return doc.title || doc.filename || 'Target Document';
    return 'All Documents';
  };

  // Start a new chat
  const handleNewChat = () => {
    handleSelectView('chat');
    setMessages([]);
    setActiveInvestigationSteps([]);
    setIsLoading(false);
    if (settings.defaultScope && settings.defaultScope !== 'all') {
      setCurrentScope(settings.defaultScope);
    } else {
      setCurrentScope('all');
    }
  };

  // Select a history conversation
  const handleSelectHistory = (historyItem) => {
    handleSelectView('chat');
    if (historyItem.messages) {
      setMessages(historyItem.messages);
      setCurrentScope(historyItem.scope || 'all');
      setActiveInvestigationSteps(historyItem.investigationSteps || []);
    }
  };

  // Document Management handlers (Cloudflare R2 + MongoDB)
  const handleDeleteDocument = async (docId) => {
    try {
      await documentsApi.delete(docId);
      setDocuments(prev => prev.filter(d => (d._id || d.id) !== docId));
      if (currentScope === docId) {
        setCurrentScope('all');
      }
    } catch (err) {
      console.error('Delete document failed:', err);
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  const handleViewDocument = async (docId) => {
    try {
      const response = await documentsApi.getViewUrl(docId);
      if (response && response.viewUrl) {
        window.open(response.viewUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to open document view URL:', err);
      alert(`Unable to view document: ${err.message}`);
    }
  };

  const handleSelectDocumentForChat = (docId) => {
    setCurrentScope(docId);
    handleSelectView('chat');
    setMessages([]);
    setActiveInvestigationSteps([]);
  };

  // Handle File Upload from /chat (Single, Multiple, or ZIP)
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    // Validate maximum combined size (300 MB)
    const MAX_COMBINED_BYTES = 300 * 1024 * 1024;
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

    if (totalBytes > MAX_COMBINED_BYTES) {
      setUploadState({
        active: true,
        progress: 0,
        filename: '',
        count: files.length,
        status: 'error',
        message: `Combined upload size (${(totalBytes / (1024 * 1024)).toFixed(1)} MB) exceeds 300 MB limit.`,
      });
      setTimeout(() => setUploadState(prev => ({ ...prev, active: false })), 4000);
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    setUploadState({
      active: true,
      progress: 0,
      filename: files.length === 1 ? files[0].name : `${files.length} files`,
      count: files.length,
      status: 'uploading',
      message: 'Uploading to Cloudflare R2...',
    });

    try {
      const result = await documentsApi.upload(formData, (percent) => {
        setUploadState(prev => ({
          ...prev,
          progress: percent,
          message: percent === 100 ? 'Processing & storing in R2...' : `Uploading (${percent}%)...`,
        }));
      });

      // Refresh documents list
      if (result.documents && result.documents.length > 0) {
        setDocuments(prev => [...result.documents, ...prev]);
      } else {
        await refreshUserDocuments();
      }


      setUploadState({
        active: true,
        progress: 100,
        filename: files.length === 1 ? files[0].name : `${files.length} files`,
        count: files.length,
        status: 'success',
        message: result.message || `${files.length} file(s) stored securely in Cloudflare R2!`,
      });

      setTimeout(() => {
        setUploadState(prev => ({ ...prev, active: false }));
      }, 4000);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadState({
        active: true,
        progress: 0,
        filename: '',
        count: files.length,
        status: 'error',
        message: err.message || 'Failed to upload documents.',
      });

      setTimeout(() => {
        setUploadState(prev => ({ ...prev, active: false }));
      }, 5000);
    }
  };

  // Drag and drop events for /chat workspace
  const handleDragOver = (e) => {
    e.preventDefault();
    if (activeView === 'chat') {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (activeView === 'chat' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
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

    // Dynamic Multi-step reasoning simulation
    setInvestigationStepText('Searching Documents across selected scope...');
    setTimeout(() => {
      setInvestigationStepText('Analyzing Evidence & Similarity Chunks...');
    }, 600);

    setTimeout(() => {
      setInvestigationStepText('Synthesizing Grounded Verification Trace...');
    }, 1200);

    setTimeout(() => {
      const aiReply = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `I have analyzed your query across **${getActiveScopeName()}** in your secure Cloudflare R2 repository. When AI embedding & RAG ingestion pipelines are active, your exact answers will be mathematically grounded with verified page coordinates and cross-document validation.`,
        sources: documents.slice(0, 2).map((doc, idx) => ({
          id: `src-${idx + 1}`,
          documentTitle: doc.title || doc.filename || 'Document',
          page: 1,
          relevance: 95 - idx * 6,
          snippet: `Grounded excerpt from ${doc.filename || doc.title} retrieved from Cloudflare R2.`
        })),
        reasoningSummary: {
          strategy: 'Cross-Document Synthesis & Fact Validation',
          evidenceFound: documents.length > 0 ? documents.length : 1,
          conflictDetected: false,
          confidence: documents.length > 0 ? 94 : 88
        }
      };

      setMessages(prev => [...prev, aiReply]);
      setIsLoading(false);

      if (settings.saveChatHistory) {
        setChatHistory(prev => [
          {
            id: `hist-${Date.now()}`,
            title: userText.length > 32 ? `${userText.slice(0, 32)}...` : userText,
            date: 'Just now',
            scope: currentScope,
            messages: [...messages, userMessage, aiReply],
            investigationSteps: []
          },
          ...prev.slice(0, 15)
        ]);
      }
    }, 1800);
  };

  return (
    <div
      className="dashboard-layout"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* Drag & Drop Visual Overlay on /chat */}
      {isDraggingOver && activeView === 'chat' && (
        <div className="chat-drop-overlay">
          <div className="drop-overlay-card">
            <UploadCloudIcon size={48} className="drop-icon-animated" />
            <h3 className="drop-title">Drop files to upload to Cloudflare R2</h3>
            <p className="drop-subtitle">PDF, DOCX, TXT, Markdown, or ZIP archives (up to 300MB)</p>
          </div>
        </div>
      )}

      {/* 1. Left Sidebar */}
      <ChatSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        activeView={activeView}
        onSelectView={handleSelectView}
        onNewChat={handleNewChat}
        onSelectHistory={handleSelectHistory}
        onNavigate={onNavigate}
        user={currentUser}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenSignOut={() => setSignOutModalOpen(true)}
        history={chatHistory}
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
              {activeView === 'settings' && (
                <>
                  <span className="chat-active-title">Workspace Settings</span>
                  <span className="chat-subtitle-badge">
                    <SettingsIcon size={12} />
                    <span>Preferences</span>
                  </span>
                </>
              )}

              {activeView === 'documents' && (
                <>
                  <span className="chat-active-title">Document Repository</span>
                  <span className="chat-subtitle-badge">
                    <FileTextIcon size={12} />
                    <span>{documents.length} Files in Cloudflare R2</span>
                  </span>
                </>
              )}

              {activeView === 'chat' && (
                <>
                  <span className="chat-active-title">
                    {messages.length > 0 ? 'Document Analysis Workspace' : 'New Investigation'}
                  </span>
                  <span className="chat-subtitle-badge">
                    <SparklesIcon size={12} />
                    <span>Cloudflare R2 Storage</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {activeView === 'chat' && (
              <>
                {/* Scope Selector Dropdown with Dynamic Documents */}
                <ScopeSelector
                  currentScope={currentScope}
                  onSelectScope={setCurrentScope}
                  documents={documents}
                />

                {/* Quick Documents Navigation Link */}
                <button
                  type="button"
                  className="btn-quick-new-chat"
                  onClick={() => handleSelectView('documents')}
                  title="View Uploaded Documents"
                >
                  <FileTextIcon size={16} />
                  <span className="hidden-xs">Docs ({documents.length})</span>
                </button>

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

            {activeView === 'documents' && (
              <button
                type="button"
                className="btn-quick-new-chat"
                onClick={() => handleSelectView('chat')}
                title="Return to Chat"
              >
                <span>Back to Chat</span>
              </button>
            )}

            {activeView === 'settings' && (
              <button
                type="button"
                className="btn-quick-new-chat"
                onClick={() => handleSelectView('chat')}
                title="Return to Chat"
              >
                <span>Back to Chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Floating Upload Notification Status Banner */}
        {uploadState.active && (
          <div className={`dashboard-upload-banner ${uploadState.status}`}>
            <div className="upload-banner-icon">
              {uploadState.status === 'uploading' && <div className="upload-spinner" />}
              {uploadState.status === 'success' && <CheckCircleIcon size={18} />}
              {uploadState.status === 'error' && <AlertCircleIcon size={18} />}
            </div>

            <div className="upload-banner-info">
              <span className="upload-banner-title">{uploadState.filename || 'Document Upload'}</span>
              <span className="upload-banner-message">{uploadState.message}</span>
            </div>

            {uploadState.status === 'uploading' && (
              <div className="upload-banner-progress-bar">
                <div
                  className="upload-banner-progress-fill"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* View Switcher: Documents View | Settings View | Chat Stream */}
        {activeView === 'documents' && (
          <DocumentsView
            documents={documents}
            isLoading={isLoadingDocs}
            error={docsError}
            onDeleteDocument={handleDeleteDocument}
            onSelectDocumentForChat={handleSelectDocumentForChat}
            onViewDocument={handleViewDocument}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSetting={handleUpdateSetting}
            onClearHistory={handleClearHistory}
            onBackToChat={() => handleSelectView('chat')}
          />
        )}

        {activeView === 'chat' && (
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

            {/* Fixed Bottom Input with Multi-File Attachment */}
            <ChatInput
              onSendMessage={(text) => handleSendMessage(text)}
              onUploadFiles={handleUploadFiles}
              disabled={isLoading}
              isUploading={uploadState.active && uploadState.status === 'uploading'}
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

export default ChatDashboard;

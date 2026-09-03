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
import { documentsApi, ragApi } from '../services/api';



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

  // Vectorization & Upload state with precise stage percentage tracking
  const [vectorizationState, setVectorizationState] = useState({
    active: false,
    progress: 0,
    stage: 'idle', // 'uploading' | 'processing' | 'ready' | 'error'
    filename: '',
    count: 0,
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
        return response.documents;
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setDocsError(err.message || 'Failed to load documents.');
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  // Poll backend while documents are being vectorized and saved into Qdrant Cloud
  const pollVectorizationStatus = useCallback((docIds = []) => {
    let attempts = 0;
    const maxAttempts = 80; // 80 * 1500ms = 2 minutes timeout
    let simulatedProgress = 35;

    const intervalId = setInterval(async () => {
      attempts++;
      try {
        const res = await documentsApi.getAll();
        if (res?.documents) {
          setDocuments(res.documents);

          const relevantDocs = docIds.length > 0
            ? res.documents.filter((d) => docIds.includes(d._id || d.id))
            : res.documents;

          const anyProcessing = relevantDocs.some(
            (d) => d.status === 'processing' || d.status === 'uploaded'
          );
          const anyFailed = relevantDocs.some((d) => d.status === 'failed');
          const allReady =
            relevantDocs.length > 0 && relevantDocs.every((d) => d.status === 'ready');

          // CASE 1: All documents successfully indexed in Qdrant Cloud!
          if (allReady) {
            clearInterval(intervalId);
            setVectorizationState((prev) => ({
              ...prev,
              active: true,
              progress: 100,
              stage: 'ready',
              message: 'All documents vectorized & saved to Qdrant Cloud! Submit unlocked.',
            }));

            setTimeout(() => {
              setVectorizationState((prev) => ({ ...prev, active: false }));
            }, 4500);
            return;
          }

          // CASE 2: Failure occurred during extraction or vectorization
          if (anyFailed && !anyProcessing) {
            clearInterval(intervalId);
            const failedDoc = relevantDocs.find((d) => d.status === 'failed');
            setVectorizationState((prev) => ({
              ...prev,
              active: true,
              progress: 100,
              stage: 'error',
              message: failedDoc?.errorMessage || 'Vectorization processing failed.',
            }));

            setTimeout(() => {
              setVectorizationState((prev) => ({ ...prev, active: false }));
            }, 6000);
            return;
          }

          // CASE 3: In progress - advance simulated progress smoothly
          if (anyProcessing) {
            simulatedProgress = Math.min(95, simulatedProgress + 4);
            let stageMessage = 'Extracting text and structural pages...';

            if (simulatedProgress > 50 && simulatedProgress <= 75) {
              stageMessage = 'Generating Nomic Embeddings on RunPod GPU...';
            } else if (simulatedProgress > 75) {
              stageMessage = 'Indexing vector points and metadata in Qdrant Cloud...';
            }

            setVectorizationState((prev) => ({
              ...prev,
              active: true,
              progress: simulatedProgress,
              stage: 'processing',
              message: stageMessage,
            }));
          }
        }
      } catch (pollErr) {
        console.warn('Vectorization polling notice:', pollErr.message);
      }

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        setVectorizationState((prev) => ({ ...prev, active: false }));
      }
    }, 1500);
  }, []);

  useEffect(() => {
    let isMounted = true;
    documentsApi
      .getAll()
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
    defaultScope: null,
    showInvestigationPanel: true,
    showSourceCitations: true,
    showEvidenceConfidence: true,
    saveChatHistory: true
  });

  // Investigation panel state
  const [investigationOpen, setInvestigationOpen] = useState(true);

  // Chat conversation state — Clean initial state (no pre-selected document scope)
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentScope, setCurrentScope] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [investigationStepText, setInvestigationStepText] = useState('Searching Documents...');
  const [activeInvestigationSteps, setActiveInvestigationSteps] = useState([]);

  // Persistent chat history loaded from localStorage
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(`tracemind_chat_history_${authUser?._id || 'guest'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync chatHistory with localStorage whenever it changes
  useEffect(() => {
    if (!authUser?._id) return;
    try {
      localStorage.setItem(`tracemind_chat_history_${authUser._id}`, JSON.stringify(chatHistory));
    } catch (err) {
      console.warn('Failed to save chat history to localStorage:', err);
    }
  }, [chatHistory, authUser?._id]);

  // Load chat history when switching users
  useEffect(() => {
    if (!authUser?._id) return;
    try {
      const saved = localStorage.getItem(`tracemind_chat_history_${authUser._id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setChatHistory(parsed);
        }
      } else {
        setChatHistory([]);
      }
    } catch {
      setChatHistory([]);
    }
  }, [authUser?._id]);

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
    setCurrentSessionId(null);
    setActiveInvestigationSteps([]);
    setChatHistory([]);
    setIsLoading(false);
    if (authUser?._id) {
      localStorage.removeItem(`tracemind_chat_history_${authUser._id}`);
    }
  };

  // Handle sign out
  const handleConfirmSignOut = () => {
    logout();
    setSignOutModalOpen(false);
    onNavigate('/login');
  };

  // Scope label helper
  const getActiveScopeName = () => {
    if (!currentScope) return 'No Document Selected (Select or Upload)';
    if (currentScope === 'all') return `All Documents (${documents.length})`;
    const col = MOCK_COLLECTIONS.find(c => c.id === currentScope);
    if (col) return col.name;
    const doc = documents.find(d => (d._id || d.id) === currentScope);
    if (doc) return doc.title || doc.filename || 'Target Document';
    return 'Target Document';
  };

  // Start a new chat (resets active session and leaves scope open for user to select/upload)
  const handleNewChat = () => {
    handleSelectView('chat');
    setCurrentSessionId(null);
    setMessages([]);
    setActiveInvestigationSteps([]);
    setIsLoading(false);
    setCurrentScope(null);
  };

  // Select an existing conversation from recent history
  const handleSelectHistory = (historyItem) => {
    handleSelectView('chat');
    setCurrentSessionId(historyItem.id);
    setMessages(historyItem.messages || []);
    setCurrentScope(historyItem.scope || null);
    setActiveInvestigationSteps(historyItem.investigationSteps || []);
  };

  // Document Management handlers (Cloudflare R2 + MongoDB)
  const handleDeleteDocument = async (docId) => {
    try {
      await documentsApi.delete(docId);
      setDocuments(prev => prev.filter(d => (d._id || d.id) !== docId));
      if (currentScope === docId) {
        setCurrentScope(null);
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

  // Select document directly from the Documents table/card to chat with it
  const handleSelectDocumentForChat = (docId) => {
    handleSelectView('chat');
    setCurrentSessionId(null);
    setMessages([]);
    setActiveInvestigationSteps([]);
    setCurrentScope(docId);
  };


  // Handle File Upload from /chat (Single, Multiple, or ZIP)
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    // Validate maximum combined size (300 MB)
    const MAX_COMBINED_BYTES = 300 * 1024 * 1024;
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

    const displayFilename = files.length === 1 ? files[0].name : `${files.length} files`;

    if (totalBytes > MAX_COMBINED_BYTES) {
      setVectorizationState({
        active: true,
        progress: 0,
        stage: 'error',
        filename: displayFilename,
        count: files.length,
        message: `Combined upload size (${(totalBytes / (1024 * 1024)).toFixed(1)} MB) exceeds 300 MB limit.`,
      });
      setTimeout(() => setVectorizationState(prev => ({ ...prev, active: false })), 4000);
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    setVectorizationState({
      active: true,
      progress: 5,
      stage: 'uploading',
      filename: displayFilename,
      count: files.length,
      message: 'Uploading to Cloudflare R2 storage (0%)...',
    });

    try {
      const result = await documentsApi.upload(formData, (percent) => {
        const uploadScaledProgress = Math.min(30, Math.round(percent * 0.3));
        setVectorizationState(prev => ({
          ...prev,
          progress: uploadScaledProgress,
          stage: 'uploading',
          message: percent === 100
            ? 'Stored in Cloudflare R2! Extracting text and pages...'
            : `Uploading to Cloudflare R2 (${percent}%)...`,
        }));
      });

      const uploadedDocIds = (result.documents || []).map(d => d._id || d.id);

      // Refresh documents list in state and automatically scope the active chat to the uploaded document
      if (result.documents && result.documents.length > 0) {
        setDocuments(prev => [...result.documents, ...prev]);
        const firstDoc = result.documents[0];
        setCurrentScope(firstDoc._id || firstDoc.id);
      } else {
        await refreshUserDocuments();
      }

      setVectorizationState(prev => ({
        ...prev,
        progress: 35,
        stage: 'processing',
        message: 'Extracting text (PDF/DOCX/TXT/MD)...',
      }));

      // Start live polling until RunPod embeddings are computed and saved in Qdrant Cloud
      pollVectorizationStatus(uploadedDocIds);

    } catch (err) {
      console.error('Upload failed:', err);
      setVectorizationState({
        active: true,
        progress: 0,
        stage: 'error',
        filename: displayFilename,
        count: files.length,
        message: err.message || 'Failed to upload documents.',
      });

      setTimeout(() => {
        setVectorizationState(prev => ({ ...prev, active: false }));
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
    if (activeView === 'chat') {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (activeView === 'chat' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Send message to Grounded RAG Pipeline (Qdrant Retrieval + RunPod Qwen)
  const handleSendMessage = async (userText, overrideScope) => {
    const scopeToUse = overrideScope || currentScope;
    if (overrideScope) setCurrentScope(overrideScope);

    // Maintain consistent single conversation session
    const activeSessionId = currentSessionId || `session_${Date.now()}`;
    if (!currentSessionId) {
      setCurrentSessionId(activeSessionId);
    }

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: userText
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Dynamic Multi-step investigation text updates
    setInvestigationStepText('Computing Nomic Dense Vector Embeddings on RunPod GPU...');
    
    const stepTimer1 = setTimeout(() => {
      setInvestigationStepText('Searching Qdrant Cloud Collection for Grounded Evidence...');
    }, 800);

    const stepTimer2 = setTimeout(() => {
      setInvestigationStepText('Synthesizing Grounded Answer with Qwen LLM on RunPod...');
    }, 2200);

    try {
      // Build conversation history format for API
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = await ragApi.query({
        query: userText,
        documentId: scopeToUse && scopeToUse !== 'all' ? scopeToUse : undefined,
        chatHistory: historyPayload,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const aiReply = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: result.answer,
        sources: (result.sources || []).map((src, idx) => ({
          id: src.pointId || `src-${idx + 1}`,
          documentTitle: src.fileName || 'Document',
          documentId: src.documentId,
          page: src.pageNumber || 1,
          chunkNumber: src.chunkNumber || idx + 1,
          relevance: src.similarityScore ? Math.round(src.similarityScore * 100) : 85,
          snippet: src.chunkExcerpt || src.fullText || '',
          fullText: src.fullText,
        })),
        reasoningSummary: {
          strategy: `Qdrant Dense Vector Retrieval (${result.totalEvidenceChunks || 0} Chunks) + Grounded Qwen Generation`,
          evidenceFound: result.totalEvidenceChunks || (result.sources ? result.sources.length : 0),
          conflictDetected: false,
          confidence: result.sources?.[0]?.similarityScore
            ? Math.round(result.sources[0].similarityScore * 100)
            : (result.totalEvidenceChunks > 0 ? 92 : 40),
          model: result.model || 'qwen2.5',
        }
      };

      setMessages(prev => [...prev, aiReply]);
      setIsLoading(false);

      // Save / Update conversation thread in persistent chat history
      if (settings.saveChatHistory) {
        setChatHistory(prev => {
          const existingIndex = prev.findIndex(item => item.id === activeSessionId);
          const updatedMessages = [...messages, userMessage, aiReply];

          if (existingIndex >= 0) {
            // Update existing chat thread with latest messages
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              messages: updatedMessages,
              scope: scopeToUse,
              lastUpdated: Date.now(),
            };
            return updated;
          } else {
            // Prepend new conversation session
            const newSession = {
              id: activeSessionId,
              title: userText.length > 36 ? `${userText.slice(0, 36)}...` : userText,
              date: 'Just now',
              scope: scopeToUse,
              messages: updatedMessages,
              investigationSteps: [],
              createdAt: Date.now(),
              lastUpdated: Date.now(),
            };
            return [newSession, ...prev.slice(0, 29)];
          }
        });
      }
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      console.error('RAG Query Error:', err);

      const errorReply = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `⚠️ **Unable to generate answer:** ${err.message || 'An error occurred while communicating with the RAG pipeline or RunPod Ollama server.'}`,
        sources: [],
        reasoningSummary: {
          strategy: 'RAG Error Handler',
          evidenceFound: 0,
          conflictDetected: true,
          confidence: 0,
        }
      };

      setMessages(prev => [...prev, errorReply]);
      setIsLoading(false);
    }
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
        activeSessionId={currentSessionId}
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

        {/* Top Vectorization Progress Bar & Status Tracker */}
        {vectorizationState.active && (
          <div className={`top-vectorization-banner ${vectorizationState.stage}`}>
            <div className="top-vectorization-content">
              <div className="vector-stage-left">
                <div className="vector-icon-badge">
                  {vectorizationState.stage === 'ready' ? (
                    <CheckCircleIcon size={16} />
                  ) : vectorizationState.stage === 'error' ? (
                    <AlertCircleIcon size={16} />
                  ) : (
                    <div className="vector-spinner-ring" />
                  )}
                </div>
                <div className="vector-text-group">
                  <div className="vector-title-row">
                    <span className="vector-title">
                      {vectorizationState.stage === 'ready'
                        ? 'Vectorization Complete'
                        : vectorizationState.stage === 'error'
                        ? 'Vectorization Failed'
                        : `Vectorizing: ${vectorizationState.filename || 'Documents'}`}
                    </span>
                    <span className="vector-percent-tag">
                      {Math.round(vectorizationState.progress)}%
                    </span>
                  </div>
                  <p className="vector-subtitle">{vectorizationState.message}</p>
                </div>
              </div>

              <div className="vector-stage-right">
                <span className="vector-engine-tag">
                  <SparklesIcon size={12} />
                  <span>Nomic • Qdrant Cloud</span>
                </span>
              </div>
            </div>

            {/* Progress Track Line */}
            <div className="vector-progress-track">
              <div
                className={`vector-progress-bar-fill ${vectorizationState.stage}`}
                style={{ width: `${vectorizationState.progress}%` }}
              />
            </div>
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
              isUploading={vectorizationState.active && vectorizationState.stage === 'uploading'}
              isVectorizing={
                vectorizationState.active &&
                (vectorizationState.stage === 'processing' || vectorizationState.stage === 'uploading')
              }
              vectorizingProgress={vectorizationState.progress}
              vectorizingMessage={vectorizationState.message}
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

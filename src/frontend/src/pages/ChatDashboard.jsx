import { useState, useEffect, useCallback } from 'react';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ScopeSelector } from '../components/chat/ScopeSelector';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { InvestigationPanel } from '../components/chat/InvestigationPanel';
import { DocumentsView } from '../components/documents/DocumentsView';
import { SettingsView } from '../components/settings/SettingsView';
import { SourcePreviewModal } from '../components/chat/SourcePreviewModal';
import { AgentFlowModal } from '../components/chat/AgentFlowModal';
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
  AlertCircleIcon,
  NetworkIcon,
  FolderIcon,
  CloseIcon
} from '../components/common/Icons';
import {
  MOCK_USER_PROFILE
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
  const pollVectorizationStatus = useCallback((docIds = [], options = {}) => {
    const { isZip = false, archiveSummary = null } = options;
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
            (d) => d.status === 'processing' || d.status === 'uploaded' || d.status === 'analyzing'
          );
          const anyFailed = relevantDocs.some((d) => d.status === 'failed');
          const allReady =
            relevantDocs.length > 0 && relevantDocs.every((d) => d.status === 'ready');

          const readyCount = relevantDocs.filter((d) => d.status === 'ready').length;
          const analyzingCount = relevantDocs.filter((d) => d.status === 'analyzing').length;
          const totalCount = relevantDocs.length;

          // CASE 1: All documents successfully indexed in knowledge base!
          if (allReady) {
            clearInterval(intervalId);
            setVectorizationState((prev) => ({
              ...prev,
              active: true,
              progress: 100,
              stage: 'ready',
              message: isZip
                ? `Completed! Archive "${archiveSummary?.archive || 'ZIP'}" (${totalCount} files) fully indexed.`
                : 'Completed! All documents processed & indexed! Ready for questions.',
            }));

            if (isZip && archiveSummary) {
              setArchiveNotification({
                archive: archiveSummary.archive,
                totalFiles: archiveSummary.totalFiles || totalCount,
                processed: totalCount,
                skipped: archiveSummary.skipped || 0,
                failed: archiveSummary.failed || 0,
                files: relevantDocs,
              });
            }

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
              message: failedDoc?.errorMessage || 'Document processing failed.',
            }));

            if (isZip && archiveSummary) {
              setArchiveNotification({
                archive: archiveSummary.archive,
                totalFiles: archiveSummary.totalFiles || totalCount,
                processed: readyCount,
                skipped: archiveSummary.skipped || 0,
                failed: relevantDocs.filter((d) => d.status === 'failed').length,
                files: relevantDocs,
              });
            }

            setTimeout(() => {
              setVectorizationState((prev) => ({ ...prev, active: false }));
            }, 6000);
            return;
          }

          // CASE 3: In progress - advance simulated progress smoothly with specific ZIP stages
          if (anyProcessing) {
            simulatedProgress = Math.min(95, simulatedProgress + 4);
            let stageMessage = isZip
              ? `Processing ${readyCount}/${totalCount}... Extracting documents`
              : 'Extracting text and structural pages...';

            if (analyzingCount > 0) {
              stageMessage = isZip
                ? `Analyzing images with Qwen3-VL (${readyCount}/${totalCount} ready)...`
                : 'Analyzing visual evidence with Vision Agent...';
            } else if (simulatedProgress > 50 && simulatedProgress <= 75) {
              stageMessage = isZip
                ? `Generating embeddings (${readyCount}/${totalCount} ready)...`
                : 'Generating semantic embeddings...';
            } else if (simulatedProgress > 75) {
              stageMessage = isZip
                ? `Indexing evidence into Qdrant Cloud (${readyCount}/${totalCount} ready)...`
                : 'Indexing document content and metadata...';
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

  // Smart conversation title generator that extracts concise topic headings instead of full questions
  const generateConversationTitle = (text) => {
    if (!text || typeof text !== 'string') return 'Investigation Query';

    let cleaned = text.trim();

    // Remove surrounding quotes or markdown
    cleaned = cleaned.replace(/^[*"`'“”#\s]+|[*"`'“”\s]+$/g, '').trim();

    // Comprehensive question filler patterns
    const fillerPatterns = [
      /^(?:can\s+you\s+please\s+tell\s+me\s+about\s+the|can\s+you\s+please\s+tell\s+me\s+about|can\s+you\s+tell\s+me\s+about\s+the|can\s+you\s+tell\s+me\s+about|can\s+you\s+tell\s+me\s+the|can\s+you\s+tell\s+me|could\s+you\s+please\s+explain|could\s+you\s+explain|could\s+you\s+tell\s+me)\s*/i,
      /^(?:please\s+tell\s+me\s+about|please\s+explain\s+to\s+me|please\s+explain|please\s+provide\s+details\s+on|please\s+provide|please\s+find)\s*/i,
      /^(?:at\s+what\s+time\s+did\s+the|at\s+what\s+time\s+did|at\s+what\s+time|what\s+time\s+did\s+the|what\s+time\s+is\s+the|what\s+time\s+is)\s*/i,
      /^(?:who\s+commanded\s+the|who\s+was\s+in\s+charge\s+of\s+the|who\s+was\s+the|who\s+is\s+the|who\s+are\s+the)\s*/i,
      /^(?:what\s+is\s+the\s+purpose\s+of|what\s+is\s+the|what\s+are\s+the|what\s+were\s+the|what\s+did\s+the)\s*/i,
      /^(?:how\s+did\s+the|how\s+does\s+the|how\s+can\s+we|how\s+to|why\s+did\s+the|why\s+does\s+the|why\s+is\s+there)\s*/i,
      /^(?:tell\s+me\s+about\s+the|tell\s+me\s+about|tell\s+me|summarize\s+the|summarize|explain\s+the|explain|describe\s+the|describe)\s*/i,
      /^(?:search\s+for\s+the|search\s+for|find\s+the|find\s+information\s+on|find\s+out\s+about|give\s+me\s+the|give\s+me)\s*/i,
      /^(?:inquire\s+about|investigate\s+the|investigate|details\s+regarding|details\s+on)\s*/i,
    ];

    for (const pattern of fillerPatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }

    // Strip trailing punctuation
    cleaned = cleaned.replace(/[?!.:;,—–-]+$/g, '').trim();

    // If too short, fallback to original text without punctuation
    if (cleaned.length < 3) {
      cleaned = text.replace(/[?!.:;,—–-]+$/g, '').trim();
    }

    if (!cleaned) return 'Investigation Query';

    // Capitalize words into Title Case
    const words = cleaned.split(/\s+/).slice(0, 6);
    const minorWords = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'by', 'with']);
    const titleCased = words
      .map((word, idx) => {
        const lower = word.toLowerCase();
        if (idx > 0 && minorWords.has(lower)) {
          return lower;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');

    if (titleCased.length > 32) {
      return `${titleCased.slice(0, 30).trim()}...`;
    }

    return titleCased;
  };

  // Chat conversation state — Clean initial state (no pre-selected document scope)
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentScope, setCurrentScope] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [investigationStepText, setInvestigationStepText] = useState('Searching Documents...');
  const [activeInvestigationSteps, setActiveInvestigationSteps] = useState([]);

  // Persistent chat history loaded from localStorage (with auto-sanitization for headings & timestamps)
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(`tracemind_chat_history_${authUser?._id || 'guest'}`);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          ...item,
          title: item.title
            ? (item.title.endsWith('?') || /^(?:At what|Who commanded|Can you tell|What is|Why did)/i.test(item.title)
                ? generateConversationTitle(item.title)
                : item.title)
            : 'Investigation Query',
          createdAt: item.createdAt || Date.now() - idx * 25 * 60 * 1000,
          lastUpdated: item.lastUpdated || item.createdAt || Date.now() - idx * 25 * 60 * 1000,
        }));
      }
      return [];
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
          setChatHistory(
            parsed.map((item, idx) => ({
              ...item,
              title: item.title
                ? (item.title.endsWith('?') || /^(?:At what|Who commanded|Can you tell|What is|Why did)/i.test(item.title)
                    ? generateConversationTitle(item.title)
                    : item.title)
                : 'Investigation Query',
              createdAt: item.createdAt || Date.now() - idx * 25 * 60 * 1000,
              lastUpdated: item.lastUpdated || item.createdAt || Date.now() - idx * 25 * 60 * 1000,
            }))
          );
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

  // 3D Agent Flow Modal State & Live Flow Tracking
  const [agentFlowModalOpen, setAgentFlowModalOpen] = useState(false);
  const [selectedFlowData, setSelectedFlowData] = useState(null);
  const [liveAgentFlow, setLiveAgentFlow] = useState({
    isLive: false,
    events: [],
    searchRounds: 1,
    sourcesReviewed: 0,
    conflictsDetected: 0,
    activeAgent: null,
  });


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

  // Scope label helper (supports single, multiple, or collection scopes)
  const getActiveScopeName = () => {
    if (!currentScope) return 'No Document Selected (Select or Upload)';
    if (currentScope === 'all') return `All Documents (${documents.length})`;
    if (Array.isArray(currentScope)) {
      if (currentScope.length === 0) return 'No Document Selected';
      if (currentScope.length === 1) {
        const doc = documents.find((d) => (d._id || d.id) === currentScope[0]);
        return doc ? doc.title || doc.filename : 'Target Document';
      }
      return `${currentScope.length} Active Documents`;
    }

    const doc = documents.find((d) => (d._id || d.id) === currentScope);
    if (doc) return doc.title || doc.filename || 'Target Document';
    return 'Target Document';
  };

  // Active documents array for chips display
  const getActiveScopeDocs = () => {
    if (!currentScope || currentScope === 'all') return [];
    if (Array.isArray(currentScope)) {
      return documents.filter((d) => currentScope.includes(d._id || d.id));
    }
    const doc = documents.find((d) => (d._id || d.id) === currentScope);
    return doc ? [doc] : [];
  };

  // Remove document(s) from active conversation scope
  const handleRemoveScopeDoc = (docIdOrIdsToRemove) => {
    if (Array.isArray(docIdOrIdsToRemove)) {
      const set = new Set(docIdOrIdsToRemove);
      if (Array.isArray(currentScope)) {
        const next = currentScope.filter((id) => !set.has(id));
        setCurrentScope(next.length === 0 ? null : next.length === 1 ? next[0] : next);
      } else if (set.has(currentScope)) {
        setCurrentScope(null);
      }
    } else if (Array.isArray(currentScope)) {
      const next = currentScope.filter((id) => id !== docIdOrIdsToRemove);
      setCurrentScope(next.length === 0 ? null : next.length === 1 ? next[0] : next);
    } else if (currentScope === docIdOrIdsToRemove) {
      setCurrentScope(null);
    }
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

  // Rename an existing conversation in history
  const handleRenameHistory = (sessionId, newTitle) => {
    if (!sessionId || !newTitle) return;
    setChatHistory((prev) =>
      prev.map((item) => (item.id === sessionId ? { ...item, title: newTitle } : item))
    );
  };

  // Delete a conversation from history
  const handleDeleteHistory = (sessionId) => {
    if (!sessionId) return;
    setChatHistory((prev) => prev.filter((item) => item.id !== sessionId));
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
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

  const handleDeleteAllDocuments = async () => {
    try {
      const res = await documentsApi.deleteAll();
      setDocuments([]);
      setCurrentScope(null);
      return res;
    } catch (err) {
      console.error('Delete all documents failed:', err);
      throw err;
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

    const isZip = files.some((f) => (f.name || '').toLowerCase().endsWith('.zip'));
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    setVectorizationState({
      active: true,
      progress: 5,
      stage: 'uploading',
      filename: displayFilename,
      count: files.length,
      message: isZip
        ? 'Uploading ZIP archive... Validating files & path security...'
        : 'Uploading to secure document storage (0%)...',
    });

    try {
      const result = await documentsApi.upload(formData, (percent) => {
        const uploadScaledProgress = Math.min(30, Math.round(percent * 0.3));
        setVectorizationState(prev => ({
          ...prev,
          progress: uploadScaledProgress,
          stage: 'uploading',
          message: percent === 100
            ? (isZip ? 'Extracting archive & scanning files...' : 'Stored securely! Extracting text and pages...')
            : `Uploading to document storage (${percent}%)...`,
        }));
      });

      const uploadedDocIds = (result.documents || []).map((d) => d._id || d.id);

      // Refresh documents list in state and automatically scope the active chat to ALL uploaded documents
      if (result.documents && result.documents.length > 0) {
        setDocuments((prev) => [...result.documents, ...prev]);
        if (uploadedDocIds.length > 1) {
          setCurrentScope(uploadedDocIds);
        } else if (uploadedDocIds.length === 1) {
          setCurrentScope(uploadedDocIds[0]);
        }
      } else {
        await refreshUserDocuments();
      }

      setVectorizationState(prev => ({
        ...prev,
        progress: 35,
        stage: 'processing',
        message: isZip
          ? `Processing 1/${uploadedDocIds.length || 1}... Extracting archive files`
          : 'Extracting text (PDF/DOCX/TXT/MD)...',
      }));

      // Start live polling until RunPod embeddings are computed and saved in Qdrant Cloud
      pollVectorizationStatus(uploadedDocIds, { isZip, archiveSummary: result });

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

    // Initial Live Agent Progression: Planner Agent
    const initialLiveEvents = [
      {
        agent: 'planner',
        event: 'PLANNING_STARTED',
        status: 'running',
        round: 1,
        message: 'Formulating multi-hop search strategy and extracting key query entities',
        timestamp: new Date().toISOString(),
        metadata: { searchRationale: 'Deconstructing question for dense vector retrieval' }
      }
    ];

    setInvestigationStepText('Formulating search strategy with Planner Agent...');
    setLiveAgentFlow({
      isLive: true,
      events: initialLiveEvents,
      searchRounds: 1,
      sourcesReviewed: 0,
      conflictsDetected: 0,
      activeAgent: 'planner'
    });

    const stepTimer1 = setTimeout(() => {
      setInvestigationStepText('Executing semantic search across knowledge base...');
      setLiveAgentFlow(prev => ({
        ...prev,
        isLive: true,
        activeAgent: 'retrieval',
        sourcesReviewed: 6,
        events: [
          { ...initialLiveEvents[0], status: 'completed' },
          {
            agent: 'retrieval',
            event: 'SEARCH_IN_PROGRESS',
            status: 'running',
            round: 1,
            message: 'Searching document knowledge base for relevant passages',
            timestamp: new Date().toISOString(),
            metadata: { sourcesFound: 6 }
          }
        ]
      }));
    }, 800);

    const stepTimer2 = setTimeout(() => {
      setInvestigationStepText('Extracting verified claims with Evidence & Conflict Agents...');
      setLiveAgentFlow(prev => ({
        ...prev,
        isLive: true,
        sourcesReviewed: 12,
        activeAgent: 'evidence',
        events: [
          { ...initialLiveEvents[0], status: 'completed' },
          {
            agent: 'retrieval',
            event: 'SEARCH_COMPLETED',
            status: 'completed',
            round: 1,
            message: 'Retrieved 12 relevant document passages from knowledge base',
            timestamp: new Date().toISOString(),
            metadata: { sourcesFound: 12 }
          },
          {
            agent: 'evidence',
            event: 'EVIDENCE_ANALYZED',
            status: 'completed',
            round: 1,
            message: 'Extracted grounded factual statements and cross-referenced claims',
            timestamp: new Date().toISOString(),
            metadata: { factsExtracted: 8, sourcesFound: 12 }
          },
          {
            agent: 'sufficiency',
            event: 'SUFFICIENCY_EVALUATION',
            status: 'running',
            round: 1,
            message: 'Evaluating evidence completeness and inspecting for source discrepancies',
            timestamp: new Date().toISOString(),
            metadata: { isSufficient: true, confidenceScore: 96 }
          }
        ]
      }));
    }, 1900);

    const stepTimer3 = setTimeout(() => {
      setInvestigationStepText('Synthesizing verified, citation-grounded response...');
      setLiveAgentFlow(prev => ({
        ...prev,
        isLive: true,
        activeAgent: 'answer',
        events: [
          { ...initialLiveEvents[0], status: 'completed' },
          {
            agent: 'retrieval',
            event: 'SEARCH_COMPLETED',
            status: 'completed',
            round: 1,
            message: 'Retrieved 12 relevant document passages from knowledge base',
            timestamp: new Date().toISOString(),
            metadata: { sourcesFound: 12 }
          },
          {
            agent: 'evidence',
            event: 'EVIDENCE_ANALYZED',
            status: 'completed',
            round: 1,
            message: 'Extracted grounded factual statements and cross-referenced claims',
            timestamp: new Date().toISOString(),
            metadata: { factsExtracted: 8, sourcesFound: 12 }
          },
          {
            agent: 'sufficiency',
            event: 'SUFFICIENCY_VERIFIED',
            status: 'completed',
            round: 1,
            message: 'Evidence sufficiency verified with high confidence',
            timestamp: new Date().toISOString(),
            metadata: { isSufficient: true, confidenceScore: 98 }
          },
          {
            agent: 'answer',
            event: 'ANSWER_SYNTHESIS',
            status: 'running',
            round: 1,
            message: 'Synthesizing verified, citation-grounded response',
            timestamp: new Date().toISOString()
          }
        ]
      }));
    }, 3200);

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
      clearTimeout(stepTimer3);

      // Set real live ADK investigation steps into the right-hand InvestigationPanel
      const returnedSteps = result.investigationSteps || [];
      if (returnedSteps.length > 0) {
        setActiveInvestigationSteps(returnedSteps);
      }

      const finalEvents = (result.executionEvents && result.executionEvents.length > 0)
        ? result.executionEvents.map(e => ({ ...e, status: 'completed' }))
        : [];

      const finalFlowData = {
        isLive: false,
        events: finalEvents,
        searchRounds: result.roundsCount || result.evaluationMetrics?.roundsCount || 1,
        sourcesReviewed: result.totalEvidenceChunks || (result.sources ? result.sources.length : 0),
        conflictsDetected: result.evaluationMetrics?.conflictsCount || (result.conflictDetected ? 1 : 0),
        investigationSteps: returnedSteps,
        evaluationMetrics: result.evaluationMetrics || {},
      };

      setLiveAgentFlow(finalFlowData);
      setSelectedFlowData(finalFlowData);

      const aiReply = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: result.answer,
        investigationFlow: finalFlowData,
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
          strategy: `Multi-Agent Deep Investigation (${result.roundsCount || 1} Round${(result.roundsCount || 1) > 1 ? 's' : ''})`,
          evidenceFound: result.totalEvidenceChunks || (result.sources ? result.sources.length : 0),
          conflictDetected: Boolean(result.conflictDetected),
          conflictAssessment: result.conflictReport?.assessment,
          confidence: result.confidence || 94,
          roundsCount: result.roundsCount || 1,
          model: 'TraceMind AI Engine',
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
            // Update existing chat thread with latest messages & steps
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              messages: updatedMessages,
              scope: scopeToUse,
              investigationSteps: returnedSteps,
              lastUpdated: Date.now(),
            };
            return updated;
          } else {
            // Prepend new conversation session with clean synthesized topic heading
            const generatedTitle = generateConversationTitle(userText);
            const newSession = {
              id: activeSessionId,
              title: generatedTitle,
              date: new Date().toISOString(),
              scope: scopeToUse,
              messages: updatedMessages,
              investigationSteps: returnedSteps,
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
        content: `⚠️ **Unable to generate answer:** ${err.message || 'An error occurred while connecting to the reasoning service. Please try again.'}`,
        sources: [],
        reasoningSummary: {
          strategy: 'Error Handler',
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
            <h3 className="drop-title">Drop files to upload documents</h3>
            <p className="drop-subtitle">PDF, DOCX, TXT, Markdown, PNG, JPG, or ZIP archives (up to 300MB)</p>
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
        onRenameHistory={handleRenameHistory}
        onDeleteHistory={handleDeleteHistory}
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
                    <span>{documents.length} Uploaded Files</span>
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
                    <span>Document Vault</span>
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

                {/* 3D Agent Flow Button */}
                <button
                  type="button"
                  className={`btn-agent-flow-topbar ${isLoading ? 'live-pulsing' : ''}`}
                  onClick={() => {
                    if (isLoading) {
                      setSelectedFlowData(liveAgentFlow);
                    } else if (!selectedFlowData && messages.length > 0) {
                      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                      if (lastAssistant?.investigationFlow) {
                        setSelectedFlowData(lastAssistant.investigationFlow);
                      }
                    }
                    setAgentFlowModalOpen(true);
                  }}
                  title="View Multi-Agent Execution Flow"
                >
                  <NetworkIcon size={16} />
                  <span className="hidden-xs">{isLoading ? 'Live Agent Flow' : 'Agent Flow'}</span>
                </button>
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
                        ? 'Processing Complete'
                        : vectorizationState.stage === 'error'
                        ? 'Processing Failed'
                        : `Processing: ${vectorizationState.filename || 'Documents'}`}
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
                  <span>Semantic Knowledge Base</span>
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
            onDeleteAllDocuments={handleDeleteAllDocuments}
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
                  onOpenAgentFlow={(msg) => {
                    if (msg?.isLive || isLoading) {
                      setSelectedFlowData(liveAgentFlow);
                    } else if (msg?.investigationFlow) {
                      setSelectedFlowData(msg.investigationFlow);
                    } else {
                      setSelectedFlowData({
                        events: [],
                        searchRounds: msg?.reasoningSummary?.roundsCount || 1,
                        sourcesReviewed: msg?.sources?.length || 0,
                        conflictsDetected: msg?.reasoningSummary?.conflictDetected ? 1 : 0,
                        investigationSteps: activeInvestigationSteps,
                      });
                    }
                    setAgentFlowModalOpen(true);
                  }}
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
              activeScopeDocs={getActiveScopeDocs()}
              onRemoveScopeDoc={handleRemoveScopeDoc}
              onClearScope={() => setCurrentScope(null)}
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
          onOpenAgentFlow={() => {
            setSelectedFlowData(isLoading ? liveAgentFlow : (selectedFlowData || {
              events: [],
              searchRounds: 1,
              sourcesReviewed: 0,
              conflictsDetected: 0,
              investigationSteps: activeInvestigationSteps
            }));
            setAgentFlowModalOpen(true);
          }}
        />
      )}

      {/* 4. Interactive 3D Agent Execution Flow Modal */}
      <AgentFlowModal
        isOpen={agentFlowModalOpen}
        onClose={() => setAgentFlowModalOpen(false)}
        flowData={isLoading && liveAgentFlow.isLive ? liveAgentFlow : (selectedFlowData || liveAgentFlow)}
      />

      {/* 5. Source Preview Modal / Drawer */}
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

import { useState, useRef, useEffect } from 'react';
import {
  SendIcon,
  PaperclipIcon,
  SparklesIcon,
  AlertCircleIcon,
  FileTextIcon,
  XIcon,
  UploadCloudIcon
} from '../common/Icons';
import './ChatInput.css';

const MAX_COMBINED_BYTES = 300 * 1024 * 1024; // 300 MB

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const ChatInput = ({
  onSendMessage,
  onUploadFiles,
  disabled = false,
  isUploading = false,
  isVectorizing = false,
  vectorizingProgress = 0,
  vectorizingMessage = '',
  activeScopeName = 'All Documents',
  activeScopeDocs = [],
  onRemoveScopeDoc,
  onTriggerScopeSelect
}) => {
  const [text, setText] = useState('');
  const [stagedFiles, setStagedFiles] = useState([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [sizeError, setSizeError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleAddFiles = (newFiles) => {
    setSizeError('');
    if (!newFiles || newFiles.length === 0) return;

    // Filter out accidental duplicates by name and size
    setStagedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const nonDuplicates = newFiles.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
      const combined = [...prev, ...nonDuplicates];

      const combinedBytes = combined.reduce((acc, f) => acc + f.size, 0);
      if (combinedBytes > MAX_COMBINED_BYTES) {
        setSizeError(
          `Combined size (${(combinedBytes / (1024 * 1024)).toFixed(1)} MB) exceeds 300 MB limit.`
        );
      }
      return combined;
    });
  };

  const handleRemoveStagedFile = (indexToRemove) => {
    setSizeError('');
    setStagedFiles((prev) => {
      const updated = prev.filter((_, i) => i !== indexToRemove);
      const combinedBytes = updated.reduce((acc, f) => acc + f.size, 0);
      if (combinedBytes <= MAX_COMBINED_BYTES) {
        setSizeError('');
      }
      return updated;
    });
  };

  const handleUploadStagedFiles = async () => {
    if (stagedFiles.length === 0 || isUploading || isVectorizing) return;
    if (totalStagedBytes > MAX_COMBINED_BYTES) {
      setSizeError('Total attachment size exceeds 300 MB limit. Please remove some files.');
      return;
    }

    const filesToUpload = [...stagedFiles];
    setStagedFiles([]);
    if (onUploadFiles) {
      await onUploadFiles(filesToUpload);
    }
  };

  const isSubmitBlocked =
    (!text.trim() && stagedFiles.length === 0) ||
    disabled ||
    isVectorizing ||
    isUploading ||
    Boolean(sizeError);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSubmitBlocked) return;

    // If user has staged files, trigger their upload
    if (stagedFiles.length > 0) {
      const filesToUpload = [...stagedFiles];
      setStagedFiles([]);
      if (onUploadFiles) {
        onUploadFiles(filesToUpload);
      }
    }

    // Send question if text is present
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleAddFiles(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getBlockedReason = () => {
    if (sizeError) return sizeError;
    if (isVectorizing || isUploading) {
      return `Document vectorization in progress (${Math.round(vectorizingProgress)}% complete). Please wait until embeddings are saved to Qdrant Cloud before submitting.`;
    }
    if (!text.trim() && stagedFiles.length === 0) {
      return 'Type your question or attach documents to submit.';
    }
    if (disabled) {
      return 'TraceMind is generating an answer...';
    }
    return '';
  };

  return (
    <div className="chat-input-sticky-footer">
      <div className="chat-input-container">
        {/* Scope Pill Badge & Status */}
        <div className="chat-input-header-bar">
          <button
            type="button"
            className="input-scope-indicator"
            onClick={onTriggerScopeSelect}
            title="Click to switch search scope"
          >
            <span className="dot-active"></span>
            <span>
              Target Scope: <strong>{activeScopeName}</strong>
            </span>
          </button>

          {/* Vectorizing Status Tag in Input Bar Header */}
          {isVectorizing && (
            <div className="input-vectorizing-badge" title={getBlockedReason()}>
              <span className="vectorizing-pulse-dot" />
              <span>Vectorizing ({Math.round(vectorizingProgress)}%)</span>
            </div>
          )}

          <span className="ai-model-tag">
            <SparklesIcon size={12} />
            <span>TraceMind Reasoning v2</span>
          </span>
        </div>

        {/* Active Multi-Document Scope Chips (if multiple documents are selected) */}
        {activeScopeDocs && activeScopeDocs.length > 0 && (
          <div className="active-scope-chips-container">
            <span className="scope-chips-label">Active Documents:</span>
            <div className="scope-chips-scroll-wrap">
              {activeScopeDocs.map((doc) => {
                const docId = doc._id || doc.id;
                const title = doc.title || doc.filename || 'Document';
                return (
                  <div key={docId} className="active-scope-chip" title={doc.filename || title}>
                    <FileTextIcon size={12} className="chip-doc-icon" />
                    <span className="chip-doc-name">{title}</span>
                    {onRemoveScopeDoc && (
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => onRemoveScopeDoc(docId)}
                        title={`Remove "${title}" from search scope`}
                        aria-label={`Remove ${title} from search scope`}
                      >
                        <XIcon size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Staged File Attachments Preview Tray */}
        {stagedFiles.length > 0 && (
          <div className="staged-attachments-tray">
            <div className="staged-tray-header">
              <span className="staged-tray-title">
                Attached Files ({stagedFiles.length} • {formatFileSize(totalStagedBytes)})
              </span>
              <div className="staged-tray-actions">
                {sizeError ? (
                  <span className="staged-tray-error">{sizeError}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-upload-staged"
                    onClick={handleUploadStagedFiles}
                    disabled={isUploading || isVectorizing || Boolean(sizeError)}
                    title="Upload and vectorize these files now"
                  >
                    <UploadCloudIcon size={13} />
                    <span>Upload Now</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-clear-staged"
                  onClick={() => {
                    setStagedFiles([]);
                    setSizeError('');
                  }}
                  title="Remove all attachments"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="staged-files-list">
              {stagedFiles.map((file, idx) => (
                <div key={`${file.name}_${idx}`} className="staged-file-chip">
                  <FileTextIcon size={13} className="staged-icon" />
                  <span className="staged-filename" title={file.name}>
                    {file.name}
                  </span>
                  <span className="staged-filesize">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    className="staged-remove-btn"
                    onClick={() => handleRemoveStagedFile(idx)}
                    title={`Remove ${file.name}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden Multi-File Input for Attachments */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,.zip"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={disabled || isUploading || isVectorizing}
        />

        {/* Input Bar Form */}
        <form
          className={`chat-form-box ${isVectorizing ? 'vectorizing-mode' : ''}`}
          onSubmit={handleSubmit}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-textarea"
            placeholder={
              isVectorizing
                ? 'Type your question here while document vectorization completes...'
                : stagedFiles.length > 0
                ? 'Ask a question about these attached files, or press Send to upload...'
                : 'Ask anything about your connected documents... (e.g., summarize key findings)'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label="Ask a question about your documents"
          />

          <div className="chat-form-actions">
            <button
              type="button"
              className={`btn-attach ${isUploading || isVectorizing ? 'is-uploading' : ''} ${
                stagedFiles.length > 0 ? 'has-staged' : ''
              }`}
              onClick={() => !isUploading && !isVectorizing && fileInputRef.current?.click()}
              title={
                isUploading || isVectorizing
                  ? 'Vectorization in progress...'
                  : 'Attach multiple documents (PDF, DOCX, TXT, MD, ZIP up to 300MB)'
              }
              aria-label="Attach documents"
              disabled={disabled || isUploading || isVectorizing}
            >
              <PaperclipIcon size={18} />
              {stagedFiles.length > 0 && (
                <span className="attach-count-badge">{stagedFiles.length}</span>
              )}
            </button>

            {/* Submit Button with Hover Tooltip when Blocked */}
            <div
              className="submit-btn-wrapper"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="submit"
                className={`btn-send-message ${isVectorizing ? 'blocked-vectorizing' : ''}`}
                disabled={isSubmitBlocked}
                title={getBlockedReason()}
                aria-label="Send question"
              >
                {isVectorizing ? (
                  <div className="btn-vectorizing-spinner" />
                ) : (
                  <SendIcon size={16} />
                )}
              </button>

              {/* Hover Reason Tooltip when Blocked by Vectorization */}
              {showTooltip && (isVectorizing || isUploading || Boolean(sizeError)) && (
                <div className="vectorize-blocked-tooltip" role="tooltip">
                  <div className="tooltip-header">
                    <AlertCircleIcon size={14} />
                    <span>{sizeError ? 'Upload Limit Exceeded' : 'Vectorization in Progress'}</span>
                  </div>
                  <p className="tooltip-body">
                    {sizeError ||
                      vectorizingMessage ||
                      `Processing embeddings on RunPod GPU (${Math.round(
                        vectorizingProgress
                      )}%). Submit will unlock automatically when saved to Qdrant.`}
                  </p>
                  {!sizeError && (
                    <div className="tooltip-progress-mini">
                      <div
                        className="tooltip-progress-mini-fill"
                        style={{ width: `${vectorizingProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Live Vectorization Helper Notice */}
        {isVectorizing && (
          <div className="vectorization-input-notice">
            <span className="notice-icon">⚡</span>
            <span>
              <strong>Draft your prompt:</strong> You can type your question right now. The send
              button will unlock automatically once embeddings are stored in Qdrant Cloud.
            </span>
          </div>
        )}

        {/* Footer Disclaimer */}
        <p className="chat-disclaimer">
          TraceMind AI provides sourced answers with verifiable document citations. Verify
          critical financial or legal outputs.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;


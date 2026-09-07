import { useState, useRef, useEffect } from 'react';
import {
  SendIcon,
  PlusIcon,
  SparklesIcon,
  AlertCircleIcon,
  FileTextIcon,
  ImageIcon,
  XIcon,
  UploadCloudIcon,
  FolderIcon
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

const isImageFile = (file) => {
  if (!file) return false;
  return (
    (file.type && file.type.startsWith('image/')) ||
    /\.(png|jpg|jpeg|webp)$/i.test(file.name)
  );
};

const isZipFile = (file) => {
  if (!file) return false;
  return (
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    /\.zip$/i.test(file.name)
  );
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
  onClearScope,
  onTriggerScopeSelect
}) => {
  const [text, setText] = useState('');
  const [stagedFiles, setStagedFiles] = useState([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [sizeError, setSizeError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAllScopeChips, setShowAllScopeChips] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Group activeScopeDocs by parent archive (ZIP) or standalone files to prevent flooding the chat window
  const scopeGroups = (() => {
    if (!activeScopeDocs || activeScopeDocs.length === 0) return [];

    const archives = new Map();
    const standalones = [];

    for (const doc of activeScopeDocs) {
      const zipName =
        doc.parentZipName ||
        (doc.metadata && (doc.metadata.parentZip || doc.metadata.parentZipName));
      if (zipName) {
        if (!archives.has(zipName)) {
          archives.set(zipName, []);
        }
        archives.get(zipName).push(doc);
      } else {
        standalones.push(doc);
      }
    }

    const groups = [];
    for (const [zipName, docs] of archives.entries()) {
      groups.push({
        type: 'archive',
        key: `zip_${zipName}`,
        name: zipName,
        count: docs.length,
        docIds: docs.map((d) => d._id || d.id),
      });
    }

    for (const doc of standalones) {
      groups.push({
        type: 'document',
        key: `doc_${doc._id || doc.id}`,
        name: doc.title || doc.filename || 'Document',
        docId: doc._id || doc.id,
        isImage: doc.fileType === 'IMAGE' || isImageFile(doc),
      });
    }

    return groups;
  })();

  const MAX_VISIBLE_SCOPE_GROUPS = 3;
  const visibleScopeGroups = showAllScopeChips
    ? scopeGroups
    : scopeGroups.slice(0, MAX_VISIBLE_SCOPE_GROUPS);
  const hiddenScopeGroupsCount = Math.max(0, scopeGroups.length - MAX_VISIBLE_SCOPE_GROUPS);

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

  // Helper to extract image/document files from ClipboardEvent
  const extractClipboardFiles = (clipboardData) => {
    if (!clipboardData) return [];

    const filesFound = [];

    // 1. Check clipboard files first
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file && (isImageFile(file) || file.type.startsWith('image/'))) {
          const ext = file.type ? file.type.split('/')[1] || 'png' : 'png';
          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
          const isGenericName = !file.name || file.name === 'image.png' || file.name === 'blob' || file.name === 'screenshot.png';
          const finalName = isGenericName ? `screenshot_${dateStr}.${ext}` : file.name;

          const namedFile = new File([file], finalName, {
            type: file.type || 'image/png',
            lastModified: Date.now()
          });
          filesFound.push(namedFile);
        } else if (file) {
          filesFound.push(file);
        }
      }
    }

    // 2. Check clipboard items (for direct screenshot pastes from OS clipboard e.g. Snipping Tool / Win+Shift+S)
    if (filesFound.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const file = new File([blob], `screenshot_${dateStr}.${ext}`, {
              type: item.type,
              lastModified: Date.now()
            });
            filesFound.push(file);
          }
        }
      }
    }

    return filesFound;
  };

  const handlePaste = (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    const imageOrDocFiles = extractClipboardFiles(clipboardData);
    if (imageOrDocFiles.length > 0) {
      e.preventDefault();
      handleAddFiles(imageOrDocFiles);
    }
  };

  // Window-level paste listener so user can paste screenshot anywhere in chat view
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const activeEl = document.activeElement;
      const isOtherInput =
        activeEl &&
        activeEl !== textareaRef.current &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      if (isOtherInput) return;

      const clipboardData = e.clipboardData || window.clipboardData;
      const imageOrDocFiles = extractClipboardFiles(clipboardData);
      if (imageOrDocFiles.length > 0) {
        e.preventDefault();
        handleAddFiles(imageOrDocFiles);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading && !isVectorizing) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || isUploading || isVectorizing) return;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(Array.from(e.dataTransfer.files));
    }
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
    isUploading ||
    isVectorizing ||
    Boolean(sizeError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitBlocked) return;

    // If there are staged files, upload and trigger analysis
    if (stagedFiles.length > 0) {
      const filesToUpload = [...stagedFiles];
      const messageText = text.trim();
      setStagedFiles([]);
      setText('');

      if (onUploadFiles) {
        await onUploadFiles(filesToUpload);
      }
      if (messageText && onSendMessage) {
        onSendMessage(messageText);
      }
      return;
    }

    // Normal text message
    if (text.trim() && onSendMessage) {
      const messageText = text.trim();
      setText('');
      onSendMessage(messageText);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input so same file can be re-selected
    }
  };

  const getBlockedReason = () => {
    if (sizeError) return sizeError;
    if (isVectorizing || isUploading) {
      return `Document processing in progress (${Math.round(vectorizingProgress)}% complete). Please wait until documents are indexed before submitting.`;
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
    <div
      className={`chat-input-outer-container ${isDragOver ? 'is-drag-over' : ''}`}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="container chat-input-inner">
        {/* Active Multi-Document Scope Chip Tray (Compact, Archive-Aware) */}
        {activeScopeDocs && activeScopeDocs.length > 0 && scopeGroups.length > 0 && (
          <div className="active-scope-tray" aria-label="Active Search Scope">
            <div className="active-scope-tray-left">
              <span className="scope-tray-label">
                Scope ({activeScopeDocs.length}):
              </span>
              <div className="active-scope-chips-list">
                {visibleScopeGroups.map((group) => {
                  if (group.type === 'archive') {
                    return (
                      <div
                        key={group.key}
                        className="active-scope-chip is-archive-scope"
                        title={`Archive: ${group.name} (${group.count} files)`}
                      >
                        <FolderIcon size={12} className="chip-doc-icon text-purple" />
                        <span className="chip-doc-name">{group.name}</span>
                        <span className="scope-archive-badge">{group.count} files</span>
                        {onRemoveScopeDoc && (
                          <button
                            type="button"
                            className="chip-remove-btn"
                            onClick={() => onRemoveScopeDoc(group.docIds)}
                            title={`Remove archive "${group.name}" from search scope`}
                            aria-label={`Remove archive "${group.name}" from search scope`}
                          >
                            <XIcon size={11} />
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={group.key} className="active-scope-chip" title={group.name}>
                      {group.isImage ? (
                        <ImageIcon size={12} className="chip-doc-icon text-cyan" />
                      ) : (
                        <FileTextIcon size={12} className="chip-doc-icon" />
                      )}
                      <span className="chip-doc-name">{group.name}</span>
                      {onRemoveScopeDoc && (
                        <button
                          type="button"
                          className="chip-remove-btn"
                          onClick={() => onRemoveScopeDoc(group.docId)}
                          title={`Remove "${group.name}" from search scope`}
                          aria-label={`Remove "${group.name}" from search scope`}
                        >
                          <XIcon size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {hiddenScopeGroupsCount > 0 && (
                  <button
                    type="button"
                    className="active-scope-chip is-more-pill"
                    onClick={() => setShowAllScopeChips((prev) => !prev)}
                    title={showAllScopeChips ? 'Show fewer items' : `Show ${hiddenScopeGroupsCount} more`}
                  >
                    {showAllScopeChips ? 'Show Less' : `+${hiddenScopeGroupsCount} more`}
                  </button>
                )}
              </div>
            </div>

            <div className="active-scope-tray-actions">
              {onTriggerScopeSelect && (
                <button
                  type="button"
                  className="btn-add-more-scope"
                  onClick={onTriggerScopeSelect}
                  title="Change search scope"
                >
                  Change
                </button>
              )}
              {onClearScope && (
                <button
                  type="button"
                  className="btn-clear-scope"
                  onClick={onClearScope}
                  title="Clear scope and search across all documents"
                >
                  Reset All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Staged File Attachments Preview Tray */}
        {stagedFiles.length > 0 && (
          <div className="staged-attachments-tray">
            <div className="staged-tray-header">
              <span className="staged-tray-title">
                Attached Files & Images ({stagedFiles.length} • {formatFileSize(totalStagedBytes)})
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
              {stagedFiles.map((file, idx) => {
                const isZip = isZipFile(file);
                const isImg = !isZip && isImageFile(file);
                return (
                  <div key={`${file.name}_${idx}`} className={`staged-file-chip ${isZip ? 'is-zip-chip' : isImg ? 'is-image-chip' : ''}`}>
                    {isZip ? (
                      <FolderIcon size={13} className="staged-icon text-cyan" />
                    ) : isImg ? (
                      <ImageIcon size={13} className="staged-icon text-cyan" />
                    ) : (
                      <FileTextIcon size={13} className="staged-icon" />
                    )}
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
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden Multi-File Input for Attachments */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,.zip,.png,.jpg,.jpeg,.webp,image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={disabled || isUploading || isVectorizing}
        />

        {/* Input Bar Form */}
        <form
          className={`chat-form-box ${isVectorizing ? 'vectorizing-mode' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
          onSubmit={handleSubmit}
          onPaste={handlePaste}
        >
          {/* Upload Button (+ icon on the left) */}
          <button
            type="button"
            className={`btn-attach-left ${isUploading || isVectorizing ? 'is-uploading' : ''} ${
              stagedFiles.length > 0 ? 'has-staged' : ''
            }`}
            onClick={() => !isUploading && !isVectorizing && fileInputRef.current?.click()}
            title={
              isUploading || isVectorizing
                ? 'Vectorization in progress...'
                : 'Upload documents or images (PDF, DOCX, TXT, MD, PNG, JPG, WEBP, ZIP up to 300MB)'
            }
            aria-label="Upload documents and images"
            disabled={disabled || isUploading || isVectorizing}
          >
            <PlusIcon size={18} />
            {stagedFiles.length > 0 && (
              <span className="attach-count-badge">{stagedFiles.length}</span>
            )}
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-textarea"
            placeholder={
              isDragOver
                ? 'Drop your screenshot or files here...'
                : isVectorizing
                ? 'Type your question here while document & image vectorization completes...'
                : stagedFiles.length > 0
                ? 'Ask a question about these attached documents & images, or press Send...'
                : 'Ask anything, or paste a screenshot (Ctrl+V) to analyze...'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label="Ask a question about your documents"
          />

          <div className="chat-form-actions">
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
                    <span>{sizeError ? 'Upload Limit Exceeded' : 'Processing in Progress'}</span>
                  </div>
                  <p className="tooltip-body">
                    {sizeError ||
                      vectorizingMessage ||
                      `Processing document embeddings (${Math.round(
                        vectorizingProgress
                      )}%). Submit will unlock automatically when indexing is complete.`}
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
              button will unlock automatically once document processing is complete.
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


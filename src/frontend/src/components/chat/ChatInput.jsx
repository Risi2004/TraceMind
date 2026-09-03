import { useState, useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon, SparklesIcon, AlertCircleIcon } from '../common/Icons';
import './ChatInput.css';

export const ChatInput = ({
  onSendMessage,
  onUploadFiles,
  disabled = false,
  isUploading = false,
  isVectorizing = false,
  vectorizingProgress = 0,
  vectorizingMessage = '',
  activeScopeName = 'All Documents',
  onTriggerScopeSelect
}) => {
  const [text, setText] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const isSubmitBlocked = !text.trim() || disabled || isVectorizing || isUploading;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitBlocked) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0 && onUploadFiles) {
      onUploadFiles(Array.from(files));
    }
    // Reset file input so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getBlockedReason = () => {
    if (isVectorizing || isUploading) {
      return `Document vectorization in progress (${Math.round(vectorizingProgress)}% complete). Please wait until embeddings are saved to Qdrant Cloud before submitting.`;
    }
    if (!text.trim()) {
      return 'Type your question to submit.';
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
            <span>Target Scope: <strong>{activeScopeName}</strong></span>
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

        {/* Hidden File Input for Attachments */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,.zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={disabled || isUploading || isVectorizing}
        />

        {/* Input Bar Form */}
        <form className={`chat-form-box ${isVectorizing ? 'vectorizing-mode' : ''}`} onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-textarea"
            placeholder={
              isVectorizing
                ? "Type your question here while document vectorization completes..."
                : "Ask anything about your connected documents... (e.g., summarize key risks)"
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
              className={`btn-attach ${isUploading || isVectorizing ? 'is-uploading' : ''}`}
              onClick={() => !isUploading && !isVectorizing && fileInputRef.current?.click()}
              title={
                isUploading || isVectorizing
                  ? "Vectorization in progress..."
                  : "Attach documents (PDF, DOCX, TXT, MD, ZIP up to 300MB)"
              }
              aria-label="Attach documents"
              disabled={disabled || isUploading || isVectorizing}
            >
              <PaperclipIcon size={18} />
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
              {showTooltip && (isVectorizing || isUploading) && (
                <div className="vectorize-blocked-tooltip" role="tooltip">
                  <div className="tooltip-header">
                    <AlertCircleIcon size={14} />
                    <span>Vectorization in Progress</span>
                  </div>
                  <p className="tooltip-body">
                    {vectorizingMessage || `Processing embeddings on RunPod GPU (${Math.round(vectorizingProgress)}%). Submit will unlock automatically when saved to Qdrant.`}
                  </p>
                  <div className="tooltip-progress-mini">
                    <div
                      className="tooltip-progress-mini-fill"
                      style={{ width: `${vectorizingProgress}%` }}
                    />
                  </div>
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
              <strong>Draft your prompt:</strong> You can type your question right now. The send button will unlock automatically once embeddings are stored in Qdrant Cloud.
            </span>
          </div>
        )}

        {/* Footer Disclaimer */}
        <p className="chat-disclaimer">
          TraceMind AI provides sourced answers with verifiable document citations. Verify critical financial or legal outputs.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;

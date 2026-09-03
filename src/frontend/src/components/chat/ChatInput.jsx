import { useState, useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon, SparklesIcon } from '../common/Icons';
import './ChatInput.css';

export const ChatInput = ({
  onSendMessage,
  onUploadFiles,
  disabled = false,
  isUploading = false,
  activeScopeName = 'All Documents',
  onTriggerScopeSelect
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
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

  return (
    <div className="chat-input-sticky-footer">
      <div className="chat-input-container">
        {/* Scope Pill Badge */}
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
          disabled={disabled || isUploading}
        />

        {/* Input Bar Form */}
        <form className="chat-form-box" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-textarea"
            placeholder="Ask anything about your connected documents... (e.g., summarize key risks)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label="Ask a question about your documents"
          />

          <div className="chat-form-actions">
            <button
              type="button"
              className={`btn-attach ${isUploading ? 'is-uploading' : ''}`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              title={isUploading ? "Uploading documents..." : "Attach documents (PDF, DOCX, TXT, MD, ZIP up to 300MB)"}
              aria-label="Attach documents"
              disabled={disabled || isUploading}
            >
              <PaperclipIcon size={18} />
            </button>

            <button
              type="submit"
              className="btn-send-message"
              disabled={!text.trim() || disabled}
              title="Send question"
              aria-label="Send question"
            >
              <SendIcon size={16} />
            </button>
          </div>
        </form>

        {/* Footer Disclaimer */}
        <p className="chat-disclaimer">
          TraceMind AI provides sourced answers with verifiable document citations. Verify critical financial or legal outputs.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;

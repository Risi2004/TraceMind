import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  FileTextIcon,
  ActivityIcon,
  NetworkIcon
} from '../common/Icons';
import { SourcesSection } from './SourcesSection';
import { MOCK_SUGGESTIONS, MOCK_CITATIONS_DATABASE } from '../../mock/chatMockData';
import './MessageList.css';

export const MessageList = ({
  messages = [],
  isLoading = false,
  investigationStep = 'Analyzing Evidence...',
  onSelectSuggestion,
  onOpenSourcePreview,
  onOpenInvestigation,
  onOpenAgentFlow,
  showCitations = true,
  showConfidence = true
}) => {
  const [copiedId, setCopiedId] = useState(null);


  const handleCopy = (msgId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to parse text with embedded citation tags [cit-X]
  const renderWithCitations = (content) => {
    if (typeof content !== 'string') return content;
    const parts = content.split(/(\[cit-\d+\])/g);

    if (parts.length === 1) return content;

    return parts.map((part, index) => {
      const match = part.match(/\[(cit-\d+)\]/);
      if (match) {
        const citationId = match[1];
        const citation = MOCK_CITATIONS_DATABASE[citationId];
        return (
          <button
            key={index}
            type="button"
            className="citation-inline-tag"
            onClick={() => citation && onOpenSourcePreview(citation)}
            title={`View Citation: ${citation ? citation.docTitle : citationId}`}
          >
            <FileTextIcon size={12} className="tag-icon" />
            <span>{citation ? citation.label : citationId}</span>
          </button>
        );
      }
      return part;
    });
  };

  // Custom markdown components for dark theme and citation tag support
  const markdownComponents = {
    p: ({ children }) => (
      <p className="md-paragraph">
        {Array.isArray(children)
          ? children.map((child, i) => (typeof child === 'string' ? renderWithCitations(child) : child))
          : typeof children === 'string'
            ? renderWithCitations(children)
            : children}
      </p>
    ),
    strong: ({ children }) => <strong className="md-strong">{children}</strong>,
    em: ({ children }) => <em className="md-em">{children}</em>,
    blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
    ul: ({ children }) => <ul className="md-ul">{children}</ul>,
    ol: ({ children }) => <ol className="md-ol">{children}</ol>,
    li: ({ children }) => (
      <li className="md-li">
        {Array.isArray(children)
          ? children.map((child, i) => (typeof child === 'string' ? renderWithCitations(child) : child))
          : typeof children === 'string'
            ? renderWithCitations(children)
            : children}
      </li>
    ),
    h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
    h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
    code: ({ inline, className, children, ...props }) => {
      if (inline) {
        return <code className="md-inline-code" {...props}>{children}</code>;
      }
      return (
        <pre className="md-code-block">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
        {children}
      </a>
    ),
    table: ({ children }) => <table className="md-table">{children}</table>,
    th: ({ children }) => <th className="md-th">{children}</th>,
    td: ({ children }) => <td className="md-td">{children}</td>,
  };


  // Empty State with Welcome & Suggestions
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="chat-empty-state">
        <div className="empty-state-card">
          <div className="empty-avatar-glow">
            <SparklesIcon size={28} className="empty-sparkle-icon" />
          </div>
          <h2 className="empty-title">How can I help you today?</h2>
          <p className="empty-subtitle">
            TraceMind performs multi-hop reasoning and deep semantic search across all your uploaded documents to deliver accurate, citation-backed answers.
          </p>
        </div>

        <div className="suggestions-grid">
          {MOCK_SUGGESTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="suggestion-prompt-card"
              onClick={() => onSelectSuggestion(item.text, item.scope)}
            >
              <div className="suggestion-top">
                <span className="suggestion-category">{item.category}</span>
                <SparklesIcon size={14} className="category-sparkle" />
              </div>
              <p className="suggestion-text">"{item.text}"</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="message-list-container">
      {messages.map((msg) => (
        <div key={msg.id} className={`message-row ${msg.role}`}>
          {/* Avatar */}
          <div className={`message-avatar ${msg.role}`}>
            {msg.role === 'assistant' ? (
              <SparklesIcon size={16} />
            ) : (
              <span>U</span>
            )}
          </div>

          {/* Message Bubble Container */}
          <div className="message-bubble-wrapper">
            <div className="message-header-info">
              <span className="message-sender">
                {msg.role === 'assistant' ? 'TraceMind AI' : 'You'}
              </span>
              <span className="message-timestamp">{msg.timestamp}</span>
              {msg.scope && (
                <span className="message-scope-tag">Scope: {msg.scope}</span>
              )}
            </div>

            {/* Content Card */}
            <div className={`message-bubble ${msg.role}`}>
              <div className="message-text">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <span className="user-message-content">{msg.content}</span>
                )}
              </div>


              {/* Verified Sources Accordion */}
              {showCitations && msg.role === 'assistant' && msg.citations && (
                <SourcesSection
                  citationIds={msg.citations}
                  onOpenSourcePreview={onOpenSourcePreview}
                  showConfidence={showConfidence}
                />
              )}

              {/* Assistant Message Actions */}
              {msg.role === 'assistant' && (
                <div className="message-actions-bar">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    title="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <CheckIcon size={13} className="text-emerald" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="action-btn text-blue"
                    onClick={onOpenInvestigation}
                    title="View Multi-Hop Investigation Trace"
                  >
                    <ActivityIcon size={13} />
                    <span>View Investigation</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn text-cyan view-agent-flow-btn"
                    onClick={() => onOpenAgentFlow && onOpenAgentFlow(msg)}
                    title="View 3D Interactive Agent Execution Flow"
                  >
                    <NetworkIcon size={13} />
                    <span>View Agent Flow</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      ))}

      {/* Loading & Investigation Progress Indicator */}
      {isLoading && (
        <div className="message-row assistant">
          <div className="message-avatar assistant pulse">
            <SparklesIcon size={16} />
          </div>
          <div className="message-bubble-wrapper">
            <div className="investigation-loading-card">
              <div className="loading-spinner-ring"></div>
              <div className="loading-content">
                <span className="loading-heading">TraceMind is investigating...</span>
                <span className="loading-current-step">{investigationStep}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

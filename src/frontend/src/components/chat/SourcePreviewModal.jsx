import { FileTextIcon, ShieldCheckIcon, CloseIcon, ExternalLinkIcon } from '../common/Icons';
import './SourcePreviewModal.css';

export const SourcePreviewModal = ({ source, onClose }) => {
  if (!source) return null;

  return (
    <div className="source-modal-overlay" onClick={onClose}>
      <div
        className="source-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="source-preview-title"
      >
        {/* Modal Top Header */}
        <div className="source-modal-header">
          <div className="modal-title-group">
            <div className="doc-icon-badge">
              <FileTextIcon size={18} />
            </div>
            <div>
              <h3 className="modal-doc-title" id="source-preview-title">{source.docTitle}</h3>
              <p className="modal-doc-meta">Page {source.pageNumber} • Verified Document Citation</p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close source preview"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="source-modal-body">
          {/* Match Score & Security Badge */}
          <div className="source-status-bar">
            <div className="match-score-pill">
              <ShieldCheckIcon size={16} />
              <span>Semantic Verification Match: <strong>{source.matchScore}</strong></span>
            </div>
            <span className="source-date-tag">Indexed: {source.date}</span>
          </div>

          {/* Section Breadcrumb */}
          <div className="source-section-header">
            <span className="section-label">Target Section:</span>
            <span className="section-value">{source.section}</span>
          </div>

          {/* Document Simulated Viewer / Excerpt */}
          <div className="document-page-preview">
            <div className="page-header-bar">
              <span className="page-indicator">DOCUMENT VIEWER - PAGE {source.pageNumber}</span>
              <span className="zoom-indicator">100% OCR Match</span>
            </div>

            <div className="passage-highlight-container">
              <div className="highlight-tag">Relevant Passage Extract</div>
              <blockquote className="passage-quote">
                "{source.snippet}"
              </blockquote>
            </div>

            <div className="page-context-mock">
              <p className="context-text-blurred">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="source-modal-footer">
          <span className="citation-hash">Citation ID: {source.id}</span>
          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn-secondary-modal"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn-primary-modal"
              onClick={() => alert(`Opening original document ${source.docTitle} at page ${source.pageNumber}`)}
            >
              <span>Open Document in Viewer</span>
              <ExternalLinkIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

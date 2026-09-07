import { useState } from 'react';
import { ShieldCheckIcon, ChevronDownIcon, FileTextIcon, ImageIcon, ExternalLinkIcon } from '../common/Icons';
import { MOCK_CITATIONS_DATABASE } from '../../mock/chatMockData';
import './SourcesSection.css';

export const SourcesSection = ({
  citationIds = [],
  onOpenSourcePreview,
  showConfidence = true
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!citationIds || citationIds.length === 0) return null;

  const citations = citationIds
    .map(id => MOCK_CITATIONS_DATABASE[id])
    .filter(Boolean);

  const isImageItem = (item) => {
    if (!item) return false;
    if (item.sourceType === 'image' || item.isImage) return true;
    if (typeof item.pageNumber === 'string' && item.pageNumber.toLowerCase().includes('image')) return true;
    const title = (item.docTitle || '').toLowerCase();
    return /\.(png|jpe?g|webp)$/i.test(title);
  };

  return (
    <div className="sources-section-container">
      {/* Header Bar */}
      <button
        type="button"
        className="sources-header-toggle"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
      >
        <div className="sources-header-left">
          <ShieldCheckIcon size={16} className="sources-shield-icon" />
          <span className="sources-title">Verified Sources & Evidence</span>
          <span className="sources-badge">{citations.length} Cited</span>
        </div>
        <ChevronDownIcon size={14} className={`sources-chevron ${isExpanded ? 'rotated' : ''}`} />
      </button>

      {/* Collapsible Source Cards */}
      {isExpanded && (
        <div className="sources-cards-grid">
          {citations.map((item) => {
            const isImg = isImageItem(item);
            return (
              <div
                key={item.id}
                className="source-card"
                onClick={() => onOpenSourcePreview(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenSourcePreview(item); }}
                title="Click to view full passage / vision inspection preview"
              >
                <div className="source-card-top">
                  <div className="source-doc-info">
                    {isImg ? (
                      <ImageIcon size={14} className="doc-icon image-evidence-icon" />
                    ) : (
                      <FileTextIcon size={14} className="doc-icon" />
                    )}
                    <span className="source-doc-name">{item.docTitle}</span>
                  </div>
                  {showConfidence && (
                    <div className="source-match-tag">
                      <span>{item.matchScore}</span>
                    </div>
                  )}
                </div>

                <div className="source-card-meta">
                  <span className={`source-page-badge ${isImg ? 'image-badge' : ''}`}>
                    {isImg ? 'Image Evidence' : `Page ${item.pageNumber}`}
                  </span>
                  <span className="source-section-name">{item.section}</span>
                </div>

                <p className="source-snippet-text">
                  "{item.snippet}"
                </p>

                <div className="source-card-footer">
                  <span className="preview-cta">
                    <span>{isImg ? 'View Vision Detail' : 'View Passage'}</span>
                    <ExternalLinkIcon size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

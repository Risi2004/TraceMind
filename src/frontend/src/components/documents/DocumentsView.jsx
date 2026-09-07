import { useState } from 'react';
import {
  FileTextIcon,
  ImageIcon,
  SearchIcon,
  FilterIcon,
  TrashIcon,
  SparklesIcon,
  ExternalLinkIcon,
  CloseIcon,
  LayersIcon,
  AlertCircleIcon
} from '../common/Icons';
import './DocumentsView.css';

export const DocumentsView = ({
  documents = [],
  isLoading = false,
  error = '',
  onDeleteDocument,
  onSelectDocumentForChat,
  onViewDocument
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Format file size helper
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Safe dynamic filter logic
  const filteredDocuments = (documents || []).filter((doc) => {
    if (!doc) return false;

    const title = (doc.title || doc.originalName || '').toLowerCase();
    const filename = (doc.filename || '').toLowerCase();
    const format = (doc.fileType || doc.format || doc.type || 'PDF').toLowerCase();
    const status = (doc.status || 'uploaded').toLowerCase();

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      title.includes(query) ||
      filename.includes(query);

    const matchesFormat =
      selectedFormat === 'all' ||
      format === selectedFormat.toLowerCase() ||
      (selectedFormat === 'image' && ['image', 'png', 'jpg', 'jpeg', 'webp'].includes(format));

    const matchesStatus =
      selectedStatus === 'all' || status === selectedStatus.toLowerCase();

    return matchesSearch && matchesFormat && matchesStatus;
  });

  // Calculate stats dynamically from actual database records
  const totalSizeBytes = (documents || []).reduce((acc, d) => acc + (d?.sizeBytes || 0), 0);
  const totalSizeFormatted = formatBytes(totalSizeBytes);

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'ready':
      case 'indexed':
        return 'status-ready';
      case 'analyzing':
        return 'status-analyzing';
      case 'processing':
        return 'status-processing';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-uploaded';
    }
  };

  return (
    <div className="documents-view-container">
      {/* Top Header */}
      <header className="documents-view-header">
        <div className="documents-title-group">
          <div className="documents-header-icon-badge">
            <FileTextIcon size={22} />
          </div>
          <div>
            <div className="documents-title-row">
              <h1 className="documents-view-title">Document Repository</h1>
              <span className="documents-count-pill">{documents.length} Files</span>
            </div>
            <p className="documents-view-subtitle">
              Stored securely in private Cloudflare R2 bucket. Upload documents or images from the Chat workspace.
            </p>
          </div>
        </div>
      </header>

      {/* Metrics Summary Cards */}
      <div className="documents-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Documents</span>
          <span className="stat-value">{documents.length}</span>
          <span className="stat-meta">Cloudflare R2 Objects</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Storage Used</span>
          <span className="stat-value text-blue">{totalSizeFormatted}</span>
          <span className="stat-meta">Encrypted & Isolated</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Storage Provider</span>
          <span className="stat-value">Cloudflare R2</span>
          <span className="stat-meta">Private S3 API Bucket</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Access Control</span>
          <span className="stat-value-status">Private & Scoped</span>
          <span className="stat-meta">15m Presigned URLs</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="documents-toolbar">
        <div className="documents-search-wrapper">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="documents-search-input"
            placeholder="Search by filename or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        <div className="documents-filters-group">
          {/* Status Filter */}
          <div className="filter-select-wrapper">
            <FilterIcon size={14} className="filter-icon" />
            <select
              className="documents-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="analyzing">Analyzing (Vision)</option>
              <option value="processing">Processing (RAG)</option>
              <option value="indexed">Indexed</option>
              <option value="ready">Ready</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Format Filter */}
          <div className="filter-select-wrapper">
            <FilterIcon size={14} className="filter-icon" />
            <select
              className="documents-filter-select"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              aria-label="Filter by format"
            >
              <option value="all">All Formats</option>
              <option value="pdf">PDF Documents</option>
              <option value="image">Images (PNG/JPG/WEBP)</option>
              <option value="docx">Word (DOCX)</option>
              <option value="txt">Text (TXT)</option>
              <option value="md">Markdown (MD)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="documents-alert error" role="alert">
          <AlertCircleIcon size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="documents-loading-state">
          <div className="loading-spinner-ring" />
          <span>Loading documents from Cloudflare R2...</span>
        </div>
      )}

      {/* Documents Grid / Empty State */}
      {!isLoading && filteredDocuments.length === 0 ? (
        <div className="documents-empty-state">
          <div className="empty-icon-circle">
            <LayersIcon size={32} />
          </div>
          <h3 className="empty-title">
            {documents.length === 0 ? 'No documents uploaded yet' : 'No matching documents found'}
          </h3>
          <p className="empty-desc">
            {documents.length === 0
              ? 'Upload your PDF, DOCX, TXT, Markdown, Images (PNG/JPG/WEBP), or ZIP files directly from the Chat workspace using the attachment button or drag & drop.'
              : 'Try adjusting your search query or format filters.'}
          </p>
        </div>
      ) : (
        <div className="documents-cards-grid">
          {filteredDocuments.map((doc) => {
            const docId = doc._id || doc.id;
            const format = (doc.fileType || doc.format || doc.type || 'PDF').toUpperCase();
            const formatClass = format.toLowerCase();
            const displayTitle = doc.title || doc.originalName || doc.filename || 'Untitled Document';
            const displayFilename = doc.originalName || doc.filename || 'document';
            const sizeLabel = doc.sizeFormatted || formatBytes(doc.sizeBytes);
            const status = doc.status || 'uploaded';
            const createdDate = doc.createdAt
              ? new Date(doc.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent';

            return (
              <div key={docId} className="document-item-card">
                <div className="doc-card-top">
                  <div className="doc-format-badge" data-format={formatClass}>
                    {format}
                  </div>
                  <div className={`doc-status-badge ${getStatusBadgeClass(status)}`}>
                    <span className="status-dot"></span>
                    <span className="status-text">{status}</span>
                  </div>
                </div>

                <div className="doc-card-body">
                  <h3 className="doc-card-title" title={displayTitle}>{displayTitle}</h3>
                  <p className="doc-card-filename" title={displayFilename}>{displayFilename}</p>
                  
                  <div className="doc-meta-tags">
                    <span className="doc-meta-item">
                      <span>{sizeLabel}</span>
                    </span>
                    {doc.metadata?.totalPages && doc.metadata.totalPages > 0 && (
                      <>
                        <span className="doc-meta-divider">•</span>
                        <span className="doc-meta-item">
                          <span>{doc.metadata.totalPages} Page{doc.metadata.totalPages > 1 ? 's' : ''}</span>
                        </span>
                      </>
                    )}
                    {doc.metadata?.chunksCount !== undefined && doc.metadata.chunksCount > 0 && (
                      <>
                        <span className="doc-meta-divider">•</span>
                        <span className="doc-meta-item chunks-pill" title={`${doc.metadata.chunksCount} RAG Vector Chunks`}>
                          <span>{doc.metadata.chunksCount} Chunks</span>
                        </span>
                      </>
                    )}
                    <span className="doc-meta-divider">•</span>
                    <span className="doc-meta-item">
                      <span>{createdDate}</span>
                    </span>
                    {doc.source === 'zip_extract' && (
                      <>
                        <span className="doc-meta-divider">•</span>
                        <span className="doc-meta-item zip-tag" title={`Extracted from ${doc.parentZipName || 'ZIP'}`}>
                          <span>ZIP</span>
                        </span>
                      </>
                    )}
                  </div>
                  {doc.status === 'failed' && doc.errorMessage && (
                    <div className="doc-error-note" title={doc.errorMessage}>
                      <AlertCircleIcon size={12} />
                      <span>{doc.errorMessage}</span>
                    </div>
                  )}

                </div>

                <div className="doc-card-footer">
                  <button
                    type="button"
                    className="btn-card-action primary"
                    onClick={() => onSelectDocumentForChat && onSelectDocumentForChat(docId)}
                    title="Ask questions specifically scoped to this document"
                  >
                    <SparklesIcon size={14} />
                    <span>Chat in Scope</span>
                  </button>

                  <button
                    type="button"
                    className="btn-card-action secondary"
                    onClick={() => onViewDocument && onViewDocument(docId, doc)}
                    title="Securely View / Download from Cloudflare R2"
                  >
                    <ExternalLinkIcon size={14} />
                  </button>

                  {onDeleteDocument && (
                    <button
                      type="button"
                      className="btn-card-action danger"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to permanently delete "${displayTitle}" from Cloudflare R2 storage?`)) {
                          onDeleteDocument(docId);
                        }
                      }}
                      title="Permanently Delete Document"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentsView;

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
  AlertCircleIcon,
  FolderIcon,
  ChevronDownIcon
} from '../common/Icons';
import './DocumentsView.css';

export const DocumentsView = ({
  documents = [],
  isLoading = false,
  error = '',
  onDeleteDocument,
  onDeleteAllDocuments,
  onSelectDocumentForChat,
  onViewDocument
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'archives'
  const [expandedArchives, setExpandedArchives] = useState({});
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');

  const handleConfirmDeleteAll = async () => {
    if (!onDeleteAllDocuments) return;
    try {
      setIsDeletingAll(true);
      setDeleteAllError('');
      await onDeleteAllDocuments();
      setShowDeleteAllModal(false);
    } catch (err) {
      setDeleteAllError(err.message || 'Failed to delete all documents.');
    } finally {
      setIsDeletingAll(false);
    }
  };

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
    const relativePath = (doc.metadata?.relativePath || '').toLowerCase();
    const archiveName = (doc.parentZipName || '').toLowerCase();
    const format = (doc.fileType || doc.format || doc.type || 'PDF').toLowerCase();
    const status = (doc.status || 'uploaded').toLowerCase();

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      title.includes(query) ||
      filename.includes(query) ||
      relativePath.includes(query) ||
      archiveName.includes(query);

    const matchesFormat =
      selectedFormat === 'all' ||
      (selectedFormat === 'zip' && doc.source === 'zip_extract') ||
      format === selectedFormat.toLowerCase() ||
      (selectedFormat === 'image' && ['image', 'png', 'jpg', 'jpeg', 'webp'].includes(format));

    const matchesStatus =
      selectedStatus === 'all' || status === selectedStatus.toLowerCase();

    return matchesSearch && matchesFormat && matchesStatus;
  });

  // Calculate stats dynamically from actual database records
  const totalSizeBytes = (documents || []).reduce((acc, d) => acc + (d?.sizeBytes || 0), 0);
  const totalSizeFormatted = formatBytes(totalSizeBytes);

  // Group by Archive
  const archiveGroups = {};
  const standaloneDocs = [];

  for (const doc of filteredDocuments) {
    if (doc.source === 'zip_extract' && doc.parentZipName) {
      if (!archiveGroups[doc.parentZipName]) {
        archiveGroups[doc.parentZipName] = [];
      }
      archiveGroups[doc.parentZipName].push(doc);
    } else {
      standaloneDocs.push(doc);
    }
  }

  const toggleArchiveExpand = (archiveName) => {
    setExpandedArchives((prev) => ({
      ...prev,
      [archiveName]: prev[archiveName] === undefined ? false : !prev[archiveName],
    }));
  };

  const isArchiveExpanded = (archiveName) => {
    return expandedArchives[archiveName] !== false;
  };

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

  const uniqueArchiveCount = Object.keys(archiveGroups).length;

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
              {uniqueArchiveCount > 0 && (
                <span className="documents-count-pill zip-pill">
                  {uniqueArchiveCount} Archive{uniqueArchiveCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="documents-view-subtitle">
              Stored securely in encrypted Cloudflare R2 storage. Supports PDF, DOCX, TXT, MD, Images, and ZIP archives.
            </p>
          </div>
        </div>

        <div className="documents-header-actions">
          {/* View Mode Toggle */}
          <div className="documents-view-mode-toggle">
            <button
              type="button"
              className={`btn-view-toggle ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              <LayersIcon size={14} />
              <span>All Files</span>
            </button>
            <button
              type="button"
              className={`btn-view-toggle ${viewMode === 'archives' ? 'active' : ''}`}
              onClick={() => setViewMode('archives')}
            >
              <FolderIcon size={14} />
              <span>By Archive (ZIP)</span>
            </button>
          </div>

          {/* Delete All Files Button */}
          {documents.length > 0 && onDeleteAllDocuments && (
            <button
              type="button"
              className="btn-delete-all-docs"
              onClick={() => {
                setDeleteAllError('');
                setShowDeleteAllModal(true);
              }}
              disabled={isDeletingAll}
              title={`Permanently delete all ${documents.length} files from repository`}
            >
              <TrashIcon size={14} />
              <span>Delete All Files ({documents.length})</span>
            </button>
          )}
        </div>
      </header>

      {/* Metrics Summary Cards */}
      <div className="documents-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Documents</span>
          <span className="stat-value">{documents.length}</span>
          <span className="stat-meta">Active Ingested Files</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Storage Used</span>
          <span className="stat-value text-blue">{totalSizeFormatted}</span>
          <span className="stat-meta">Encrypted & Isolated in R2</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">ZIP Archives</span>
          <span className="stat-value text-cyan">{uniqueArchiveCount}</span>
          <span className="stat-meta">Decompressed & Indexed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Access Control</span>
          <span className="stat-value-status">Private & Scoped</span>
          <span className="stat-meta">Tenant Isolated Qdrant</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="documents-toolbar">
        <div className="documents-search-wrapper">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="text"
            className="documents-search-input"
            placeholder="Search by filename, relative path, or archive name..."
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
              <option value="zip">Extracted from ZIP</option>
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

      {/* Advanced Animated Holographic Scanner & Skeleton Grid Loader */}
      {isLoading && (
        <div className="documents-loading-container" role="status" aria-label="Loading documents">
          <div className="documents-scanner-card">
            <div className="scanner-graphic-wrapper">
              <div className="scanner-orbit-ring outer" />
              <div className="scanner-orbit-ring inner" />
              <div className="scanner-doc-badge">
                <FileTextIcon size={32} className="scanner-doc-icon" />
                <div className="scanner-beam-line" />
              </div>
            </div>
            <div className="scanner-text-block">
              <h3 className="scanner-title">
                <SparklesIcon size={16} className="text-cyan animate-pulse" />
                <span>Loading Document Repository...</span>
              </h3>
              <p className="scanner-desc">
                Decrypting storage buffers & syncing Qdrant vector status
              </p>
            </div>
            <div className="scanner-progress-track">
              <div className="scanner-progress-fill" />
            </div>
          </div>

          {/* Shimmering Skeleton Document Cards */}
          <div className="documents-skeleton-grid" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="doc-skeleton-card">
                <div className="skeleton-card-top">
                  <div className="skeleton-pill format" />
                  <div className="skeleton-pill status" />
                </div>
                <div className="skeleton-card-body">
                  <div className="skeleton-line title" />
                  <div className="skeleton-line title-short" />
                  <div className="skeleton-line path" />
                </div>
                <div className="skeleton-card-footer">
                  <div className="skeleton-pill meta" />
                  <div className="skeleton-btn" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredDocuments.length === 0 && (
        <div className="documents-empty-state">
          <div className="empty-icon-circle">
            <LayersIcon size={32} />
          </div>
          <h3 className="empty-title">
            {documents.length === 0 ? 'No documents uploaded yet' : 'No matching documents found'}
          </h3>
          <p className="empty-desc">
            {documents.length === 0
              ? 'Upload your PDF, DOCX, TXT, Markdown, Images (PNG/JPG/WEBP), or ZIP archives directly from the Chat workspace using the attachment button or drag & drop.'
              : 'Try adjusting your search query or format filters.'}
          </p>
        </div>
      )}

      {/* ARCHIVE GROUPED VIEW */}
      {!isLoading && viewMode === 'archives' && (
        <div className="archive-groups-list">
          {Object.entries(archiveGroups).map(([archiveName, files]) => {
            const isExpanded = isArchiveExpanded(archiveName);
            const readyCount = files.filter((f) => f.status === 'ready').length;
            const failedCount = files.filter((f) => f.status === 'failed').length;
            const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
            const archiveDocIds = files.map((f) => f._id || f.id);

            return (
              <div key={archiveName} className="archive-card-accordion">
                <div
                  className="archive-accordion-header"
                  onClick={() => toggleArchiveExpand(archiveName)}
                >
                  <div className="archive-header-info">
                    <div className="archive-folder-icon">
                      <FolderIcon size={20} />
                    </div>
                    <div>
                      <div className="archive-title-row">
                        <h3 className="archive-name">Archive: {archiveName}</h3>
                        <span className="archive-tag-pill">ZIP</span>
                      </div>
                      <p className="archive-subtitle">
                        {files.length} file{files.length > 1 ? 's' : ''} detected • {readyCount} successfully processed
                        {failedCount > 0 ? ` • ${failedCount} failed` : ''} • {formatBytes(totalBytes)} total
                      </p>
                    </div>
                  </div>

                  <div className="archive-header-actions">
                    <button
                      type="button"
                      className="btn-archive-chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDocumentForChat && onSelectDocumentForChat(archiveDocIds);
                      }}
                      title="Scope conversation to all files in this archive"
                    >
                      <SparklesIcon size={14} />
                      <span>Chat with Archive</span>
                    </button>
                    <div className={`archive-chevron ${isExpanded ? 'is-expanded' : ''}`}>
                      <ChevronDownIcon size={18} />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="archive-accordion-body">
                    <div className="archive-files-table">
                      {files.map((doc) => {
                        const docId = doc._id || doc.id;
                        const format = (doc.fileType || doc.format || doc.type || 'PDF').toUpperCase();
                        const formatClass = format.toLowerCase();
                        const displayTitle = doc.title || doc.originalName || doc.filename || 'Untitled';
                        const relativePath = doc.metadata?.relativePath || doc.originalName || doc.filename;
                        const sizeLabel = doc.sizeFormatted || formatBytes(doc.sizeBytes);
                        const status = doc.status || 'uploaded';

                        return (
                          <div key={docId} className="archive-file-row">
                            <div className="archive-file-main">
                              <span className="doc-format-badge-mini" data-format={formatClass}>
                                {format}
                              </span>
                              <div className="archive-file-details">
                                <span className="archive-file-path" title={relativePath}>
                                  {relativePath}
                                </span>
                                <span className="archive-file-meta">
                                  {sizeLabel}
                                  {doc.metadata?.chunksCount !== undefined && (
                                    <> • {doc.metadata.chunksCount} passages</>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="archive-file-status">
                              <div className={`doc-status-badge ${getStatusBadgeClass(status)}`}>
                                <span className="status-dot"></span>
                                <span className="status-text">{status}</span>
                              </div>
                            </div>

                            <div className="archive-file-actions">
                              <button
                                type="button"
                                className="btn-mini-action"
                                onClick={() => onSelectDocumentForChat && onSelectDocumentForChat(docId)}
                                title="Chat with this file"
                              >
                                <SparklesIcon size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-mini-action"
                                onClick={() => onViewDocument && onViewDocument(docId, doc)}
                                title="View/Download"
                              >
                                <ExternalLinkIcon size={13} />
                              </button>
                              {onDeleteDocument && (
                                <button
                                  type="button"
                                  className="btn-mini-action danger"
                                  onClick={() => {
                                    if (window.confirm(`Delete "${displayTitle}"?`)) {
                                      onDeleteDocument(docId);
                                    }
                                  }}
                                  title="Delete"
                                >
                                  <TrashIcon size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {standaloneDocs.length > 0 && (
            <div className="standalone-section">
              <h3 className="standalone-heading">Standalone Uploads ({standaloneDocs.length})</h3>
              <div className="documents-cards-grid">
                {standaloneDocs.map((doc) => renderDocCard(doc))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FLAT CARDS GRID VIEW */}
      {!isLoading && viewMode === 'all' && filteredDocuments.length > 0 && (
        <div className="documents-cards-grid">
          {filteredDocuments.map((doc) => renderDocCard(doc))}
        </div>
      )}

      {/* Delete All Documents Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="doc-modal-overlay" onClick={() => !isDeletingAll && setShowDeleteAllModal(false)}>
          <div className="doc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header">
              <div className="doc-modal-icon warning">
                <TrashIcon size={24} />
              </div>
              <div className="doc-modal-header-text">
                <h3 className="doc-modal-title">Delete All Files?</h3>
                <p className="doc-modal-subtitle">Permanent repository purge</p>
              </div>
            </div>

            <p className="doc-modal-desc">
              Are you sure you want to permanently delete all <strong>{documents.length} files</strong>?
              This will remove all documents, extracted images, ZIP archives, their vector embeddings in Qdrant, and storage files.
            </p>

            {deleteAllError && (
              <div className="doc-modal-error">
                <AlertCircleIcon size={14} />
                <span>{deleteAllError}</span>
              </div>
            )}

            <div className="doc-modal-alert">
              <span>⚠️ This action is irreversible and cannot be undone.</span>
            </div>

            <div className="doc-modal-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeletingAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-danger"
                onClick={handleConfirmDeleteAll}
                disabled={isDeletingAll}
              >
                {isDeletingAll ? (
                  <>
                    <div className="btn-modal-spinner" />
                    <span>Deleting All Files...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon size={15} />
                    <span>Yes, Delete All ({documents.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderDocCard(doc) {
    const docId = doc._id || doc.id;
    const format = (doc.fileType || doc.format || doc.type || 'PDF').toUpperCase();
    const formatClass = format.toLowerCase();
    const displayTitle = doc.title || doc.originalName || doc.filename || 'Untitled Document';
    const displayFilename = doc.metadata?.relativePath || doc.originalName || doc.filename || 'document';
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
          <p className="doc-card-filename" title={displayFilename}>
            {doc.parentZipName ? `${doc.parentZipName} / ${displayFilename}` : displayFilename}
          </p>
          
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
                <span className="doc-meta-item chunks-pill" title={`${doc.metadata.chunksCount} Indexed Passages`}>
                  <span>{doc.metadata.chunksCount} Passages</span>
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
            title="Securely View / Download Document"
          >
            <ExternalLinkIcon size={14} />
          </button>

          {onDeleteDocument && (
            <button
              type="button"
              className="btn-card-action danger"
              onClick={() => {
                if (window.confirm(`Are you sure you want to permanently delete "${displayTitle}" from storage?`)) {
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
  }
};

export default DocumentsView;

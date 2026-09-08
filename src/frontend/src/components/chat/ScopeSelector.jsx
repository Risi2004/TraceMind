import { useState, useRef, useEffect } from 'react';
import { LayersIcon, ChevronDownIcon, FileTextIcon, FolderIcon, CheckIcon } from '../common/Icons';
import './ScopeSelector.css';

export const ScopeSelector = ({ currentScope, onSelectScope, documents = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDocSelected = (docId) => {
    if (!currentScope) return false;
    if (Array.isArray(currentScope)) {
      return currentScope.includes(docId);
    }
    return currentScope === docId;
  };

  // Group real uploaded documents by ZIP archive if applicable
  const archiveMap = new Map();
  for (const doc of documents || []) {
    const zipName = doc.parentZipName || (doc.metadata && (doc.metadata.parentZip || doc.metadata.parentZipName));
    if (zipName) {
      if (!archiveMap.has(zipName)) {
        archiveMap.set(zipName, []);
      }
      archiveMap.get(zipName).push(doc._id || doc.id);
    }
  }

  const getActiveLabel = () => {
    if (!currentScope) {
      return 'Select Document Scope';
    }
    if (currentScope === 'all') {
      return `All Documents (${documents.length})`;
    }
    if (Array.isArray(currentScope)) {
      if (currentScope.length === 0) return 'Select Document Scope';
      if (currentScope.length === 1) {
        const doc = documents.find((d) => (d._id || d.id) === currentScope[0]);
        return doc ? doc.title || doc.filename : '1 Document Selected';
      }
      // Check if currentScope matches an archive
      for (const [zipName, docIds] of archiveMap.entries()) {
        if (docIds.length === currentScope.length && docIds.every((id) => currentScope.includes(id))) {
          return `${zipName} (${docIds.length} files)`;
        }
      }
      return `${currentScope.length} Documents Selected`;
    }
    const doc = (documents || []).find((d) => (d._id || d.id) === currentScope);
    if (doc) return doc.title || doc.filename || 'Selected Document';
    return 'Select Document Scope';
  };

  const handleSelect = (scopeId) => {
    onSelectScope(scopeId);
    setIsOpen(false);
  };

  const handleToggleDoc = (docId, e) => {
    // If shift key or already an array, toggle
    if (Array.isArray(currentScope)) {
      if (currentScope.includes(docId)) {
        const next = currentScope.filter((id) => id !== docId);
        onSelectScope(next.length === 0 ? null : next);
      } else {
        onSelectScope([...currentScope, docId]);
      }
    } else if (currentScope && currentScope !== 'all') {
      // Switch from single to multi if clicked another doc
      if (currentScope === docId) {
        onSelectScope(null);
      } else {
        onSelectScope([currentScope, docId]);
      }
    } else {
      onSelectScope(docId);
      setIsOpen(false);
    }
  };

  return (
    <div className="scope-selector-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`scope-selector-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Select document search scope"
      >
        <LayersIcon size={16} className="scope-icon" />
        <span className="scope-label">{getActiveLabel()}</span>
        <ChevronDownIcon size={14} className={`scope-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="scope-dropdown-menu" role="menu">
          <div className="scope-dropdown-section">
            <button
              type="button"
              className={`scope-menu-item ${currentScope === 'all' ? 'selected' : ''}`}
              onClick={() => handleSelect('all')}
              role="menuitem"
            >
              <LayersIcon size={15} />
              <span className="item-name">All Connected Documents</span>
              <span className="item-count">({documents.length})</span>
              {currentScope === 'all' && <CheckIcon size={14} className="check-icon" />}
            </button>
          </div>

          {archiveMap.size > 0 && (
            <div className="scope-dropdown-section">
              <span className="scope-section-title">Archives (ZIP)</span>
              {Array.from(archiveMap.entries()).map(([archiveName, docIds]) => {
                const isArchiveSelected =
                  Array.isArray(currentScope) &&
                  docIds.length === currentScope.length &&
                  docIds.every((id) => currentScope.includes(id));
                return (
                  <button
                    key={archiveName}
                    type="button"
                    className={`scope-menu-item ${isArchiveSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(docIds)}
                    role="menuitem"
                  >
                    <FolderIcon size={15} className="text-purple" />
                    <span className="item-name">{archiveName}</span>
                    <span className="item-count">({docIds.length} files)</span>
                    {isArchiveSelected && <CheckIcon size={14} className="check-icon" />}
                  </button>
                );
              })}
            </div>
          )}

          {documents && documents.length > 0 && (
            <div className="scope-dropdown-section">
              <span className="scope-section-title">
                Indexed Documents ({documents.length})
              </span>
              {documents.map((doc) => {
                const docId = doc._id || doc.id;
                const title = doc.title || doc.filename || 'Document';
                const size = doc.sizeFormatted || 'File';
                const selected = isDocSelected(docId);
                return (
                  <button
                    key={docId}
                    type="button"
                    className={`scope-menu-item ${selected ? 'selected' : ''}`}
                    onClick={(e) => handleToggleDoc(docId, e)}
                    role="menuitem"
                  >
                    <FileTextIcon size={15} />
                    <span className="item-name" title={title}>
                      {title}
                    </span>
                    <span className="item-pages">{size}</span>
                    {selected && <CheckIcon size={14} className="check-icon" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScopeSelector;


import { useState, useRef, useEffect } from 'react';
import { LayersIcon, ChevronDownIcon, FileTextIcon, FolderIcon, CheckIcon } from '../common/Icons';
import { MOCK_COLLECTIONS } from '../../mock/chatMockData';
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

  const getActiveLabel = () => {
    if (!currentScope) {
      return 'Select Document Scope';
    }
    if (currentScope === 'all') {
      return `All Documents (${documents.length})`;
    }
    const collection = MOCK_COLLECTIONS.find(c => c.id === currentScope);
    if (collection) return collection.name;
    const doc = (documents || []).find(d => (d._id || d.id) === currentScope);
    if (doc) return doc.title || doc.filename || 'Selected Document';
    return 'Select Document Scope';
  };


  const handleSelect = (scopeId) => {
    onSelectScope(scopeId);
    setIsOpen(false);
  };

  return (
    <div className="scope-selector-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`scope-selector-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
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

          <div className="scope-dropdown-section">
            <span className="scope-section-title">Collections</span>
            {MOCK_COLLECTIONS.map(col => (
              <button
                key={col.id}
                type="button"
                className={`scope-menu-item ${currentScope === col.id ? 'selected' : ''}`}
                onClick={() => handleSelect(col.id)}
                role="menuitem"
              >
                <FolderIcon size={15} />
                <span className="item-name">{col.name}</span>
                {currentScope === col.id && <CheckIcon size={14} className="check-icon" />}
              </button>
            ))}
          </div>

          {documents && documents.length > 0 && (
            <div className="scope-dropdown-section">
              <span className="scope-section-title">Indexed Documents ({documents.length})</span>
              {documents.map(doc => {
                const docId = doc._id || doc.id;
                const title = doc.title || doc.filename || 'Document';
                const size = doc.sizeFormatted || 'File';
                return (
                  <button
                    key={docId}
                    type="button"
                    className={`scope-menu-item ${currentScope === docId ? 'selected' : ''}`}
                    onClick={() => handleSelect(docId)}
                    role="menuitem"
                  >
                    <FileTextIcon size={15} />
                    <span className="item-name" title={title}>{title}</span>
                    <span className="item-pages">{size}</span>
                    {currentScope === docId && <CheckIcon size={14} className="check-icon" />}
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

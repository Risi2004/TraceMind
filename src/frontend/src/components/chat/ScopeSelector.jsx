import { useState, useRef, useEffect } from 'react';
import { LayersIcon, ChevronDownIcon, FileTextIcon, FolderIcon, CheckIcon } from '../common/Icons';
import { MOCK_COLLECTIONS, MOCK_DOCUMENTS } from '../../mock/chatMockData';
import './ScopeSelector.css';

export const ScopeSelector = ({ currentScope, onSelectScope }) => {
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
    const collection = MOCK_COLLECTIONS.find(c => c.id === currentScope);
    if (collection) return collection.name;
    const doc = MOCK_DOCUMENTS.find(d => d.id === currentScope);
    if (doc) return doc.title;
    return 'All Documents (12)';
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
                <span className="item-count">({col.count})</span>
                {currentScope === col.id && <CheckIcon size={14} className="check-icon" />}
              </button>
            ))}
          </div>

          <div className="scope-dropdown-section">
            <span className="scope-section-title">Individual Documents</span>
            {MOCK_DOCUMENTS.map(doc => (
              <button
                key={doc.id}
                type="button"
                className={`scope-menu-item ${currentScope === doc.id ? 'selected' : ''}`}
                onClick={() => handleSelect(doc.id)}
                role="menuitem"
              >
                <FileTextIcon size={15} />
                <span className="item-name">{doc.title}</span>
                <span className="item-pages">{doc.pages}p</span>
                {currentScope === doc.id && <CheckIcon size={14} className="check-icon" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

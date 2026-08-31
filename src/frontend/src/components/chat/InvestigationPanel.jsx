import { useState } from 'react';
import {
  ActivityIcon,
  SearchIcon,
  BrainIcon,
  ShieldCheckIcon,
  SparklesIcon,
  LayersIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  CloseIcon,
  CheckIcon
} from '../common/Icons';
import './InvestigationPanel.css';

export const InvestigationPanel = ({
  steps = [],
  isOpen,
  onClose,
  isInvestigating = false
}) => {
  const [expandedSteps, setExpandedSteps] = useState({ 0: true, 1: true, 5: true });

  const toggleStep = (index) => {
    setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getStepIcon = (iconName) => {
    switch (iconName) {
      case 'search': return <SearchIcon size={14} />;
      case 'brain': return <BrainIcon size={14} />;
      case 'alert': return <AlertCircleIcon size={14} />;
      case 'layers': return <LayersIcon size={14} />;
      case 'shield': return <ShieldCheckIcon size={14} />;
      case 'sparkles': return <SparklesIcon size={14} />;
      default: return <ActivityIcon size={14} />;
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="investigation-panel" aria-label="Investigation Activity Panel">
      {/* Header */}
      <div className="investigation-header">
        <div className="investigation-title-group">
          <div className={`activity-pulse-badge ${isInvestigating ? 'live' : ''}`}>
            <ActivityIcon size={16} />
          </div>
          <div>
            <h3 className="investigation-title">Investigation Activity</h3>
            <p className="investigation-subtitle">
              {isInvestigating ? 'AI Reasoning Active...' : 'Multi-Hop Verification Trace'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="investigation-close-btn"
          onClick={onClose}
          aria-label="Close investigation panel"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {/* Overview Stats Bar */}
      <div className="investigation-summary-bar">
        <div className="summary-metric">
          <span className="metric-label">Rounds</span>
          <span className="metric-value">2 Rounds</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Docs Inspected</span>
          <span className="metric-value">48 Pages</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Confidence</span>
          <span className="metric-value text-emerald">98.4%</span>
        </div>
      </div>

      {/* Steps Timeline Stream */}
      <div className="investigation-timeline">
        {steps.map((item, idx) => {
          const isExpanded = Boolean(expandedSteps[idx]);
          return (
            <div key={idx} className={`timeline-step-item ${item.status}`}>
              {/* Step Marker & Line */}
              <div className="step-marker-col">
                <div className={`step-circle ${item.status}`}>
                  {item.status === 'completed' ? (
                    <CheckIcon size={11} className="check-svg" />
                  ) : (
                    <span>{item.step}</span>
                  )}
                </div>
                {idx < steps.length - 1 && <div className="timeline-connector-line"></div>}
              </div>

              {/* Step Content */}
              <div className="step-content-col">
                <button
                  type="button"
                  className="step-header-btn"
                  onClick={() => toggleStep(idx)}
                  aria-expanded={isExpanded}
                >
                  <div className="step-header-left">
                    <span className="step-icon-tag">{getStepIcon(item.icon)}</span>
                    <span className="step-title-text">{item.title}</span>
                  </div>
                  <ChevronDownIcon size={13} className={`step-chevron ${isExpanded ? 'rotated' : ''}`} />
                </button>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="step-details-body">
                    {item.query && (
                      <div className="step-query-box">
                        <span className="box-tag">Target Scope / Query:</span>
                        <code>{item.query}</code>
                      </div>
                    )}

                    <p className="step-details-text">{item.details}</p>

                    {item.found && (
                      <div className="step-evidence-box">
                        <span className="box-tag text-blue">Evidence Collected:</span>
                        <p>{item.found}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

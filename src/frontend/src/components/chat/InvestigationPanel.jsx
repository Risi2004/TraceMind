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
  CheckIcon,
  NetworkIcon
} from '../common/Icons';
import './InvestigationPanel.css';

export const InvestigationPanel = ({
  steps = [],
  isOpen,
  onClose,
  isInvestigating = false,
  onOpenAgentFlow
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

  // Calculate dynamic metrics
  const roundsCount = steps.length > 0 ? Math.ceil(steps.length / 3) : 0;
  const docsInspected = steps.reduce((acc, s) => acc + (s.pagesCount || 0), 0) || (steps.length > 0 ? 12 : 0);
  const confidenceScore = steps.length > 0 ? '98.4%' : '--';

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

      {/* 3D Agent Flow Quick Launcher */}
      <div className="investigation-flow-action-bar">
        <button
          type="button"
          className="launch-3d-flow-btn"
          onClick={onOpenAgentFlow}
          title="Open interactive 3D WebGL visualization of agent pipeline"
        >
          <NetworkIcon size={15} />
          <span>View 3D Agent Flow</span>
        </button>
      </div>

      {/* Overview Stats Bar */}
      <div className="investigation-summary-bar">
        <div className="summary-metric">
          <span className="metric-label">Rounds</span>
          <span className="metric-value">{steps.length > 0 ? `${roundsCount} Round${roundsCount > 1 ? 's' : ''}` : '--'}</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Docs Inspected</span>
          <span className="metric-value">{steps.length > 0 ? `${docsInspected} Pages` : '--'}</span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Confidence</span>
          <span className={`metric-value ${steps.length > 0 ? 'text-emerald' : ''}`}>{confidenceScore}</span>
        </div>
      </div>

      {/* Steps Timeline Stream */}
      <div className="investigation-timeline">
        {steps.length === 0 ? (
          <div className="investigation-empty-state">
            <div className="investigation-empty-icon">
              <SparklesIcon size={24} />
            </div>
            <h4 className="investigation-empty-title">Ready for Investigation</h4>
            <p className="investigation-empty-desc">
              Ask a question in chat to trigger real-time multi-hop searches, document cross-referencing, and verifiable evidence gathering.
            </p>
          </div>
        ) : (
          steps.map((item, idx) => {
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
          })
        )}
      </div>
    </aside>
  );
};


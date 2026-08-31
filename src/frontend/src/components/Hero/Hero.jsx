import { SparklesIcon, SearchIcon, FileTextIcon, ArrowRightIcon } from '../common/Icons';
import { AppPreview } from '../AppPreview/AppPreview';
import './Hero.css';

export const Hero = ({ onNavigate = () => {} }) => {
  return (
    <section className="hero-section" id="hero">
      {/* Background Decorative Ambient Glows */}
      <div className="hero-glow-1" aria-hidden="true"></div>
      <div className="hero-glow-2" aria-hidden="true"></div>
      <div className="hero-grid-pattern" aria-hidden="true"></div>

      <div className="container hero-container">
        {/* Left Column: Copy & Actions */}
        <div className="hero-content">
          {/* Badge */}
          <div className="hero-badge">
            <SparklesIcon size={15} className="badge-icon" />
            <span>AI-Powered Document Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="hero-title">
            Understand Documents. <br className="hidden-mobile" />
            <span className="title-gradient">Find Answers.</span> <br className="hidden-mobile" />
            Get Clarity.
          </h1>

          {/* Supporting Subtitle */}
          <p className="hero-description">
            Transform complex reports, technical documentation, and enterprise archives into instantly searchable, verifiable knowledge. Extract insights with exact citation traceability.
          </p>

          {/* Call to Actions */}
          <div className="hero-actions">
            <button
              type="button"
              className="btn-hero-primary"
              onClick={() => onNavigate('/chat')}
            >
              <SearchIcon size={18} />
              <span>Ask a Question</span>
            </button>
            <button
              type="button"
              className="btn-hero-secondary"
              onClick={() => onNavigate('/login')}
            >
              <FileTextIcon size={18} />
              <span>Explore Documents</span>
              <ArrowRightIcon size={15} className="arrow-icon" />
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">Source Verifiable</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">&lt; 1s</span>
              <span className="stat-label">Retrieval Speed</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">50+</span>
              <span className="stat-label">Document Formats</span>
            </div>
          </div>
        </div>

        {/* Right Column: Embedded App Preview */}
        <div className="hero-preview-wrapper">
          <AppPreview onNavigate={onNavigate} />
        </div>
      </div>
    </section>
  );
};

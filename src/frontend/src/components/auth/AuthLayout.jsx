import { LogoIcon, ArrowLeftIcon } from '../common/Icons';
import './AuthLayout.css';

export const AuthLayout = ({ title, subtitle, children, onNavigate }) => {
  return (
    <div className="auth-wrapper">
      {/* Ambient background glows */}
      <div className="auth-glow-1" aria-hidden="true"></div>
      <div className="auth-glow-2" aria-hidden="true"></div>
      <div className="auth-grid-pattern" aria-hidden="true"></div>

      {/* Top Bar with Back to Home & Logo */}
      <header className="auth-header container">
        <button
          type="button"
          className="auth-back-link"
          onClick={() => onNavigate('/')}
        >
          <ArrowLeftIcon size={16} />
          <span>Back to Home</span>
        </button>

        <button
          type="button"
          className="auth-logo-brand"
          onClick={() => onNavigate('/')}
        >
          <LogoIcon size={30} />
          <span className="auth-brand-name">TraceMind</span>
        </button>
      </header>

      {/* Centered Auth Card Container */}
      <main className="auth-main-container">
        <div className="auth-card">
          <div className="auth-card-glow" aria-hidden="true"></div>
          
          <div className="auth-card-header">
            <h1 className="auth-title">{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </div>

          <div className="auth-card-body">
            {children}
          </div>
        </div>

        <p className="auth-footer-note">
          Protected by enterprise-grade encryption and source verification.
        </p>
      </main>
    </div>
  );
};

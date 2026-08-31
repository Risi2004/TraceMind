import { useState } from 'react';
import { LogoIcon, MenuIcon, CloseIcon } from '../common/Icons';
import './Navbar.css';

export const Navbar = ({ onNavigate = () => {} }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const handleNav = (path) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="navbar-wrapper">
      <div className="container navbar-container">
        {/* Brand Logo */}
        <button
          type="button"
          className="navbar-brand"
          onClick={() => handleNav('/')}
        >
          <LogoIcon size={32} />
          <span className="brand-name">TraceMind</span>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="navbar-links" aria-label="Main Navigation">
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#documents" className="nav-link">Documents</a>
          <a href="#about-us" className="nav-link">About Us</a>
          <a href="#contact" className="nav-link">Contact</a>
        </nav>

        {/* Right CTA Actions */}
        <div className="navbar-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => handleNav('/login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleNav('/signup')}
          >
            Get Started
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="mobile-toggle"
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <nav className="mobile-nav-links">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#documents" onClick={() => setMobileMenuOpen(false)}>Documents</a>
            <a href="#about-us" onClick={() => setMobileMenuOpen(false)}>About Us</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
          </nav>
          <div className="mobile-menu-actions">
            <button
              type="button"
              className="btn-ghost mobile-btn"
              onClick={() => handleNav('/login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="btn-primary mobile-btn"
              onClick={() => handleNav('/signup')}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

import { LogoIcon } from '../common/Icons';
import './Footer.css';

export const Footer = () => {
  return (
    <footer className="footer-wrapper" id="contact">
      <div className="container">
        <div className="footer-top">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <a href="#" className="footer-brand">
              <LogoIcon size={28} />
              <span className="footer-brand-name">TraceMind</span>
            </a>
            <p className="footer-tagline">
              AI-Powered Document Intelligence. Understand complex archives, verify sources, and find actionable answers with complete clarity.
            </p>
          </div>

          {/* Links Columns */}
          <div className="footer-links-grid">
            <div className="footer-col">
              <h4 className="footer-heading">Product</h4>
              <ul className="footer-links-list">
                <li><a href="#features">Features</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#documents">Document Engine</a></li>
                <li><a href="#preview">Interactive Workspace</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Solutions</h4>
              <ul className="footer-links-list">
                <li><a href="#">Financial Analysis</a></li>
                <li><a href="#">Legal & Compliance</a></li>
                <li><a href="#">Technical Research</a></li>
                <li><a href="#">Enterprise Knowledge</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Company</h4>
              <ul className="footer-links-list">
                <li><a href="#about-us">About Us</a></li>
                <li><a href="#contact">Contact Support</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p className="copyright-text">
            &copy; {new Date().getFullYear()} TraceMind. All rights reserved.
          </p>
          <div className="footer-badge">
            <span>AI Innovation Challenge</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

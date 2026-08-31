import { Navbar } from '../components/Navbar/Navbar';
import { Hero } from '../components/Hero/Hero';
import { Features } from '../components/Features/Features';
import { Footer } from '../components/Footer/Footer';

export const LandingPage = ({ onNavigate }) => {
  return (
    <div className="landing-page-wrapper">
      {/* Navigation Bar */}
      <Navbar onNavigate={onNavigate} />

      {/* Main Content Sections */}
      <main>
        <Hero onNavigate={onNavigate} />
        <Features />
      </main>

      {/* Footer */}
      <Footer onNavigate={onNavigate} />
    </div>
  );
};

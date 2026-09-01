import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ChatDashboard } from './pages/ChatDashboard';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { SparklesIcon } from './components/common/Icons';
import './App.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Client-side routing supporting /, /login, /signup, /verify-otp, /forgot-password, /chat (with hash fallback)
  const getInitialRoute = () => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/login' || path === '/login/') return '/login';
    if (path === '/signup' || path === '/signup/') return '/signup';
    if (path === '/verify-otp' || path === '/verify-otp/' || path === '/verify' || path === '/verify/') return '/verify-otp';
    if (path === '/forgot-password' || path === '/forgot-password/' || path === '/forgot') return '/forgot-password';
    if (path === '/chat' || path === '/chat/') return '/chat';

    // Hash fallback support (e.g. #/chat, #/login, #/verify-otp, #/forgot-password)
    const hash = window.location.hash.toLowerCase();
    if (hash === '#/login' || hash === '#login') return '/login';
    if (hash === '#/signup' || hash === '#signup') return '/signup';
    if (hash.startsWith('#/verify-otp') || hash.startsWith('#verify-otp') || hash.startsWith('#/verify')) return '/verify-otp';
    if (hash.startsWith('#/forgot-password') || hash.startsWith('#forgot-password') || hash.startsWith('#/forgot')) return '/forgot-password';
    if (hash === '#/chat' || hash === '#chat') return '/chat';

    return '/';
  };

  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);
  const [navState, setNavState] = useState({});

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path, state = {}) => {
    // Extract base route (e.g., /forgot-password from /forgot-password?email=...)
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const baseRoute = normalized.split('?')[0].split('#')[0];
    setNavState(state || {});
    if (window.location.pathname !== baseRoute || normalized.includes('?')) {
      window.history.pushState(state, '', normalized);
    }
    setCurrentRoute(baseRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading initial auth session
  if (isLoading) {
    return (
      <div className="auth-loading-screen" style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#070d1e',
        color: '#93c5fd',
        gap: '1rem'
      }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          border: '3px solid rgba(59, 130, 246, 0.2)',
          borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <SparklesIcon size={16} />
          <span>Connecting to TraceMind...</span>
        </div>
      </div>
    );
  }

  // Route protection resolution
  let activeView = currentRoute;
  if (currentRoute === '/chat' && !isAuthenticated) {
    activeView = '/login';
  } else if ((currentRoute === '/login' || currentRoute === '/signup' || currentRoute === '/verify-otp' || currentRoute === '/forgot-password') && isAuthenticated) {
    activeView = '/chat';
  }

  // Extract email from query or navState
  const searchParams = new URLSearchParams(window.location.search);
  const emailFromUrl = searchParams.get('email') || navState.email || '';

  return (
    <div className="app-root">
      {activeView === '/chat' && <ChatDashboard onNavigate={navigate} />}
      {activeView === '/login' && <LoginPage onNavigate={navigate} />}
      {activeView === '/signup' && <SignUpPage onNavigate={navigate} />}
      {activeView === '/verify-otp' && <VerifyOtpPage onNavigate={navigate} />}
      {activeView === '/forgot-password' && (
        <ForgotPasswordPage onNavigate={navigate} prefillEmail={emailFromUrl} />
      )}
      {activeView !== '/login' && activeView !== '/signup' && activeView !== '/verify-otp' && activeView !== '/forgot-password' && activeView !== '/chat' && (
        <LandingPage onNavigate={navigate} />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

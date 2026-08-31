import { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ChatDashboard } from './pages/ChatDashboard';
import './App.css';

function App() {
  // Client-side routing supporting /, /login, /signup, /chat (with hash fallback)
  const getInitialRoute = () => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/login' || path === '/login/') return '/login';
    if (path === '/signup' || path === '/signup/') return '/signup';
    if (path === '/chat' || path === '/chat/') return '/chat';
    
    // Hash fallback support (e.g. #/chat, #/login)
    const hash = window.location.hash.toLowerCase();
    if (hash === '#/login' || hash === '#login') return '/login';
    if (hash === '#/signup' || hash === '#signup') return '/signup';
    if (hash === '#/chat' || hash === '#chat') return '/chat';
    
    return '/';
  };

  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-root">
      {currentRoute === '/chat' && <ChatDashboard onNavigate={navigate} />}
      {currentRoute === '/login' && <LoginPage onNavigate={navigate} />}
      {currentRoute === '/signup' && <SignUpPage onNavigate={navigate} />}
      {currentRoute !== '/login' && currentRoute !== '/signup' && currentRoute !== '/chat' && (
        <LandingPage onNavigate={navigate} />
      )}
    </div>
  );
}

export default App;

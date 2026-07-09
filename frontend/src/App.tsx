import React, { useState, useEffect } from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import LandingPage from './components/LandingPage';
import { LanguageSelector } from './shared/i18n';
import ManagerDashboard from './components/ManagerDashboard';
import PharmacistWorkspace from './components/PharmacistWorkspace';
import ChangePasswordScreen from './components/ChangePasswordScreen';
import PharmacyLogo from './shared/PharmacyLogo';

export interface UserSession {
  token: string;
  id: string;
  username: string;
  role: 'MANAGER' | 'PHARMACIST';
  must_change_password?: boolean;
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Pharmacy Brand details loaded from API
  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: 'Imana Pharmacy',
    address: 'Bole Sub-City, Addis Ababa, Ethiopia',
    phone: '+251 11 661 2345',
    email: 'contact@imanapharma.com',
    logo_url: '/uploads/logo.png',
  });

  const API_URL = 'http://localhost:5001/api/v1';

  // Load settings details from the central backend
  const fetchPharmacyInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      if (res.ok) {
        setPharmacyInfo(await res.json());
      }
    } catch (err) {
      console.warn('Unable to reach backend Settings API, using default brand layout.');
    }
  };

  // Restore session from sessionStorage on load and setup fetch interceptor
  useEffect(() => {
    fetchPharmacyInfo();
    const saved = sessionStorage.getItem('pharmacy_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem('pharmacy_session');
      }
    }

    // Global fetch interceptor to catch 401 Unauthorized, append CSRF and credentials
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const initOptions = init || {};
      initOptions.credentials = 'include';
      
      // Inject headers dynamically from saved session
      const saved = sessionStorage.getItem('pharmacy_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.token) {
            initOptions.headers = {
              ...initOptions.headers,
              'Authorization': `Bearer ${parsed.token}`,
              'X-CSRF-Token': parsed.token,
            };
          }
        } catch {}
      }

      const response = await originalFetch(input, initOptions);
      if (response.status === 401) {
        // Token is invalid or expired (blacklisted)
        setSession(null);
        sessionStorage.removeItem('pharmacy_session');
        setShowLogin(true);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login credentials rejected');
      }

      const newSession: UserSession = {
        token: data.token,
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        must_change_password: data.user.must_change_password,
      };

      setSession(newSession);
      sessionStorage.setItem('pharmacy_session', JSON.stringify(newSession));
      setUsernameInput('');
      setPasswordInput('');
    } catch (err: any) {
      setLoginError(err.message || 'Unable to connect to Central Auth server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem('pharmacy_session');
    setShowLogin(false);
  };

  // --- Authenticated Layouts Routing ---
  if (session) {
    if (session.must_change_password) {
      return (
        <ChangePasswordScreen
          session={session}
          onLogout={handleLogout}
          onPasswordChanged={() => {
            const updated = { ...session, must_change_password: false };
            setSession(updated);
            sessionStorage.setItem('pharmacy_session', JSON.stringify(updated));
          }}
        />
      );
    }

    if (session.role === 'MANAGER') {
      return (
        <ManagerDashboard 
          session={session} 
          onLogout={handleLogout} 
          pharmacyInfo={pharmacyInfo} 
          onRefreshSettings={fetchPharmacyInfo} 
        />
      );
    }
    if (session.role === 'PHARMACIST') {
      return (
        <PharmacistWorkspace 
          session={session} 
          onLogout={handleLogout} 
          pharmacyInfo={pharmacyInfo} 
        />
      );
    }
  }

  // --- Login Screen ---
  if (showLogin) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-gray-900">
        <div className="w-full max-w-sm flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <button 
              onClick={() => setShowLogin(false)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors w-fit font-medium"
            >
              <ArrowLeft size={12} /> Back to Landing Page
            </button>
            <LanguageSelector />
          </div>

          <div className="card p-8 flex flex-col gap-6 text-left">
            {/* Logo and title */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <PharmacyLogo logoUrl={pharmacyInfo.logo_url} size={72} shape="circle" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{pharmacyInfo.name}</h1>
              <p className="text-xs text-gray-400 font-medium mt-1">Management Portal Log In</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-username" className="text-xs font-semibold text-gray-600">Username</label>
                <input
                  id="login-username"
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="Enter username..."
                  className="input-field"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-password" className="text-xs font-semibold text-gray-600">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="Enter password..."
                  className="input-field"
                  required
                  autoComplete="current-password"
                />
              </div>

              {loginError && (
                <div className="alert-error text-xs p-2.5 font-semibold" role="alert">
                  {loginError}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="btn bg-blue-600 hover:bg-blue-700 text-white w-full h-11 text-sm font-bold gap-2 mt-1 shadow-sm"
              >
                <Lock size={14} />
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Landing Page ---
  return (
    <LandingPage 
      onNavigateToLogin={() => setShowLogin(true)} 
      pharmacyInfo={pharmacyInfo} 
    />
  );
}

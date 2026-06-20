import React, { useState, useEffect } from 'react';
import logo from './assets/logo.png';
import { 
  DollarSign, 
  Package, 
  RefreshCw, 
  FileText, 
  Activity, 
  User as UserIcon, 
  LogOut, 
  Lock, 
  Cloud, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import POSView from './components/POSView';
import AdminView from './components/AdminView';
import TransferView from './components/TransferView';
import AuditView from './components/AuditView';
import ReconciliationView from './components/ReconciliationView';

export interface UserSession {
  token: string;
  id: string;
  username: string;
  role: string;
  branchId: string;
}

export default function App() {
  const [activeView, setActiveView] = useState<'pos' | 'admin' | 'transfers' | 'audit' | 'reconciliation'>('pos');
  const [session, setSession] = useState<UserSession | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Connection states
  const [cloudOnline, setCloudOnline] = useState(false);
  const [edgeOnline, setEdgeOnline] = useState(false);

  // APIs URLs
  const cloudUrl = 'http://localhost:5000';
  const edgeUrl = 'http://localhost:5001';

  // Load session from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('pharmacy_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('pharmacy_session');
      }
    }
  }, []);

  // Poll connection states
  useEffect(() => {
    const checkConnection = async () => {
      // Check Cloud
      try {
        const cloudRes = await fetch(`${cloudUrl}/health`, { signal: AbortSignal.timeout(1000) });
        setCloudOnline(cloudRes.ok);
      } catch (e) {
        setCloudOnline(false);
      }

      // Check Local Edge
      try {
        const edgeRes = await fetch(`${edgeUrl}/health`, { signal: AbortSignal.timeout(1000) });
        setEdgeOnline(edgeRes.ok);
      } catch (e) {
        setEdgeOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // Try logging in locally first (offline capability)
    try {
      const loginRes = await fetch(`${edgeOnline ? edgeUrl : cloudUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      if (!loginRes.ok) {
        const err = await loginRes.json();
        throw new Error(err.message || 'Login failed');
      }

      const data = await loginRes.json();
      const newSession: UserSession = {
        token: data.accessToken,
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        branchId: data.user.branch_id,
      };

      setSession(newSession);
      localStorage.setItem('pharmacy_session', JSON.stringify(newSession));
    } catch (err: any) {
      setLoginError(err.message || 'Unable to connect to login services.');
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('pharmacy_session');
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        {/* Connection status banner inside login */}
        <div className="flex gap-4 mb-8 bg-white p-3 rounded-full border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className={`w-2.5 h-2.5 rounded-full ${cloudOnline ? 'bg-emerald-600' : 'bg-rose-500'}`}></span>
            <span className="font-medium">Cloud Backend: {cloudOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div className="w-px bg-slate-200 h-4"></div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className={`w-2.5 h-2.5 rounded-full ${edgeOnline ? 'bg-emerald-600' : 'bg-rose-500'}`}></span>
            <span className="font-medium">Branch Edge Node: {edgeOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-200 flex flex-col gap-6 shadow-lg relative overflow-hidden">
          <div className="text-center flex flex-col gap-2">
            <div className="flex justify-center mb-2">
              <div className="bg-slate-50 p-2 rounded-full border border-slate-200 w-24 h-24 flex items-center justify-center overflow-hidden shadow-sm">
                <img src={logo} alt="Imana Pharmacy Logo" className="object-contain w-full h-full" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600">
              ImanaPharma
            </h1>
            <p className="text-xs text-slate-500 font-medium">Multi-Branch Sync & Offline-First POS Engine</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
             <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Username</label>
              <input 
                type="text" 
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="e.g. cashier_north, pharmacist_north" 
                className="glass-input p-3 rounded-lg text-sm bg-white border border-slate-200 text-slate-900"
                required
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Enter password" 
                className="glass-input p-3 rounded-lg text-sm bg-white border border-slate-200 text-slate-900"
                required
              />
            </div>

            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-xs font-medium text-center">
                {loginError}
              </div>
            )}

             <button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold p-3.5 rounded-lg text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-sm border border-indigo-500/20"
            >
              <Lock size={16} /> Sign In
            </button>
          </form>

          <div className="text-center">
            <p className="text-[10px] text-slate-500">Seed user accounts: admin, cashier_north, pharmacist_north (all pass = password123)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shadow-sm">
        <div className="flex flex-col gap-8 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-full border border-slate-200 w-11 h-11 flex items-center justify-center overflow-hidden shadow-sm">
              <img src={logo} alt="Logo" className="object-contain w-full h-full" />
            </div>
            <div>
              <h2 className="text-base font-bold text-indigo-600">ImanaPharma</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Edge Terminal</p>
            </div>
          </div>

           {/* Nav Items */}
          <nav className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveView('pos')}
              className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${activeView === 'pos' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <DollarSign size={18} /> POS Checkout
            </button>
            
            <button 
              onClick={() => setActiveView('reconciliation')}
              className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${activeView === 'reconciliation' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Activity size={18} /> Shift Reconciliation
            </button>

            {/* Show Admin tools only for privileged accounts */}
            {['ADMIN', 'BRANCH_MANAGER'].includes(session.role) && (
              <>
                <button 
                  onClick={() => setActiveView('admin')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${activeView === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Package size={18} /> Stock Dashboard
                </button>

                <button 
                  onClick={() => setActiveView('transfers')}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${activeView === 'transfers' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <RefreshCw size={18} /> Stock Transfers
                </button>
              </>
            )}

            <button 
              onClick={() => setActiveView('audit')}
              className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${activeView === 'audit' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <FileText size={18} /> Immutable Logs
            </button>
          </nav>
        </div>

        {/* User Card */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col gap-4">
          {/* Health indicator */}
          <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Cloud Sync:</span>
              <div className="flex items-center gap-1.5">
                {cloudOnline ? (
                  <>
                    <span className="text-emerald-600 font-semibold">Online</span>
                    <Cloud size={12} className="text-emerald-600" />
                  </>
                ) : (
                  <>
                    <span className="text-rose-500 font-semibold">Offline</span>
                    <WifiOff size={12} className="text-rose-500" />
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Local API:</span>
              <div className="flex items-center gap-1.5">
                {edgeOnline ? (
                  <>
                    <span className="text-emerald-600 font-semibold">Online</span>
                    <Wifi size={12} className="text-emerald-600" />
                  </>
                ) : (
                  <>
                    <span className="text-rose-500 font-semibold">Offline</span>
                    <WifiOff size={12} className="text-rose-500" />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-200 text-indigo-600">
                <UserIcon size={16} />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-slate-900 truncate">{session.username}</h4>
                <p className="text-[10px] text-slate-500 truncate">{session.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* App view router */}
        {activeView === 'pos' && <POSView session={session} edgeUrl={edgeUrl} />}
        {activeView === 'admin' && <AdminView session={session} cloudUrl={cloudUrl} />}
        {activeView === 'transfers' && <TransferView session={session} cloudUrl={cloudUrl} />}
        {activeView === 'audit' && <AuditView session={session} cloudUrl={cloudUrl} />}
        {activeView === 'reconciliation' && <ReconciliationView session={session} edgeUrl={edgeUrl} />}
      </main>
    </div>
  );
}

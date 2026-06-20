import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Lock, Unlock, Calculator } from 'lucide-react';
import { UserSession } from '../App';

interface Shift {
  id: string;
  branch_id: string;
  user_id: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number;
  expected_closing_cash?: number;
  physical_closing_cash?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
}

interface ReconciliationViewProps {
  session: UserSession;
  edgeUrl: string;
}

export default function ReconciliationView({ session, edgeUrl }: ReconciliationViewProps) {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [openingInput, setOpeningInput] = useState<number>(0);
  const [closingInput, setClosingInput] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchCurrentShift = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${edgeUrl}/api/v1/shifts/current`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentShift(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
  }, [edgeUrl, session.token]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${edgeUrl}/api/v1/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({ openingCash: openingInput })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Opening shift failed');
      }

      setOpeningInput(0);
      setReconciliationResult(null);
      fetchCurrentShift();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${edgeUrl}/api/v1/shifts/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({ physicalClosingCash: closingInput })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Closing shift failed');
      }

      const result = await res.json();
      setReconciliationResult(result);
      setClosingInput(0);
      fetchCurrentShift();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
          <Calculator className="text-indigo-400" /> Cash Register Reconciliation
        </h1>
        <p className="text-slate-400 text-sm">Open shift registers, process blind cash counts, and track drawer variances.</p>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-semibold text-center">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading drawer shift details...</div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Shift State Dashboard */}
          <div className="glass-card p-6 rounded-2xl border border-slate-900 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Register Status</span>
              <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                currentShift ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {currentShift ? 'OPEN (ACTIVE)' : 'CLOSED (LOCKED)'}
              </span>
            </div>

            {currentShift ? (
              <div className="flex flex-col gap-2.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Shift Started:</span>
                  <span className="font-mono">{new Date(currentShift.opened_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Opening Starting Cash:</span>
                  <span className="font-mono font-bold text-white">{currentShift.opening_cash.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-900 pt-3">
                  <span>Shift Session ID:</span>
                  <span className="font-mono">{currentShift.id}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center gap-2">
                <Lock size={20} className="opacity-30" />
                <p>No active shift. Open drawer register to resume POS actions.</p>
              </div>
            )}
          </div>

          {/* Action form: open or close */}
          {!currentShift ? (
            <div className="glass-panel p-6 rounded-2xl border border-slate-900 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Unlock size={16} className="text-emerald-400" /> Open Register Shift
              </h3>
              <form onSubmit={handleOpenShift} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Starting Drawer Cash (ETB)</label>
                  <input 
                    type="number" 
                    value={openingInput || ''}
                    onChange={e => setOpeningInput(parseFloat(e.target.value) || 0)}
                    placeholder="Enter starting bank amount (e.g. 150)" 
                    className="glass-input p-3.5 rounded-xl text-sm bg-slate-950 border border-slate-900 font-mono text-emerald-400 font-bold"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold p-3.5 rounded-xl text-xs transition-colors border border-emerald-500/20"
                >
                  Verify and Open Shift
                </button>
              </form>
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-2xl border border-slate-900 flex flex-col gap-4 border-amber-500/10">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-amber-500" /> Close Register Shift (Blind Count)
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Count the physical cash in the drawer container and enter it below. The system compares it blind to recorded transactions.
              </p>
              <form onSubmit={handleCloseShift} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Counted Physical Cash (ETB)</label>
                  <input 
                    type="number" 
                    value={closingInput || ''}
                    onChange={e => setClosingInput(parseFloat(e.target.value) || 0)}
                    placeholder="Enter final counted amount (e.g. 275)" 
                    className="glass-input p-3.5 rounded-xl text-sm bg-slate-950 border border-slate-900 font-mono text-emerald-400 font-bold"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold p-3.5 rounded-xl text-xs transition-colors border border-amber-500/20"
                >
                  Verify Drawer and Close Shift
                </button>
              </form>
            </div>
          )}

          {/* Reconciliation Result panel */}
          {reconciliationResult && (
            <div className="glass-card p-6 rounded-2xl border border-slate-900 flex flex-col gap-4 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
                <Calculator size={18} className="text-indigo-400" /> Shift Closing Audit Report
              </h3>

              <div className="flex flex-col gap-2.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Opening Starting Bank:</span>
                  <span className="font-mono">{reconciliationResult.openingCash.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Sales Accumulated:</span>
                  <span className="font-mono">{reconciliationResult.cashSalesSum.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-900">
                  <span>Expected System Closing:</span>
                  <span className="font-mono">{reconciliationResult.expectedClosingCash.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Counted Physical closing:</span>
                  <span className="font-mono">{reconciliationResult.physicalClosingCash.toFixed(2)} ETB</span>
                </div>
                
                {/* Variance row */}
                <div className="flex justify-between font-bold pt-2 border-t border-slate-900">
                  <span>Calculated Register Variance:</span>
                  <span className={`font-mono text-sm ${
                    reconciliationResult.variance === 0 ? 'text-emerald-400' :
                    Math.abs(reconciliationResult.variance) >= 50 ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {reconciliationResult.variance > 0 ? '+' : ''}
                    {reconciliationResult.variance.toFixed(2)} ETB
                  </span>
                </div>
              </div>

              {/* Alert Message for Large variance */}
              {reconciliationResult.flagged ? (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold mt-2">
                  <ShieldAlert size={18} />
                  <span>Variance Flagged: Discrepancy exceeds limits (50 ETB). Security alert generated in central immutable audit ledger.</span>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold mt-2">
                  <CheckCircle2 size={18} />
                  <span>Register verified. No large variance flagged.</span>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

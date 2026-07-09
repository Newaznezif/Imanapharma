import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Lock, Unlock, Calculator, AlertTriangle, RefreshCw } from 'lucide-react';
import { UserSession } from '../App';

interface Shift {
  id: string; branch_id: string; user_id: string;
  opened_at: string; closed_at?: string;
  opening_cash: number; expected_closing_cash?: number;
  physical_closing_cash?: number; variance?: number;
  status: 'OPEN' | 'CLOSED';
}
interface ReconciliationViewProps { session: UserSession; edgeUrl: string; }

export default function ReconciliationView({ session, edgeUrl }: ReconciliationViewProps) {
  const [currentShift,         setCurrentShift]         = useState<Shift | null>(null);
  const [openingInput,         setOpeningInput]         = useState<number>(0);
  const [closingInput,         setClosingInput]         = useState<number>(0);
  const [loading,              setLoading]              = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<any | null>(null);
  const [errorMsg,             setErrorMsg]             = useState('');

  const fetchCurrentShift = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${edgeUrl}/api/v1/shifts/current`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setCurrentShift(await res.json());
      else setCurrentShift(null);
    } catch (e) { console.error(e); setCurrentShift(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCurrentShift(); }, [edgeUrl, session.token]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg('');
    try {
      const res = await fetch(`${edgeUrl}/api/v1/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ openingCash: openingInput }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Opening shift failed'); }
      setOpeningInput(0); setReconciliationResult(null); fetchCurrentShift();
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg('');
    try {
      const res = await fetch(`${edgeUrl}/api/v1/shifts/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ physicalClosingCash: closingInput }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Closing shift failed'); }
      const result = await res.json();
      setReconciliationResult(result); setClosingInput(0); fetchCurrentShift();
    } catch (err: any) { setErrorMsg(err.message); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calculator size={20} className="text-blue-600" /> Shift Reconciliation
          </h1>
          <p className="page-subtitle">Manage cash drawer sessions and reconcile end-of-shift balances</p>
        </div>
        <button id="btn-refresh-shift" onClick={fetchCurrentShift} className="btn-secondary btn-sm gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl flex flex-col gap-5">

          {errorMsg && (
            <div className="alert-error">
              <AlertTriangle size={15} />
              <span className="font-medium flex-1">{errorMsg}</span>
            </div>
          )}

          {/* ── Shift Status Card ──────────────────────────────────────────── */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Register Status</h2>
              {loading ? (
                <span className="badge badge-gray gap-1"><RefreshCw size={11} className="animate-spin" /> Loading…</span>
              ) : (
                <span className={`badge ${currentShift ? 'badge-green' : 'badge-red'}`}>
                  {currentShift ? '● Shift Open' : '● Shift Closed'}
                </span>
              )}
            </div>

            {currentShift ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Shift Started</span>
                  <span className="text-gray-800">{new Date(currentShift.opened_at).toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Opening Cash</span>
                  <span className="text-gray-900 font-semibold font-mono">{currentShift.opening_cash.toFixed(2)} ETB</span>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Shift Session ID</span>
                  <span className="text-gray-500 font-mono text-xs">{currentShift.id}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-3 text-gray-400 text-sm">
                <Lock size={16} className="opacity-40" />
                <span>No active shift. Open the cash drawer to begin POS operations.</span>
              </div>
            )}
          </div>

          {/* ── Open Shift Form ────────────────────────────────────────────── */}
          {!currentShift && (
            <div className="card p-5 flex flex-col gap-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Unlock size={16} className="text-green-600" /> Open Cash Drawer
              </h2>
              <p className="text-sm text-gray-500">
                Count your starting float and enter the opening cash amount to begin the shift.
              </p>
              <form id="open-shift-form" onSubmit={handleOpenShift} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="opening-cash" className="text-sm font-medium text-gray-700">Starting Drawer Cash (ETB)</label>
                  <input
                    id="opening-cash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingInput || ''}
                    onChange={e => setOpeningInput(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 5000.00"
                    className="input-field font-mono max-w-xs"
                    required
                  />
                </div>
                <div>
                  <button type="submit" className="btn-primary gap-2">
                    <Unlock size={15} /> Open Shift
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Close Shift Form ───────────────────────────────────────────── */}
          {currentShift && !reconciliationResult && (
            <div className="card p-5 flex flex-col gap-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Lock size={16} className="text-red-500" /> Close Shift & Reconcile
              </h2>
              <p className="text-sm text-gray-500">
                Count your physical cash and enter the closing amount. The system will calculate the variance.
              </p>
              <form id="close-shift-form" onSubmit={handleCloseShift} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="counted-cash" className="text-sm font-medium text-gray-700">Counted Physical Cash (ETB)</label>
                  <input
                    id="counted-cash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={closingInput || ''}
                    onChange={e => setClosingInput(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 12500.00"
                    className="input-field font-mono max-w-xs"
                    required
                  />
                </div>
                <div>
                  <button type="submit" id="btn-close-shift" className="btn btn-danger gap-2">
                    <Lock size={15} /> Close Shift & Submit
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Reconciliation Result ──────────────────────────────────────── */}
          {reconciliationResult && (
            <div className="card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-blue-600" /> Reconciliation Summary
                </h2>
                <span className="badge badge-blue">Shift Closed</span>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    <tr className="bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-600">Opening Cash</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{reconciliationResult.openingCash.toFixed(2)} ETB</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-600">Cash Sales Total</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">+{reconciliationResult.cashSalesSum.toFixed(2)} ETB</td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-600">Expected Closing</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{reconciliationResult.expectedClosingCash.toFixed(2)} ETB</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-600">Physical Counted</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{reconciliationResult.physicalClosingCash.toFixed(2)} ETB</td>
                    </tr>
                    <tr className={`font-bold border-t-2 ${Math.abs(reconciliationResult.variance) > 50 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <td className={`px-4 py-3 ${Math.abs(reconciliationResult.variance) > 50 ? 'text-red-700' : 'text-green-700'}`}>
                        Variance
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-lg ${Math.abs(reconciliationResult.variance) > 50 ? 'text-red-700' : 'text-green-700'}`}>
                        {reconciliationResult.variance.toFixed(2)} ETB
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {Math.abs(reconciliationResult.variance) > 50 ? (
                <div className="alert-error">
                  <AlertTriangle size={15} />
                  <span className="font-medium">Variance Flagged: Discrepancy exceeds 50 ETB threshold. A security alert has been generated in the central immutable audit ledger.</span>
                </div>
              ) : (
                <div className="alert-success">
                  <CheckCircle2 size={15} />
                  <span className="font-medium">Shift reconciled successfully. Variance is within acceptable limits.</span>
                </div>
              )}

              <button onClick={() => { setReconciliationResult(null); fetchCurrentShift(); }} className="btn-secondary self-start gap-2">
                <RefreshCw size={14} /> Start New Shift
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

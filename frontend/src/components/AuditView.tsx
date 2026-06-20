import { useState, useEffect } from 'react';
import { FileText, Search, ShieldCheck, RefreshCw } from 'lucide-react';
import { UserSession } from '../App';

interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action_type: string;
  timestamp: string;
  branch_id: string;
  branch_name: string;
  payload_snapshot: string;
  before_state?: string;
  after_state?: string;
}

interface AuditViewProps {
  session: UserSession;
  cloudUrl: string;
}

export default function AuditView({ session, cloudUrl }: AuditViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/audit/logs`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [cloudUrl, session.token]);

  const filteredLogs = logs.filter(log => {
    if (!filterAction) return true;
    return log.action_type.toLowerCase().includes(filterAction.toLowerCase()) || 
           log.username.toLowerCase().includes(filterAction.toLowerCase()) ||
           (log.branch_name && log.branch_name.toLowerCase().includes(filterAction.toLowerCase()));
  });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
            <FileText className="text-indigo-400" /> Immutable Audit Ledgers
          </h1>
          <p className="text-slate-400 text-sm">Review append-only records of sales, updates, and clinical safety bypass details.</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      {/* Search Filter input */}
      <div className="glass-card p-4 rounded-xl flex gap-3 items-center">
        <Search size={16} className="text-slate-500" />
        <input 
          type="text" 
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          placeholder="Filter by action type, branch name, or cashier username..." 
          className="glass-input bg-transparent border-0 outline-none w-full text-xs text-slate-300"
        />
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Audit Table (7 cols) */}
        <div className="lg:col-span-8 glass-panel rounded-2xl border border-slate-900 overflow-hidden shadow-xl">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading audit records from ledger...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Action Type</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Branch</th>
                    <th className="p-4 text-center">Receipt Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">No matching audit events recorded in ledger.</td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className={`hover:bg-slate-900/20 cursor-pointer ${selectedLog?.id === log.id ? 'bg-slate-900/40 text-white font-medium border-l-2 border-indigo-500' : ''}`}
                      >
                        <td className="p-4 text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action_type.includes('OVERRIDE') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' :
                            log.action_type.includes('BLOCK') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' :
                            'bg-slate-950 text-slate-400'
                          }`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="p-4 font-semibold">{log.username || 'system'}</td>
                        <td className="p-4 text-slate-400">{log.branch_name || 'Central Cloud'}</td>
                        <td className="p-4 text-center text-indigo-400 hover:text-indigo-300 font-bold">Inspect</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Payload Inspection (5 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-900 shadow-xl flex flex-col gap-5 h-full min-h-[300px]">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-400" /> Payload Inspector
            </h3>

            {!selectedLog ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-2 my-auto">
                <FileText size={24} className="opacity-30" />
                <p className="text-xs">Click on an audit event in the ledger table to inspect its structural payload snapshot.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Event UUID</span>
                  <span className="font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-900 truncate">{selectedLog.id}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Timestamp</span>
                  <span className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-900">{new Date(selectedLog.timestamp).toString()}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-sans">Payload Snapshot</span>
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-[250px] leading-relaxed">
                    {JSON.stringify(JSON.parse(selectedLog.payload_snapshot), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

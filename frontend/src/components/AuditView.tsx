import { useState, useEffect } from 'react';
import { FileText, Search, ShieldCheck, RefreshCw, X } from 'lucide-react';
import { UserSession } from '../App';

interface AuditLog {
  id: string; user_id: string; username: string; action_type: string;
  timestamp: string; branch_id: string; branch_name: string;
  payload_snapshot: string; before_state?: string; after_state?: string;
}
interface AuditViewProps { session: UserSession; cloudUrl: string; }

const ACTION_STYLE: Record<string, string> = {
  OVERRIDE: 'badge-amber',
  BLOCK:    'badge-red',
  SALE:     'badge-blue',
  TRANSFER: 'badge-teal',
};

function getActionStyle(action: string) {
  for (const key of Object.keys(ACTION_STYLE)) {
    if (action.includes(key)) return ACTION_STYLE[key];
  }
  return 'badge-gray';
}

export default function AuditView({ session, cloudUrl }: AuditViewProps) {
  const [logs, setLogs]               = useState<AuditLog[]>([]);
  const [loading, setLoading]         = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/audit/logs`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [cloudUrl, session.token]);

  const filteredLogs = logs.filter(log => {
    if (!filterAction) return true;
    const q = filterAction.toLowerCase();
    return log.action_type.toLowerCase().includes(q) ||
           log.username.toLowerCase().includes(q) ||
           (log.branch_name && log.branch_name.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Immutable Audit Ledger
          </h1>
          <p className="page-subtitle">Append-only records of sales, updates, and clinical safety events</p>
        </div>
        <button id="btn-refresh-logs" onClick={fetchLogs} className="btn-secondary btn-sm gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search bar */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="audit-search"
              type="text"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              placeholder="Filter by action type, branch, or user…"
              className="input-field pl-9 pr-8"
            />
            {filterAction && (
              <button onClick={() => setFilterAction('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Main split */}
        <div className="flex flex-1 gap-5 px-6 pb-6 overflow-hidden min-h-0">

          {/* ── Audit Table (left) ─────────────────────────────────────── */}
          <div className="flex-1 card overflow-hidden flex flex-col min-w-0">
            {loading ? (
              <div className="flex items-center justify-center flex-1 text-gray-400 text-sm gap-2">
                <RefreshCw size={15} className="animate-spin" /> Loading audit records…
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Timestamp</th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Action Type</th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>User</th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Branch</th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 1, textAlign: 'center' }}>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-400">
                          <FileText size={28} className="mx-auto mb-2 opacity-30" />
                          {filterAction ? `No events matching "${filterAction}"` : 'No audit events recorded.'}
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map(log => (
                        <tr
                          key={log.id}
                          id={`audit-row-${log.id.slice(0, 8)}`}
                          onClick={() => setSelectedLog(log)}
                          className={`cursor-pointer ${selectedLog?.id === log.id ? 'selected' : ''}`}
                        >
                          <td className="font-mono text-gray-500 text-xs whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td>
                            <span className={`badge ${getActionStyle(log.action_type)}`}>
                              {log.action_type}
                            </span>
                          </td>
                          <td className="font-medium text-gray-800">{log.username || 'system'}</td>
                          <td className="text-gray-500">{log.branch_name || 'Central Cloud'}</td>
                          <td className="text-center text-blue-600 text-xs font-medium hover:text-blue-800">
                            View →
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Payload Inspector (right) ──────────────────────────────── */}
          <div className="w-80 shrink-0 card flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <ShieldCheck size={15} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Payload Inspector</h3>
            </div>

            {!selectedLog ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3 p-6">
                <FileText size={32} className="opacity-20" />
                <p className="text-sm text-center">Click an audit event in the table to inspect its payload.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Event UUID</span>
                  <span className="font-mono text-xs text-gray-700 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200 truncate">
                    {selectedLog.id}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</span>
                  <span className={`badge self-start ${getActionStyle(selectedLog.action_type)}`}>
                    {selectedLog.action_type}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Timestamp</span>
                  <span className="text-sm text-gray-700">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User / Branch</span>
                  <span className="text-sm text-gray-700">
                    {selectedLog.username || 'system'} — {selectedLog.branch_name || 'Central'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payload Snapshot</span>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-[11px] font-mono overflow-auto flex-1 leading-relaxed">
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

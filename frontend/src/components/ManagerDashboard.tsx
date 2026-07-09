import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Package, TrendingUp, AlertTriangle, Plus, Edit2, Trash2,
  Upload, BarChart3, Receipt, FileText, CheckCircle2, X,
  HeartPulse, Search, Truck, Download, RefreshCw, Calendar,
  ShieldAlert, Activity, DollarSign, AlertOctagon, Clock, Filter
} from 'lucide-react';
import { UserSession } from '../App';

interface ManagerDashboardProps {
  session: UserSession;
  onLogout: () => void;
  pharmacyInfo: any;
  onRefreshSettings: () => void;
}

// ─── SVG Mini Bar Chart ───────────────────────────────────────────────────────
function MiniBarChart({ data, color = '#3B82F6' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 160; const h = 48; const gap = 4;
  const barW = (w - gap * (data.length - 1)) / data.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {data.map((v, i) => {
        const barH = Math.max(4, (v / max) * h);
        return (
          <rect
            key={i} x={i * (barW + gap)} y={h - barH}
            width={barW} height={barH}
            rx={3} fill={color} opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color, spark }: any) {
  return (
    <div className={`card p-5 flex flex-col gap-3 border-l-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-black text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace('border-', 'bg-').replace('-500', '-100')} ${color.replace('border-', 'text-').replace('-500', '-600')}`}>
          {icon}
        </div>
      </div>
      {spark && <MiniBarChart data={spark} color={color.includes('green') ? '#10B981' : color.includes('red') ? '#EF4444' : color.includes('amber') ? '#F59E0B' : '#3B82F6'} />}
    </div>
  );
}

export default function ManagerDashboard({ session, onLogout, pharmacyInfo, onRefreshSettings }: ManagerDashboardProps) {
  type Tab = 'dashboard' | 'users' | 'inventory' | 'patients' | 'sales' | 'reports' | 'settings' | 'audit' | 'suppliers';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Core Data ──────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState({
    totalProducts: 0, totalPharmacists: 0, totalSales: 0,
    totalRevenue: 0.0, lowStockItems: 0, nearExpiryItems: 0, expiredItems: 0,
  });
  const [charts, setCharts] = useState<any>({
    monthlySales: [], topSelling: [], slowMoving: [], paymentSummary: [],
    lowStockDetails: [], nearExpiryDetails: [], expiredDetails: [], inventoryValuation: [],
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [userQuery, setUserQuery] = useState('');
  const [medQuery, setMedQuery] = useState('');
  const [salesQuery, setSalesQuery] = useState('');
  const [salesStatus, setSalesStatus] = useState('');
  const [salesFrom, setSalesFrom] = useState('');
  const [salesTo, setSalesTo] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ id: '', username: '', password: '', role: 'PHARMACIST', is_active: true });
  const [userResetId, setUserResetId] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showMedModal, setShowMedModal] = useState(false);
  const [medForm, setMedForm] = useState({
    id: '', drug_name: '', category: 'OTC', strength: '', price: 0, quantity: 0,
    expiry_date: '', manufacturer: '', batch_number: '', barcode: '', min_reorder_level: 20
  });
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientForm, setPatientForm] = useState({ name: '', allergy_flags: '' });
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '' });
  const [settingsForm, setSettingsForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // ── Inventory inventory sub-tab ────────────────────────────────────────────
  const [invTab, setInvTab] = useState<'all' | 'low' | 'near_expiry' | 'expired'>('all');

  const API_URL = 'http://localhost:5001/api/v1';
  const authHeader = { Authorization: `Bearer ${session.token}` };

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    const res = await fetch(`${API_URL}/reports/dashboard-overview`, { headers: authHeader });
    if (res.ok) setOverview(await res.json());
  }, [session.token]);

  const fetchCharts = useCallback(async () => {
    const res = await fetch(`${API_URL}/reports/charts`, { headers: authHeader });
    if (res.ok) setCharts(await res.json());
  }, [session.token]);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_URL}/auth/users`, { headers: authHeader });
    if (res.ok) setUsers(await res.json());
  }, [session.token]);

  const fetchMedicines = useCallback(async () => {
    const res = await fetch(`${API_URL}/medicines?q=${medQuery}`, { headers: authHeader });
    if (res.ok) setMedicines(await res.json());
  }, [session.token, medQuery]);

  const fetchSales = useCallback(async () => {
    const p = new URLSearchParams();
    if (salesStatus) p.append('status', salesStatus);
    if (salesQuery) p.append('q', salesQuery);
    if (salesFrom) p.append('from', salesFrom);
    if (salesTo) p.append('to', salesTo);
    p.append('limit', '200');
    const res = await fetch(`${API_URL}/reports/sales-history?${p}`, { headers: authHeader });
    if (res.ok) setSales(await res.json());
  }, [session.token, salesStatus, salesQuery, salesFrom, salesTo]);

  const fetchPatients = useCallback(async () => {
    const res = await fetch(`${API_URL}/patients?q=${patientQuery}`, { headers: authHeader });
    if (res.ok) setPatients(await res.json());
  }, [session.token, patientQuery]);

  const fetchSuppliers = useCallback(async () => {
    const res = await fetch(`${API_URL}/suppliers`, { headers: authHeader });
    if (res.ok) setSuppliers(await res.json());
  }, [session.token]);

  const fetchPurchaseOrders = useCallback(async () => {
    const res = await fetch(`${API_URL}/purchase-orders`, { headers: authHeader });
    if (res.ok) setPurchaseOrders(await res.json());
  }, [session.token]);

  const loadAuditLogs = useCallback(async () => {
    setLoadingAuditLogs(true);
    const p = new URLSearchParams();
    if (auditQuery) p.append('q', auditQuery);
    if (auditFrom) p.append('from', auditFrom);
    if (auditTo) p.append('to', auditTo);
    p.append('limit', '200');
    const res = await fetch(`${API_URL}/reports/audit-logs?${p}`, { headers: authHeader });
    if (res.ok) setAuditLogs(await res.json());
    setLoadingAuditLogs(false);
  }, [session.token, auditQuery, auditFrom, auditTo]);

  useEffect(() => {
    fetchOverview(); fetchCharts(); fetchUsers(); fetchMedicines();
    fetchPatients(); fetchSales(); fetchSuppliers(); fetchPurchaseOrders();
    if (pharmacyInfo) setSettingsForm({ name: pharmacyInfo.name, address: pharmacyInfo.address, phone: pharmacyInfo.phone, email: pharmacyInfo.email });
  }, [pharmacyInfo]);

  useEffect(() => { if (activeTab === 'audit') loadAuditLogs(); }, [activeTab]);
  useEffect(() => { fetchMedicines(); }, [medQuery]);
  useEffect(() => { fetchSales(); }, [salesStatus, salesQuery, salesFrom, salesTo]);
  useEffect(() => { fetchPatients(); }, [patientQuery]);

  // ── Export helpers ─────────────────────────────────────────────────────────
  const handleExportCSV = (type: string) => {
    const url = `${API_URL}/reports/export/csv?type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.click();
  };

  const handleExportExcel = (type: string) => {
    const url = `${API_URL}/reports/export/excel?type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.click();
  };

  // ── Action handlers ────────────────────────────────────────────────────────
  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (userForm.id) {
        const res = await fetch(`${API_URL}/auth/users/${userForm.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ role: userForm.role, is_active: userForm.is_active })
        });
        if (!res.ok) throw new Error('Failed to update user');
        showMsg('success', 'User updated.');
      } else {
        const res = await fetch(`${API_URL}/auth/users`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ username: userForm.username, password: userForm.password, role: userForm.role })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed to create user'); }
        showMsg('success', `User "${userForm.username}" created.`);
      }
      setShowUserModal(false); fetchUsers();
    } catch (err: any) { showMsg('error', err.message); }
  };

  const handleToggleUserStatus = async (id: string, current: boolean) => {
    const res = await fetch(`${API_URL}/auth/users/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ is_active: !current })
    });
    if (res.ok) fetchUsers(); else showMsg('error', 'Failed to toggle status');
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/users/${userResetId}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ password: newResetPassword })
    });
    if (res.ok) { showMsg('success', 'Password reset.'); setUserResetId(''); setNewResetPassword(''); }
    else showMsg('error', 'Password reset failed');
  };

  const handleUnlockUser = async (id: string, username: string) => {
    const res = await fetch(`${API_URL}/auth/users/${id}/unlock`, { method: 'POST', headers: authHeader });
    if (res.ok) { showMsg('success', `"${username}" unlocked.`); fetchUsers(); }
    else showMsg('error', 'Failed to unlock');
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    const res = await fetch(`${API_URL}/auth/users/${id}`, { method: 'DELETE', headers: authHeader });
    if (res.ok) { showMsg('success', `"${username}" deleted.`); fetchUsers(); }
    else showMsg('error', 'Failed to delete');
  };

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...medForm, price: Number(medForm.price), quantity: Number(medForm.quantity), min_reorder_level: Number(medForm.min_reorder_level) };
    const url = medForm.id ? `${API_URL}/medicines/${medForm.id}` : `${API_URL}/medicines`;
    const method = medForm.id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(payload) });
    if (res.ok) { showMsg('success', medForm.id ? 'Medicine updated.' : 'Medicine added.'); setShowMedModal(false); fetchMedicines(); fetchOverview(); }
    else showMsg('error', 'Failed to save medicine');
  };

  const handleDeleteMedicine = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`${API_URL}/medicines/${id}`, { method: 'DELETE', headers: authHeader });
    if (res.ok) { showMsg('success', `"${name}" deleted.`); fetchMedicines(); fetchOverview(); }
    else showMsg('error', 'Failed to delete');
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(settingsForm)
    });
    if (res.ok) { showMsg('success', 'Settings saved.'); onRefreshSettings(); }
    else showMsg('error', 'Failed to save settings');
  };

  const handleLogoUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!logoFile) return;
    const formData = new FormData(); formData.append('logo', logoFile);
    const res = await fetch(`${API_URL}/settings/logo`, { method: 'POST', headers: authHeader, body: formData });
    if (res.ok) { showMsg('success', 'Logo updated.'); setLogoFile(null); onRefreshSettings(); }
    else showMsg('error', 'Logo upload failed');
  };

  const handleBackupDownload = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/backup`, { headers: authHeader });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imanapharma_backup_${Date.now()}.json`;
      a.click();
      showMsg('success', 'Database backup file generated successfully.');
    } catch (err: any) {
      showMsg('error', err.message);
    }
  };

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('CAUTION: Restoring database will overwrite all existing users, inventory, sales, patients, and logs. Do you want to continue?')) {
      e.target.value = '';
      return;
    }
    
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch(`${API_URL}/admin/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Restore failed');
      showMsg('success', 'Database restored successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showMsg('error', 'Failed to restore database: ' + err.message);
    }
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const flags = patientForm.allergy_flags ? patientForm.allergy_flags.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
    const res = await fetch(`${API_URL}/patients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ name: patientForm.name, allergy_flags: flags })
    });
    if (res.ok) { showMsg('success', `Patient "${patientForm.name}" registered.`); setShowPatientModal(false); setPatientForm({ name: '', allergy_flags: '' }); fetchPatients(); }
    else showMsg('error', 'Failed to register patient');
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/suppliers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(supplierForm)
    });
    if (res.ok) { showMsg('success', `Supplier "${supplierForm.name}" created.`); setShowSupplierModal(false); setSupplierForm({ name: '', contact_name: '', phone: '', email: '', address: '' }); fetchSuppliers(); }
    else showMsg('error', 'Failed to create supplier');
  };

  const handleReceivePO = async (poId: string) => {
    if (!confirm('Mark this PO as RECEIVED? This will update inventory.')) return;
    const res = await fetch(`${API_URL}/purchase-orders/${poId}/receive`, { method: 'POST', headers: authHeader });
    if (res.ok) { showMsg('success', 'PO received. Inventory updated.'); fetchPurchaseOrders(); fetchMedicines(); }
    else showMsg('error', 'Failed to receive PO');
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!userQuery.trim()) return users;
    const q = userQuery.toLowerCase();
    return users.filter(u => u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  }, [users, userQuery]);

  const filteredPatients = useMemo(() => {
    if (!patientQuery.trim()) return patients;
    const q = patientQuery.toLowerCase();
    return patients.filter(p => p.name.toLowerCase().includes(q));
  }, [patients, patientQuery]);

  const displayedMeds = useMemo(() => {
    if (invTab === 'low') return charts.lowStockDetails;
    if (invTab === 'near_expiry') return charts.nearExpiryDetails;
    if (invTab === 'expired') return charts.expiredDetails;
    return medicines;
  }, [invTab, medicines, charts]);

  const revenueTotal = useMemo(() =>
    sales.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + Number(s.total_amount), 0), [sales]);

  const sparkData = charts.monthlySales.map((m: any) => Number(m.revenue));
  const maxBar = Math.max(...(charts.topSelling.map((t: any) => Number(t.total_qty))), 1);

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
    { id: 'users', label: 'User Management', icon: <Users size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'suppliers', label: 'Suppliers & POs', icon: <Truck size={16} /> },
    { id: 'patients', label: 'Patients', icon: <HeartPulse size={16} /> },
    { id: 'sales', label: 'Sales History', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports & Export', icon: <FileText size={16} /> },
    { id: 'audit', label: 'Audit Logs', icon: <ShieldAlert size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Edit2 size={16} /> },
  ];

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden font-sans">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-white">
            {pharmacyInfo?.logo_url
              ? <img src={`http://localhost:5000${pharmacyInfo.logo_url}`} alt="Logo" className="w-full h-full object-contain" />
              : <Activity size={14} className="text-blue-600" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-gray-900 truncate">{pharmacyInfo?.name || 'ImanaPharma'}</h2>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Manager Portal</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={activeTab === item.id ? 'nav-item-active' : 'nav-item'}
            >
              {item.icon} <span>{item.label}</span>
              {item.id === 'inventory' && overview.lowStockItems > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                  {overview.lowStockItems}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="text-[10px] text-gray-400 font-medium mb-1 px-1">{session.username}</div>
          <button onClick={onLogout} className="btn bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 w-full h-8 text-xs">
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between h-[49px] shrink-0">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {navItems.find(n => n.id === activeTab)?.label}
          </span>
          <button onClick={() => { fetchOverview(); fetchCharts(); }} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600">
            <RefreshCw size={12} /> Refresh
          </button>
        </header>

        {/* Toast */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertOctagon size={15} />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">

          {/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-6">
              {/* KPI Row 1 */}
              <div className="grid grid-cols-4 gap-4">
                <KpiCard icon={<Package size={18} />} label="Total SKUs" value={overview.totalProducts} color="border-blue-500" />
                <KpiCard icon={<DollarSign size={18} />} label="Total Revenue" value={`ETB ${overview.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${overview.totalSales} orders`} color="border-green-500" spark={sparkData} />
                <KpiCard icon={<AlertTriangle size={18} />} label="Low Stock" value={overview.lowStockItems} sub="Below reorder level" color="border-amber-500" />
                <KpiCard icon={<Clock size={18} />} label="Near Expiry" value={overview.nearExpiryItems} sub="Within 30 days" color="border-orange-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <KpiCard icon={<AlertOctagon size={18} />} label="Expired Items" value={overview.expiredItems} sub="Action required" color="border-red-500" />
                <KpiCard icon={<Users size={18} />} label="Pharmacists" value={overview.totalPharmacists} sub="Active accounts" color="border-indigo-500" />
                <KpiCard icon={<TrendingUp size={18} />} label="Monthly Sales" value={charts.monthlySales.length > 0 ? `ETB ${Number(charts.monthlySales[charts.monthlySales.length - 1]?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'N/A'} sub="Current month" color="border-teal-500" />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-3 gap-4">
                {/* Monthly Revenue Bar */}
                <div className="card p-5 col-span-2">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">Monthly Revenue (ETB)</h3>
                  {charts.monthlySales.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
                  ) : (
                    <div className="flex items-end gap-2 h-36">
                      {charts.monthlySales.map((m: any, i: number) => {
                        const max = Math.max(...charts.monthlySales.map((x: any) => Number(x.revenue)), 1);
                        const pct = (Number(m.revenue) / max) * 100;
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1 group">
                            <div className="relative w-full flex justify-center">
                              <div
                                className="w-full bg-blue-500 rounded-t-md transition-all group-hover:bg-blue-600"
                                style={{ height: `${Math.max(pct * 1.3, 4)}px` }}
                              />
                              <div className="absolute -top-6 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                                ETB {Number(m.revenue).toFixed(0)}
                              </div>
                            </div>
                            <span className="text-[9px] text-gray-400 font-medium">{m.month?.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Payment Method Breakdown */}
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">Revenue by Payment</h3>
                  <div className="flex flex-col gap-3">
                    {charts.paymentSummary.map((p: any) => {
                      const total = charts.paymentSummary.reduce((s: number, x: any) => s + Number(x.revenue), 0);
                      const pct = total > 0 ? (Number(p.revenue) / total * 100) : 0;
                      return (
                        <div key={p.payment_method}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 font-medium">{p.payment_method}</span>
                            <span className="text-gray-900 font-bold">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{p.count} transactions · ETB {Number(p.revenue).toFixed(2)}</div>
                        </div>
                      );
                    })}
                    {charts.paymentSummary.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
                  </div>
                </div>
              </div>

              {/* Top Sellers + Alerts */}
              <div className="grid grid-cols-2 gap-4">
                {/* Top 10 sellers */}
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">Top Selling Products</h3>
                  <div className="flex flex-col gap-2">
                    {charts.topSelling.slice(0, 8).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 w-5 text-right font-bold">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-700 font-medium truncate max-w-[160px]">{t.drug_name}</span>
                            <span className="text-gray-900 font-bold ml-2">{t.total_qty} units</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${(Number(t.total_qty) / maxBar) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {charts.topSelling.length === 0 && <p className="text-sm text-gray-400">No sales data</p>}
                  </div>
                </div>

                {/* Critical alerts */}
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">⚠️ Alerts</h3>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                    {charts.expiredDetails.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between text-xs p-2.5 bg-red-50 rounded-lg border border-red-100">
                        <span className="font-semibold text-red-800">{m.drug_name} {m.strength}</span>
                        <span className="text-red-600 font-mono">{m.quantity} units — EXPIRED {new Date(m.expiry_date).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {charts.nearExpiryDetails.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between text-xs p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                        <span className="font-semibold text-orange-800">{m.drug_name} {m.strength}</span>
                        <span className="text-orange-600 font-mono">Expires {new Date(m.expiry_date).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {charts.lowStockDetails.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between text-xs p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="font-semibold text-amber-800">{m.drug_name} {m.strength}</span>
                        <span className="text-amber-700 font-mono">{m.quantity} left — Low Stock</span>
                      </div>
                    ))}
                    {charts.expiredDetails.length === 0 && charts.nearExpiryDetails.length === 0 && charts.lowStockDetails.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">✅ No critical alerts</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════ USERS ═══════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-6">
              <div className="card overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <h3 className="font-bold text-gray-900">User Accounts</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-9 h-9 text-sm w-52" placeholder="Search users…" value={userQuery} onChange={e => setUserQuery(e.target.value)} />
                    </div>
                    <button onClick={() => { setUserForm({ id: '', username: '', password: '', role: 'PHARMACIST', is_active: true }); setShowUserModal(true); }} className="btn-primary h-9 text-sm">
                      <Plus size={14} /> Add User
                    </button>
                  </div>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50">
                    <tr>{['Username', 'Role', 'Status', 'Security', 'Actions'].map(h => (
                      <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{user.username}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${user.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{user.role}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => handleToggleUserStatus(user.id, user.is_active)} className={`px-2 py-0.5 rounded text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            {user.must_change_password && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 rounded">Pending PW Change</span>}
                            {user.locked_until && new Date(user.locked_until) > new Date() && (
                              <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 rounded">🔒 Locked</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.locked_until && new Date(user.locked_until) > new Date() && (
                              <button onClick={() => handleUnlockUser(user.id, user.username)} className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1 rounded font-bold">Unlock</button>
                            )}
                            <button onClick={() => setUserResetId(user.id)} className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded font-bold">Reset PW</button>
                            <button onClick={() => handleDeleteUser(user.id, user.username)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No users found</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Password Reset inline form */}
              {userResetId && (
                <div className="card p-5">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Reset Password for: <span className="text-blue-600">{users.find(u => u.id === userResetId)?.username}</span></h4>
                  <form onSubmit={handleResetPasswordSubmit} className="flex gap-3">
                    <input type="password" className="input flex-1 h-9 text-sm" placeholder="New password (min 8 chars)" value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} required minLength={8} />
                    <button type="submit" className="btn-primary h-9 text-sm">Set Password</button>
                    <button type="button" onClick={() => { setUserResetId(''); setNewResetPassword(''); }} className="btn bg-white border border-gray-200 h-9 text-sm">Cancel</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════ INVENTORY ══════════════════════════════ */}
          {activeTab === 'inventory' && (
            <div className="flex flex-col gap-4">
              {/* Sub-tabs */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1 w-fit">
                {([
                  { key: 'all', label: `All (${medicines.length})` },
                  { key: 'low', label: `Low Stock (${charts.lowStockDetails.length})`, color: 'text-amber-600' },
                  { key: 'near_expiry', label: `Near Expiry (${charts.nearExpiryDetails.length})`, color: 'text-orange-600' },
                  { key: 'expired', label: `Expired (${charts.expiredDetails.length})`, color: 'text-red-600' },
                ] as any[]).map(t => (
                  <button key={t.key} onClick={() => setInvTab(t.key)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${invTab === t.key ? 'bg-blue-600 text-white shadow' : `text-gray-600 hover:bg-gray-50 ${t.color || ''}`}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="card overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <h3 className="font-bold text-gray-900">Medicine Inventory</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-9 h-9 text-sm w-52" placeholder="Search medicine…" value={medQuery} onChange={e => setMedQuery(e.target.value)} />
                    </div>
                    <button onClick={() => handleExportCSV('medicines')} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><Download size={12} /> CSV</button>
                    <button onClick={() => handleExportExcel('medicines')} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><Download size={12} /> Excel</button>
                    <button onClick={() => { setMedForm({ id: '', drug_name: '', category: 'OTC', strength: '', price: 0, quantity: 0, expiry_date: '', manufacturer: '', batch_number: '', barcode: '', min_reorder_level: 20 }); setShowMedModal(true); }} className="btn-primary h-9 text-sm"><Plus size={14} /> Add</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50">
                      <tr>{['Drug Name', 'Category', 'Strength', 'Batch', 'Qty', 'Min Reorder', 'Expiry', 'Price (ETB)', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {displayedMeds.map((m: any) => {
                        const isExpired = m.expiry_date && new Date(m.expiry_date) < new Date();
                        const isNearExpiry = !isExpired && m.expiry_date && new Date(m.expiry_date) < new Date(Date.now() + 30 * 86400000);
                        const isLow = m.quantity <= (m.min_reorder_level ?? 20);
                        return (
                          <tr key={m.id} className={`hover:bg-gray-50/60 ${isExpired ? 'bg-red-50' : isNearExpiry ? 'bg-orange-50' : isLow ? 'bg-amber-50' : ''}`}>
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{m.drug_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{m.category || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{m.strength || '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.batch_number || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${isLow ? 'text-amber-700' : 'text-gray-900'}`}>{m.quantity}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{m.min_reorder_level ?? 20}</td>
                            <td className="px-4 py-3">
                              {m.expiry_date ? (
                                <span className={`font-mono text-xs ${isExpired ? 'text-red-700 font-bold' : isNearExpiry ? 'text-orange-700 font-semibold' : 'text-gray-600'}`}>
                                  {isExpired ? '⛔ ' : isNearExpiry ? '⚠️ ' : ''}{new Date(m.expiry_date).toLocaleDateString()}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold">{Number(m.price).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setMedForm({ id: m.id, drug_name: m.drug_name, category: m.category || 'OTC', strength: m.strength || '', price: m.price, quantity: m.quantity, expiry_date: m.expiry_date ? m.expiry_date.slice(0, 10) : '', manufacturer: m.manufacturer || '', batch_number: m.batch_number || '', barcode: m.barcode || '', min_reorder_level: m.min_reorder_level ?? 20 }); setShowMedModal(true); }} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={13} /></button>
                                <button onClick={() => handleDeleteMedicine(m.id, m.drug_name)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {displayedMeds.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">No records</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════ SUPPLIERS & POs ════════════════════════ */}
          {activeTab === 'suppliers' && (
            <div className="flex flex-col gap-6">
              <div className="card overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900">Registered Suppliers</h3>
                  <button onClick={() => setShowSupplierModal(true)} className="btn-primary h-9 text-sm"><Plus size={14} /> Add Supplier</button>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50">
                    <tr>{['Supplier Name', 'Contact Person', 'Email / Phone', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {suppliers.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3.5 font-bold text-gray-900">{s.name}</td>
                        <td className="px-5 py-3.5">{s.contact_name || '—'}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span>{s.email || '—'}</span>
                            <span className="text-xs text-gray-400">{s.phone || '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No suppliers found</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="card overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Purchase Orders</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50">
                    <tr>{['PO Number', 'Supplier', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {purchaseOrders.map(po => (
                      <tr key={po.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3.5 font-mono font-bold text-blue-700">{po.po_number}</td>
                        <td className="px-5 py-3.5">{po.supplier_name}</td>
                        <td className="px-5 py-3.5 font-mono">{Number(po.total_amount).toFixed(2)} ETB</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${po.status === 'RECEIVED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{po.status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {po.status === 'PENDING' && (
                            <button onClick={() => handleReceivePO(po.id)} className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded font-bold">Mark Received</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {purchaseOrders.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No purchase orders</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════ PATIENTS ════════════════════════════════ */}
          {activeTab === 'patients' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
                <h3 className="font-bold text-gray-900">Patient Records</h3>
                <div className="flex gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9 h-9 text-sm w-52" placeholder="Search patients…" value={patientQuery} onChange={e => setPatientQuery(e.target.value)} />
                  </div>
                  <button onClick={() => handleExportCSV('patients')} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><Download size={12} /> CSV</button>
                  <button onClick={() => { setPatientForm({ name: '', allergy_flags: '' }); setShowPatientModal(true); }} className="btn-primary h-9 text-sm"><Plus size={14} /> Add Patient</button>
                </div>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50">
                  <tr>{['Patient Name', 'Phone', 'Allergies', 'Insurance', 'Emergency Contact'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredPatients.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{p.name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{p.phone || '—'}</td>
                      <td className="px-5 py-3.5">
                        {p.allergy_flags?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.allergy_flags.map((a: string) => (
                              <span key={a} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">{a}</span>
                            ))}
                          </div>
                        ) : <span className="text-gray-400">None</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.insurance_provider || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{p.emergency_contact_name || '—'}</td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No patients</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ══════════════════════ SALES HISTORY ═══════════════════════════ */}
          {activeTab === 'sales' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Sales History</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleExportCSV('orders')} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><Download size={12} /> CSV</button>
                    <button onClick={() => handleExportExcel('orders')} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><Download size={12} /> Excel</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9 h-9 text-sm w-44" placeholder="Patient name…" value={salesQuery} onChange={e => setSalesQuery(e.target.value)} />
                  </div>
                  <select className="input h-9 text-sm w-40" value={salesStatus} onChange={e => setSalesStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="RETURNED">Returned</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-gray-400" />
                    <input type="date" className="input h-9 text-sm" value={salesFrom} onChange={e => setSalesFrom(e.target.value)} />
                    <span className="text-gray-400 text-xs">to</span>
                    <input type="date" className="input h-9 text-sm" value={salesTo} onChange={e => setSalesTo(e.target.value)} />
                  </div>
                  <span className="text-xs text-gray-500 font-semibold ml-auto">
                    {sales.filter(s => s.status === 'COMPLETED').length} sales · ETB {revenueTotal.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50">
                    <tr>{['Order #', 'Patient', 'Pharmacist', 'Amount', 'Payment', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {sales.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-mono text-blue-700 font-bold">{s.order_number}</td>
                        <td className="px-4 py-3 font-medium">{s.patient_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{s.pharmacist_name || '—'}</td>
                        <td className="px-4 py-3 font-mono font-semibold">{Number(s.total_amount).toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-500">{s.payment_method}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : s.status === 'RETURNED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {sales.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No sales records</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════ REPORTS & EXPORT ════════════════════════ */}
          {activeTab === 'reports' && (
            <div className="flex flex-col gap-6">
              {/* Export Cards */}
              <div className="grid grid-cols-3 gap-4">
                {([
                  { title: 'Sales History', desc: 'All orders with patient, amount, and pharmacist details', type: 'orders', icon: <Receipt size={20} className="text-blue-500" /> },
                  { title: 'Medicine Inventory', desc: 'Full inventory with stock levels, expiry dates, and pricing', type: 'medicines', icon: <Package size={20} className="text-green-500" /> },
                  { title: 'Patient Records', desc: 'Registered patients with allergy flags and insurance info', type: 'patients', icon: <HeartPulse size={20} className="text-red-500" /> },
                  { title: 'Audit Trail', desc: 'System audit logs with user actions and IP addresses', type: 'audit', icon: <ShieldAlert size={20} className="text-purple-500" /> },
                ] as any[]).map(card => (
                  <div key={card.type} className="card p-5 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">{card.icon}</div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{card.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleExportCSV(card.type)} className="btn bg-white border border-gray-200 h-8 text-xs flex-1 gap-1.5 hover:bg-green-50 hover:text-green-700 hover:border-green-200">
                        <Download size={12} /> Export CSV
                      </button>
                      {(card.type === 'orders' || card.type === 'medicines') && (
                        <button onClick={() => handleExportExcel(card.type)} className="btn bg-white border border-gray-200 h-8 text-xs flex-1 gap-1.5 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">
                          <Download size={12} /> Export Excel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Slow Moving Products */}
              <div className="card overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Slow-Moving Products</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Products dispensed fewer than 5 units in the last 90 days</p>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>{['Drug Name', 'Strength', 'Current Stock', 'Dispensed (90d)'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {charts.slowMoving.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3 font-semibold text-gray-900">{m.drug_name}</td>
                        <td className="px-5 py-3 text-gray-500">{m.strength || '—'}</td>
                        <td className="px-5 py-3"><span className="font-bold text-amber-700">{m.quantity}</span></td>
                        <td className="px-5 py-3 font-bold text-gray-400">{m.dispensed_last_90d}</td>
                      </tr>
                    ))}
                    {charts.slowMoving.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No slow-moving products</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Inventory Valuation by Category */}
              <div className="card overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Inventory Valuation by Category</h3>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>{['Category', 'SKUs', 'Total Units', 'Total Value (ETB)'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {charts.inventoryValuation.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3"><span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{r.category || 'Uncategorised'}</span></td>
                        <td className="px-5 py-3 text-gray-600">{r.sku_count}</td>
                        <td className="px-5 py-3 text-gray-600">{r.total_units}</td>
                        <td className="px-5 py-3 font-mono font-bold text-gray-900">{Number(r.total_value).toFixed(2)}</td>
                      </tr>
                    ))}
                    {charts.inventoryValuation.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No inventory data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════ AUDIT LOGS ══════════════════════════════ */}
          {activeTab === 'audit' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">System Audit Trail</h3>
                  <div className="flex gap-2">
                    <button onClick={loadAuditLogs} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><RefreshCw size={12} /> Refresh</button>
                    <button onClick={() => handleExportCSV('audit')} className="btn bg-white border border-gray-200 h-9 text-xs gap-1.5"><Download size={12} /> Export CSV</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9 h-9 text-sm w-44" placeholder="Action or user…" value={auditQuery} onChange={e => setAuditQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadAuditLogs()} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-gray-400" />
                    <input type="date" className="input h-9 text-sm" value={auditFrom} onChange={e => setAuditFrom(e.target.value)} />
                    <span className="text-gray-400 text-xs">to</span>
                    <input type="date" className="input h-9 text-sm" value={auditTo} onChange={e => setAuditTo(e.target.value)} />
                    <button onClick={loadAuditLogs} className="btn-primary h-9 text-sm gap-1.5"><Filter size={13} /> Filter</button>
                  </div>
                </div>
              </div>
              {loadingAuditLogs ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading audit logs…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>{['Timestamp', 'Action', 'User', 'IP Address', 'Details'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50/60">
                          <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.action_type?.includes('LOGIN') ? 'bg-green-100 text-green-700' : log.action_type?.includes('FAIL') || log.action_type?.includes('LOCK') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                              {log.action_type}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-semibold">{log.username || '—'}</td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-400">{log.ip_address || '—'}</td>
                          <td className="px-5 py-3 text-xs font-mono text-gray-500 max-w-xs truncate">{JSON.stringify(log.payload)}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No audit logs</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════ SETTINGS ════════════════════════════════ */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="font-bold text-gray-900 mb-4">Pharmacy Information</h3>
                <form onSubmit={handleSettingsSubmit} className="flex flex-col gap-4">
                  {[{ label: 'Pharmacy Name', key: 'name', type: 'text' },
                    { label: 'Address', key: 'address', type: 'text' },
                    { label: 'Phone', key: 'phone', type: 'tel' },
                    { label: 'Email', key: 'email', type: 'email' }
                  ].map(f => (
                    <div key={f.key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase">{f.label}</label>
                      <input type={f.type} className="input h-10 text-sm" value={(settingsForm as any)[f.key]} onChange={e => setSettingsForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <button type="submit" className="btn-primary h-10 text-sm mt-2">Save Settings</button>
                </form>
              </div>

              <div className="card p-6">
                <h3 className="font-bold text-gray-900 mb-4">Pharmacy Logo</h3>
                {pharmacyInfo?.logo_url && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-xl flex items-center justify-center">
                    <img src={`http://localhost:5000${pharmacyInfo.logo_url}`} alt="Current Logo" className="max-h-24 object-contain" />
                  </div>
                )}
                <form onSubmit={handleLogoUpload} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Upload New Logo</label>
                    <input type="file" accept="image/*" className="input h-10 text-sm file:mr-3 file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-semibold file:px-3 file:py-1 file:rounded"
                      onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                  </div>
                  <button type="submit" disabled={!logoFile} className="btn-primary h-10 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    <Upload size={14} /> Upload Logo
                  </button>
                </form>
              </div>

              <div className="card p-6 col-span-2 flex flex-col gap-4">
                <h3 className="font-bold text-gray-900">Database Administration & Recovery</h3>
                <p className="text-xs text-gray-500">Download a full snapshot of the relational database system or restore the database from a previously downloaded JSON backup file.</p>
                <div className="flex gap-4">
                  <button onClick={handleBackupDownload} className="btn bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 h-10 px-4 text-xs font-bold flex items-center gap-2">
                    <Download size={14} /> Generate & Download Backup
                  </button>
                  <label className="btn bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 h-10 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer">
                    <Upload size={14} /> Restore from Backup
                    <input type="file" accept=".json" onChange={handleRestoreUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══════════════════════ MODALS ═══════════════════════════════════════ */}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">{userForm.id ? 'Edit User' : 'Create User'}</h3>
              <button onClick={() => setShowUserModal(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 flex flex-col gap-4">
              {!userForm.id && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Username</label>
                    <input className="input h-10 text-sm" required value={userForm.username} onChange={e => setUserForm(p => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Password</label>
                    <input type="password" className="input h-10 text-sm" required minLength={8} value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Role</label>
                <select className="input h-10 text-sm" value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="PHARMACIST">PHARMACIST</option>
                  <option value="MANAGER">MANAGER</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 h-10 text-sm">Save</button>
                <button type="button" onClick={() => setShowUserModal(false)} className="btn bg-white border border-gray-200 flex-1 h-10 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Medicine Modal */}
      {showMedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-900">{medForm.id ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button onClick={() => setShowMedModal(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleMedSubmit} className="p-6 grid grid-cols-2 gap-4">
              {[
                { label: 'Drug Name', key: 'drug_name', type: 'text', span: 2 },
                { label: 'Strength', key: 'strength', type: 'text' },
                { label: 'Manufacturer', key: 'manufacturer', type: 'text' },
                { label: 'Batch Number', key: 'batch_number', type: 'text' },
                { label: 'Barcode', key: 'barcode', type: 'text' },
                { label: 'Quantity', key: 'quantity', type: 'number' },
                { label: 'Min Reorder Level', key: 'min_reorder_level', type: 'number' },
                { label: 'Price (ETB)', key: 'price', type: 'number' },
                { label: 'Expiry Date', key: 'expiry_date', type: 'date' },
              ].map(f => (
                <div key={f.key} className={`flex flex-col gap-1 ${f.span === 2 ? 'col-span-2' : ''}`}>
                  <label className="text-xs font-semibold text-gray-500 uppercase">{f.label}</label>
                  <input type={f.type} className="input h-10 text-sm" value={(medForm as any)[f.key]} required={f.key === 'drug_name'} min={f.type === 'number' ? '0' : undefined} step={f.key === 'price' ? '0.01' : undefined}
                    onChange={e => setMedForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Category</label>
                <select className="input h-10 text-sm" value={medForm.category} onChange={e => setMedForm(p => ({ ...p, category: e.target.value }))}>
                  {['OTC', 'PRESCRIPTION', 'CONTROLLED', 'SUPPLEMENT', 'COSMETIC', 'VETERINARY'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 h-10 text-sm">Save Medicine</button>
                <button type="button" onClick={() => setShowMedModal(false)} className="btn bg-white border border-gray-200 flex-1 h-10 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Register Patient</h3>
              <button onClick={() => setShowPatientModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handlePatientSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Full Name</label>
                <input className="input h-10 text-sm" required value={patientForm.name} onChange={e => setPatientForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Allergy Flags (comma-separated)</label>
                <input className="input h-10 text-sm" placeholder="e.g. PENICILLIN, NSAIDS" value={patientForm.allergy_flags} onChange={e => setPatientForm(p => ({ ...p, allergy_flags: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 h-10 text-sm">Register</button>
                <button type="button" onClick={() => setShowPatientModal(false)} className="btn bg-white border border-gray-200 flex-1 h-10 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Add Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSupplierSubmit} className="p-6 flex flex-col gap-4">
              {[
                { label: 'Supplier Name', key: 'name', req: true },
                { label: 'Contact Person', key: 'contact_name' },
                { label: 'Phone', key: 'phone' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Address', key: 'address' },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">{f.label}</label>
                  <input type={f.type || 'text'} className="input h-10 text-sm" required={!!f.req}
                    value={(supplierForm as any)[f.key]} onChange={e => setSupplierForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 h-10 text-sm">Create Supplier</button>
                <button type="button" onClick={() => setShowSupplierModal(false)} className="btn bg-white border border-gray-200 flex-1 h-10 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

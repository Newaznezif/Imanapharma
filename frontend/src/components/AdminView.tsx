import React, { useState, useEffect } from 'react';
import { Package, Plus, BarChart3, AlertTriangle, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { UserSession } from '../App';

interface GlobalStock {
  branch_id: string; branch_name: string; product_id: string; product_sku: string;
  product_name: string; category: string; batch_number: string; expiry_date: string; quantity: number;
}
interface Product {
  id: string; sku: string; name: string; category: 'Rx' | 'OTC'; description?: string; created_at: string;
}
interface AdminViewProps { session: UserSession; cloudUrl: string; }

export default function AdminView({ session, cloudUrl }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'stock' | 'catalog' | 'adjust'>('stock');
  const [globalStock, setGlobalStock] = useState<GlobalStock[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(false);

  const [newSku,      setNewSku]      = useState('');
  const [newName,     setNewName]     = useState('');
  const [newCategory, setNewCategory] = useState<'Rx' | 'OTC'>('OTC');
  const [newDesc,     setNewDesc]     = useState('');

  const [selectedBranch,  setSelectedBranch]  = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [adjustBatch,  setAdjustBatch]  = useState('');
  const [adjustExpiry, setAdjustExpiry] = useState('');
  const [adjustQty,    setAdjustQty]    = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/stock`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setGlobalStock(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/products`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setProducts(await res.json());
    } catch (e) { console.error(e); }
  };
  const fetchBranches = async () => {
    try {
      const res = await fetch(`${cloudUrl}/api/v1/branches`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setBranches(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchStock(); fetchCatalog(); fetchBranches(); }, [cloudUrl, session.token]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(null);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ sku: newSku.toUpperCase(), name: newName, category: newCategory, description: newDesc }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed to create product'); }
      setMessage({ type: 'success', text: `Product "${newName}" registered in master catalog.` });
      setNewSku(''); setNewName(''); setNewDesc(''); fetchCatalog();
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage(null);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ productId: selectedProduct, branchId: selectedBranch, batchNumber: adjustBatch.toUpperCase(), expiryDate: adjustExpiry, quantityChange: adjustQty, reason: adjustReason }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Adjustment failed'); }
      setMessage({ type: 'success', text: 'Stock adjustment recorded in append-only ledger.' });
      setAdjustBatch(''); setAdjustExpiry(''); setAdjustQty(0); setAdjustReason(''); fetchStock();
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
  };

  const stockStatus = (qty: number) => {
    if (qty <= 0) return <span className="badge badge-red">Out of Stock</span>;
    if (qty < 20) return <span className="badge badge-amber">Low Stock</span>;
    return <span className="badge badge-green">In Stock</span>;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-600" /> Central Inventory Dashboard
          </h1>
          <p className="page-subtitle">Aggregated ledger balances, product catalog, and stock adjustments</p>
        </div>
        <button onClick={() => { fetchStock(); fetchCatalog(); }} className="btn-secondary btn-sm gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-5">

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 gap-1">
            {(['stock', 'catalog', 'adjust'] as const).map(tab => (
              <button
                key={tab}
                id={`tab-${tab}`}
                onClick={() => { setActiveTab(tab); setMessage(null); }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative -mb-px ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {tab === 'stock' ? 'Stock Balance' : tab === 'catalog' ? 'Product Catalog' : 'Ledger Adjustment'}
              </button>
            ))}
          </div>

          {/* Alert banner */}
          {message && (
            <div className={message.type === 'success' ? 'alert-success' : 'alert-error'}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span className="font-medium flex-1">{message.text}</span>
              <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
          )}

          {/* ── Stock Balance ────────────────────────────────────────────── */}
          {activeTab === 'stock' && (
            <div className="card overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                  <RefreshCw size={16} className="animate-spin" /> Loading ledger balances…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>SKU</th>
                        <th>Drug Name</th>
                        <th>Category</th>
                        <th>Batch</th>
                        <th>Expiry Date</th>
                        <th className="text-right">Qty</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalStock.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-gray-400">
                            <Package size={28} className="mx-auto mb-2 opacity-30" />
                            No stock levels aggregated. Check edge sync queues.
                          </td>
                        </tr>
                      ) : (
                        globalStock.map((row, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold text-blue-700">{row.branch_name}</td>
                            <td className="font-mono font-semibold text-gray-900">{row.product_sku}</td>
                            <td className="text-gray-800">{row.product_name}</td>
                            <td>
                              <span className={`badge ${row.category === 'Rx' ? 'badge-orange' : 'badge-teal'}`}>
                                {row.category}
                              </span>
                            </td>
                            <td className="font-mono text-gray-500 text-xs">{row.batch_number}</td>
                            <td className="text-gray-500 text-xs">{new Date(row.expiry_date).toLocaleDateString()}</td>
                            <td className="text-right font-mono font-bold text-gray-900">{row.quantity}</td>
                            <td className="text-center">{stockStatus(row.quantity)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Product Catalog ──────────────────────────────────────────── */}
          {activeTab === 'catalog' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Create form */}
              <div className="lg:col-span-4">
                <div className="card p-5 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Plus size={15} className="text-blue-600" /> Register New Product
                  </h3>
                  <form id="create-product-form" onSubmit={handleCreateProduct} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">SKU Code</label>
                      <input type="text" value={newSku} onChange={e => setNewSku(e.target.value)} placeholder="e.g. ATORV" className="input-field" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Product Name</label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Atorvastatin 10mg" className="input-field" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Category</label>
                      <select value={newCategory} onChange={e => setNewCategory(e.target.value as 'Rx' | 'OTC')} className="select-field">
                        <option value="OTC">OTC — Over The Counter</option>
                        <option value="Rx">Rx — Prescription Required</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Description</label>
                      <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Clinical notes, interactions…" className="input-field h-20 resize-none py-2" />
                    </div>
                    <button type="submit" className="btn-primary">
                      <Package size={14} /> Register Product
                    </button>
                  </form>
                </div>
              </div>

              {/* Product table */}
              <div className="lg:col-span-8">
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Drug Name</th>
                          <th>Category</th>
                          <th>Description</th>
                          <th>Registered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-gray-400">No products in master catalog.</td>
                          </tr>
                        ) : (
                          products.map(prod => (
                            <tr key={prod.id}>
                              <td className="font-mono font-semibold text-gray-900">{prod.sku}</td>
                              <td className="font-medium text-gray-800">{prod.name}</td>
                              <td>
                                <span className={`badge ${prod.category === 'Rx' ? 'badge-orange' : 'badge-teal'}`}>
                                  {prod.category}
                                </span>
                              </td>
                              <td className="max-w-xs truncate text-gray-500 text-xs">{prod.description || '—'}</td>
                              <td className="text-gray-400 text-xs">{new Date(prod.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Ledger Adjustment ────────────────────────────────────────── */}
          {activeTab === 'adjust' && (
            <div className="max-w-2xl">
              <div className="card p-6 flex flex-col gap-5">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle size={17} className="text-amber-500" /> Central Ledger Adjustment
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Post an immutable stock movement event. Quantities are appended to the ledger stream, preserving full audit history.
                  </p>
                </div>

                <form id="adjust-stock-form" onSubmit={handleAdjustStock} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Branch</label>
                      <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="select-field" required>
                        <option value="">Select branch…</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Product</label>
                      <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="select-field" required>
                        <option value="">Select product…</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Batch Number</label>
                      <input type="text" value={adjustBatch} onChange={e => setAdjustBatch(e.target.value)} placeholder="e.g. B-SIMV-03" className="input-field" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Expiry Date</label>
                      <input type="date" value={adjustExpiry} onChange={e => setAdjustExpiry(e.target.value)} className="input-field" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Quantity Change</label>
                      <input type="number" value={adjustQty || ''} onChange={e => setAdjustQty(parseInt(e.target.value, 10) || 0)} placeholder="e.g. 100 or -50" className="input-field font-mono" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">Reason / Note</label>
                      <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. New shipment received" className="input-field" required />
                    </div>
                  </div>

                  <div className="pt-1">
                    <button type="submit" className="btn h-10 bg-amber-500 hover:bg-amber-600 text-white px-6 gap-2">
                      <AlertTriangle size={14} /> Commit Adjustment to Ledger
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

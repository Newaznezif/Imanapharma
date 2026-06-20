import React, { useState, useEffect } from 'react';
import { Package, Plus, BarChart3, AlertTriangle } from 'lucide-react';
import { UserSession } from '../App';

interface GlobalStock {
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  category: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category: 'Rx' | 'OTC';
  description?: string;
  created_at: string;
}

interface AdminViewProps {
  session: UserSession;
  cloudUrl: string;
}

export default function AdminView({ session, cloudUrl }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'stock' | 'catalog' | 'adjust'>('stock');
  const [globalStock, setGlobalStock] = useState<GlobalStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // New product inputs
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'Rx' | 'OTC'>('OTC');
  const [newDesc, setNewDesc] = useState('');
  
  // Adjust inputs
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [adjustBatch, setAdjustBatch] = useState('');
  const [adjustExpiry, setAdjustExpiry] = useState('');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data fetching
  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/stock`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalStock(data);
      }
    } catch (e) {
      console.error('Error fetching global stock balances:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/products`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching product catalog:', e);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${cloudUrl}/api/v1/branches`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (e) {
      console.error('Error fetching branches list:', e);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchCatalog();
    fetchBranches();
  }, [cloudUrl, session.token]);

  // Handlers
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          sku: newSku.toUpperCase(),
          name: newName,
          category: newCategory,
          description: newDesc
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create product');
      }

      setMessage({ type: 'success', text: `Product ${newName} registered successfully.` });
      setNewSku('');
      setNewName('');
      setNewDesc('');
      fetchCatalog();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch(`${cloudUrl}/api/v1/inventory/adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          productId: selectedProduct,
          branchId: selectedBranch,
          batchNumber: adjustBatch.toUpperCase(),
          expiryDate: adjustExpiry,
          quantityChange: adjustQty,
          reason: adjustReason
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Adjustment failed');
      }

      setMessage({ type: 'success', text: 'Central stock adjustment recorded in append-only ledger.' });
      setAdjustBatch('');
      setAdjustExpiry('');
      setAdjustQty(0);
      setAdjustReason('');
      fetchStock();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
          <BarChart3 className="text-emerald-400" /> Central Inventory Dashboard
        </h1>
        <p className="text-slate-400 text-sm">Aggregated ledger stock balances, product catalog registrations, and adjustments.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-900 gap-6">
        <button 
          onClick={() => { setActiveTab('stock'); setMessage(null); }}
          className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'stock' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Active Stock Balance
          {activeTab === 'stock' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"></span>}
        </button>
        <button 
          onClick={() => { setActiveTab('catalog'); setMessage(null); }}
          className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'catalog' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Master Product Catalog
          {activeTab === 'catalog' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"></span>}
        </button>
        <button 
          onClick={() => { setActiveTab('adjust'); setMessage(null); }}
          className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'adjust' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Central Ledger Adjustment
          {activeTab === 'adjust' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"></span>}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          <Package size={18} />
          <div className="text-xs font-semibold">{message.text}</div>
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'stock' && (
        <div className="flex flex-col gap-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading ledger balances from PostgreSQL...</div>
          ) : (
            <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Branch</th>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4 text-center">Category</th>
                    <th className="p-4">Batch Code</th>
                    <th className="p-4">Expiration</th>
                    <th className="p-4 text-right">Computed Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {globalStock.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">No stock levels aggregated. Check edge sync queues.</td>
                    </tr>
                  ) : (
                    globalStock.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/20">
                        <td className="p-4 font-bold text-indigo-300">{row.branch_name}</td>
                        <td className="p-4 font-mono font-bold text-slate-100">{row.product_sku}</td>
                        <td className="p-4">{row.product_name}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.category === 'Rx' ? 'bg-rose-500/10 text-rose-400' : 'bg-teal-500/10 text-teal-400'}`}>
                            {row.category}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">{row.batch_number}</td>
                        <td className="p-4 text-slate-400">{new Date(row.expiry_date).toLocaleDateString()}</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-400">{row.quantity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create product form (4 cols) */}
          <div className="lg:col-span-4 glass-card p-6 rounded-2xl flex flex-col gap-5 border border-slate-900 h-fit">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Plus size={16} className="text-emerald-400" /> Add Master Product
            </h3>
            
            <form onSubmit={handleCreateProduct} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SKU Code</label>
                <input 
                  type="text" 
                  value={newSku} 
                  onChange={e => setNewSku(e.target.value)} 
                  placeholder="e.g. ATORV" 
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900" 
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="e.g. Atorvastatin 10mg Tablets" 
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900" 
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category Classification</label>
                <select 
                  value={newCategory} 
                  onChange={e => setNewCategory(e.target.value as 'Rx' | 'OTC')}
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 cursor-pointer"
                >
                  <option value="OTC">OTC (Over The Counter)</option>
                  <option value="Rx">Rx (Prescription Mandatory)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)} 
                  placeholder="Clinical guidelines, interactions, etc." 
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 h-24 resize-none"
                />
              </div>

              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold p-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-emerald-500/20"
              >
                Register Product
              </button>
            </form>
          </div>

          {/* Product Catalog List (8 cols) */}
          <div className="lg:col-span-8 glass-panel rounded-2xl border border-slate-900 overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">SKU</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4 text-center">Category</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No products registered in master catalog.</td>
                  </tr>
                ) : (
                  products.map(prod => (
                    <tr key={prod.id} className="hover:bg-slate-900/20">
                      <td className="p-4 font-mono font-bold text-slate-100">{prod.sku}</td>
                      <td className="p-4 font-semibold">{prod.name}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${prod.category === 'Rx' ? 'bg-rose-500/10 text-rose-400' : 'bg-teal-500/10 text-teal-400'}`}>
                          {prod.category}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs truncate text-slate-400">{prod.description || '-'}</td>
                      <td className="p-4 text-slate-500">{new Date(prod.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'adjust' && (
        <div className="max-w-xl mx-auto w-full glass-panel p-8 rounded-2xl border border-slate-900 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <AlertTriangle size={18} /> Central Stock Ledger Adjustment Form
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manually post an immutable ledger movement event to a branch inventory. Quantity shifts are appended to the historic stream, preserving full transaction audits.
            </p>
          </div>

          <form onSubmit={handleAdjustStock} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Branch Location</label>
                <select 
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 cursor-pointer"
                  required
                >
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Product</label>
                <select 
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 cursor-pointer"
                  required
                >
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Batch Number</label>
                <input 
                  type="text" 
                  value={adjustBatch} 
                  onChange={e => setAdjustBatch(e.target.value)}
                  placeholder="e.g. B-SIMV-03" 
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900" 
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expiration Date</label>
                <input 
                  type="date" 
                  value={adjustExpiry} 
                  onChange={e => setAdjustExpiry(e.target.value)}
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 cursor-pointer" 
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantity Change (Units)</label>
                <input 
                  type="number" 
                  value={adjustQty || ''} 
                  onChange={e => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 100 or -50" 
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 font-mono" 
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason / Incident Note</label>
                <input 
                  type="text" 
                  value={adjustReason} 
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="e.g. Receipt of shipment, breakage" 
                  className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900" 
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold p-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 mt-2 border border-amber-500/20"
            >
              Commit Ledger Adjustment Event
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

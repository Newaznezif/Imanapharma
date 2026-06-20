import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, ArrowRightLeft, Check, Truck, CheckCircle2, X } from 'lucide-react';
import { UserSession } from '../App';

interface TransferItem {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  requested_qty: number;
  shipped_qty: number;
  received_qty: number;
}

interface Transfer {
  id: string;
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  status: 'REQUESTED' | 'APPROVED' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
  requested_by_username: string;
  approved_by_username?: string;
  created_at: string;
  items: TransferItem[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface TransferViewProps {
  session: UserSession;
  cloudUrl: string;
}

export default function TransferView({ session, cloudUrl }: TransferViewProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  
  // New request fields
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [requestQty, setRequestQty] = useState(0);
  const [addedItems, setAddedItems] = useState<{ productId: string; sku: string; qty: number }[]>([]);

  // Dispatch/Receive fields
  const [activeTransferAction, setActiveTransferAction] = useState<Transfer | null>(null);
  const [actionType, setActionType] = useState<'dispatch' | 'complete' | null>(null);
  const [itemDetails, setItemDetails] = useState<{ productId: string; sku: string; batchNumber: string; expiryDate: string; qty: number }[]>([]);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchesAndCatalog = async () => {
    try {
      const bRes = await fetch(`${cloudUrl}/api/v1/branches`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const pRes = await fetch(`${cloudUrl}/api/v1/inventory/products`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });

      if (bRes.ok && pRes.ok) {
        setBranches(await bRes.json());
        setProducts(await pRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchBranchesAndCatalog();
  }, [cloudUrl, session.token]);

  const handleAddItemToRequest = () => {
    if (!selectedProduct || requestQty <= 0) return;
    const prod = products.find(p => p.id === selectedProduct)!;
    setAddedItems(prev => [...prev, { productId: prod.id, sku: prod.sku, qty: requestQty }]);
    setSelectedProduct('');
    setRequestQty(0);
  };

  const handleCreateRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addedItems.length === 0 || !fromBranch || !toBranch) return;

    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          fromBranchId: fromBranch,
          toBranchId: toBranch,
          items: addedItems.map(i => ({ productId: i.productId, requestedQty: i.qty }))
        })
      });

      if (!res.ok) throw new Error('Failed to create transfer request');

      setMessage({ type: 'success', text: 'Inter-branch stock transfer request logged successfully.' });
      setShowRequestModal(false);
      setAddedItems([]);
      setFromBranch('');
      setToBranch('');
      fetchTransfers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleApprove = async (transferId: string) => {
    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers/${transferId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'X-Idempotency-Key': crypto.randomUUID()
        }
      });
      if (!res.ok) throw new Error('Approval failed');
      setMessage({ type: 'success', text: 'Transfer request approved. Pending dispatch.' });
      fetchTransfers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const openActionForm = (transfer: Transfer, type: 'dispatch' | 'complete') => {
    setActiveTransferAction(transfer);
    setActionType(type);
    setItemDetails(
      transfer.items.map(i => ({
        productId: i.product_id,
        sku: i.product_sku,
        batchNumber: type === 'complete' ? 'B-' + i.product_sku + '-02' : 'B-' + i.product_sku + '-02', // Default defaults
        expiryDate: '2028-12-31',
        qty: type === 'complete' ? i.shipped_qty : i.requested_qty
      }))
    );
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransferAction || !actionType) return;

    const endpoint = `${cloudUrl}/api/v1/transfers/${activeTransferAction.id}/${actionType}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          items: itemDetails.map(i => ({
            productId: i.productId,
            batchNumber: i.batchNumber.toUpperCase(),
            expiryDate: i.expiryDate,
            [actionType === 'dispatch' ? 'shippedQty' : 'receivedQty']: i.qty
          }))
        })
      });

      if (!res.ok) throw new Error('Transaction submission failed');

      setMessage({ 
        type: 'success', 
        text: actionType === 'dispatch' ? 'Stock dispatched: items deducted from source branch ledger.' : 'Stock received: items added to destination branch ledger.' 
      });

      setActiveTransferAction(null);
      setActionType(null);
      fetchTransfers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
            <RefreshCw className="text-indigo-400" /> Inter-Branch Stock Transfers
          </h1>
          <p className="text-slate-400 text-sm">Move inventory safely between branch pharmacies and coordinate lifecycle shipping states.</p>
        </div>
        <button 
          onClick={() => setShowRequestModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold p-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-indigo-500/20 shadow-lg shadow-indigo-600/10"
        >
          <Plus size={16} /> Request Transfer
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          <CheckCircle2 size={18} />
          <div className="text-xs font-semibold">{message.text}</div>
        </div>
      )}

      {/* Transfers lists */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading transfers records...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {transfers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-900/10 rounded-2xl border border-slate-900">
              No transfers requests exist. Request items to seed the pipeline.
            </div>
          ) : (
            transfers.map(tr => (
              <div key={tr.id} className="glass-card p-5 rounded-2xl border border-slate-900 flex flex-col gap-4">
                {/* Header detail */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-900/60">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-200 bg-slate-950 px-3 py-1 rounded-full border border-slate-900">{tr.from_branch_name}</span>
                    <ArrowRightLeft size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-200 bg-slate-950 px-3 py-1 rounded-full border border-slate-900">{tr.to_branch_name}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                      tr.status === 'REQUESTED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                      tr.status === 'APPROVED' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                      tr.status === 'DISPATCHED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {tr.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">ID: {tr.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Items table details */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested Items</h4>
                  <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-slate-400 border-b border-slate-900 pb-1.5">
                    <span>Product Name</span>
                    <span className="text-center">Requested Qty</span>
                    <span className="text-right">Processed State</span>
                  </div>
                  {tr.items.map(item => (
                    <div key={item.id} className="grid grid-cols-3 gap-4 text-xs text-slate-300">
                      <span>{item.product_name}</span>
                      <span className="text-center font-mono font-bold text-white">{item.requested_qty}</span>
                      <span className="text-right font-mono text-[10px] text-slate-400">
                        Shipped: {item.shipped_qty} / Received: {item.received_qty}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Foot actions */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-900/60 text-xs">
                  <div className="text-[10px] text-slate-500">
                    <span>Requested by: {tr.requested_by_username}</span>
                    {tr.approved_by_username && <span className="ml-3">Approved by: {tr.approved_by_username}</span>}
                  </div>

                  <div className="flex gap-2">
                    {tr.status === 'REQUESTED' && (
                      <button 
                        onClick={() => handleApprove(tr.id)}
                        className="bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white p-2 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5"
                      >
                        <Check size={12} /> Approve Transfer
                      </button>
                    )}
                    
                    {tr.status === 'APPROVED' && (
                      <button 
                        onClick={() => openActionForm(tr, 'dispatch')}
                        className="bg-amber-600/10 hover:bg-amber-600 border border-amber-500/20 text-amber-300 hover:text-white p-2 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5"
                      >
                        <Truck size={12} /> Dispatch Shipment
                      </button>
                    )}

                    {tr.status === 'DISPATCHED' && (
                      <button 
                        onClick={() => openActionForm(tr, 'complete')}
                        className="bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-300 hover:text-white p-2 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={12} /> Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <RefreshCw size={16} /> Create Stock Transfer Request
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-500 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRequestSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source Branch (Deduction)</label>
                  <select 
                    value={fromBranch} 
                    onChange={e => setFromBranch(e.target.value)}
                    className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 cursor-pointer"
                    required
                  >
                    <option value="">Select Shipping Location</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Destination Branch (Arrival)</label>
                  <select 
                    value={toBranch} 
                    onChange={e => setToBranch(e.target.value)}
                    className="glass-input p-3 rounded-xl text-xs bg-slate-950 border border-slate-900 cursor-pointer"
                    required
                  >
                    <option value="">Select Receiving Location</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Add item field */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add Request Item</h4>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[9px] text-slate-500 uppercase">Product</label>
                    <select 
                      value={selectedProduct} 
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="glass-input p-2 rounded-lg text-xs bg-slate-950 border border-slate-900"
                    >
                      <option value="">Select Product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 uppercase">Qty</label>
                    <input 
                      type="number" 
                      value={requestQty || ''} 
                      onChange={e => setRequestQty(parseInt(e.target.value, 10) || 0)}
                      placeholder="Units" 
                      className="glass-input p-2 rounded-lg text-xs bg-slate-950 border border-slate-900 text-center font-mono"
                    />
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={handleAddItemToRequest}
                  className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold p-2 rounded-lg transition-colors hover:bg-indigo-600/35"
                >
                  Append Item to List
                </button>
              </div>

              {/* Items listing inside modal */}
              {addedItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">Pending Requests list</h4>
                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                    {addedItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                        <span>{item.sku}</span>
                        <span className="font-mono font-bold text-white">{item.qty} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={addedItems.length === 0}
                className={`w-full text-white font-bold p-3 rounded-xl text-xs transition-colors border ${addedItems.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/20' : 'bg-slate-900 border-slate-950 text-slate-500'}`}
              >
                Log Central Transfer Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Action Dispatch/Complete Modal */}
      {activeTransferAction && actionType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                {actionType === 'dispatch' ? <Truck size={18} className="text-amber-400" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
                {actionType === 'dispatch' ? 'Dispatch Shipping Details' : 'Verify Received Quantities'}
              </h3>
              <button onClick={() => { setActiveTransferAction(null); setActionType(null); }} className="text-slate-500 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {itemDetails.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/60 p-4 rounded-xl border border-slate-900 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-300">{item.sku}</span>
                      <span className="text-[10px] text-slate-500">Requested: {activeTransferAction.items[idx]?.requested_qty}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-[9px] text-slate-500 uppercase">Batch Number</label>
                        <input 
                          type="text" 
                          value={item.batchNumber} 
                          onChange={e => {
                            const val = e.target.value;
                            setItemDetails(prev => prev.map((itm, i) => i === idx ? { ...itm, batchNumber: val } : itm));
                          }}
                          placeholder="e.g. B-WARF-02"
                          className="glass-input p-2 rounded-lg text-xs bg-slate-950 border border-slate-900"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-500 uppercase">{actionType === 'dispatch' ? 'Shipped Qty' : 'Received Qty'}</label>
                        <input 
                          type="number" 
                          value={item.qty || ''} 
                          onChange={e => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setItemDetails(prev => prev.map((itm, i) => i === idx ? { ...itm, qty: val } : itm));
                          }}
                          className="glass-input p-2 rounded-lg text-xs bg-slate-950 border border-slate-900 text-center font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 uppercase">Expiry Date</label>
                      <input 
                        type="date" 
                        value={item.expiryDate} 
                        onChange={e => {
                          const val = e.target.value;
                          setItemDetails(prev => prev.map((itm, i) => i === idx ? { ...itm, expiryDate: val } : itm));
                        }}
                        className="glass-input p-2 rounded-lg text-xs bg-slate-950 border border-slate-900 cursor-pointer"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button 
                type="submit" 
                className={`w-full text-white font-bold p-3.5 rounded-xl text-xs border ${actionType === 'dispatch' ? 'bg-amber-600 hover:bg-amber-500 border-amber-500/20' : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/20'}`}
              >
                {actionType === 'dispatch' ? 'Finalize Dispatch & Deduct Stock' : 'Finalize Delivery & Restock Target'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

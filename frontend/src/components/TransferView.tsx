import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, ArrowRightLeft, Check, Truck, CheckCircle2, X } from 'lucide-react';
import { UserSession } from '../App';

interface TransferItem {
  id: string; product_id: string; product_sku: string; product_name: string;
  requested_qty: number; shipped_qty: number; received_qty: number;
}
interface Transfer {
  id: string; from_branch_id: string; from_branch_name: string;
  to_branch_id: string; to_branch_name: string;
  status: 'REQUESTED' | 'APPROVED' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
  requested_by_username: string; approved_by_username?: string;
  created_at: string; items: TransferItem[];
}
interface Product { id: string; sku: string; name: string; }
interface TransferViewProps { session: UserSession; cloudUrl: string; }

const STATUS_BADGE: Record<string, string> = {
  REQUESTED:  'transfer-requested',
  APPROVED:   'transfer-approved',
  DISPATCHED: 'transfer-dispatched',
  COMPLETED:  'transfer-completed',
  CANCELLED:  'transfer-cancelled',
};

export default function TransferView({ session, cloudUrl }: TransferViewProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches,  setBranches]  = useState<{ id: string; name: string }[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const [fromBranch,       setFromBranch]       = useState('');
  const [toBranch,         setToBranch]         = useState('');
  const [selectedProduct,  setSelectedProduct]  = useState('');
  const [requestQty,       setRequestQty]       = useState(0);
  const [addedItems,       setAddedItems]       = useState<{ productId: string; sku: string; qty: number }[]>([]);

  const [activeTransferAction, setActiveTransferAction] = useState<Transfer | null>(null);
  const [actionType,           setActionType]           = useState<'dispatch' | 'complete' | null>(null);
  const [itemDetails,          setItemDetails]          = useState<{ productId: string; sku: string; batchNumber: string; expiryDate: string; qty: number }[]>([]);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (res.ok) setTransfers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchBranchesAndCatalog = async () => {
    try {
      const [bRes, pRes] = await Promise.all([
        fetch(`${cloudUrl}/api/v1/branches`,           { headers: { Authorization: `Bearer ${session.token}` } }),
        fetch(`${cloudUrl}/api/v1/inventory/products`, { headers: { Authorization: `Bearer ${session.token}` } }),
      ]);
      if (bRes.ok) setBranches(await bRes.json());
      if (pRes.ok) setProducts(await pRes.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchTransfers(); fetchBranchesAndCatalog(); }, [cloudUrl, session.token]);

  const handleAddItemToRequest = () => {
    if (!selectedProduct || requestQty <= 0) return;
    const prod = products.find(p => p.id === selectedProduct)!;
    setAddedItems(prev => [...prev, { productId: prod.id, sku: prod.sku, qty: requestQty }]);
    setSelectedProduct(''); setRequestQty(0);
  };

  const handleCreateRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addedItems.length === 0 || !fromBranch || !toBranch) return;
    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ fromBranchId: fromBranch, toBranchId: toBranch, items: addedItems.map(i => ({ productId: i.productId, requestedQty: i.qty })) }),
      });
      if (!res.ok) throw new Error('Failed to create transfer request');
      setMessage({ type: 'success', text: 'Transfer request submitted successfully.' });
      setShowRequestModal(false); setAddedItems([]); setFromBranch(''); setToBranch('');
      fetchTransfers();
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
  };

  const handleApprove = async (transferId: string) => {
    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers/${transferId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'X-Idempotency-Key': crypto.randomUUID() },
      });
      if (!res.ok) throw new Error('Approval failed');
      setMessage({ type: 'success', text: 'Transfer approved. Pending dispatch.' });
      fetchTransfers();
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
  };

  const openActionForm = (transfer: Transfer, type: 'dispatch' | 'complete') => {
    setActiveTransferAction(transfer); setActionType(type);
    setItemDetails(transfer.items.map(i => ({
      productId: i.product_id, sku: i.product_sku,
      batchNumber: 'B-' + i.product_sku + '-02',
      expiryDate: '2028-12-31',
      qty: type === 'complete' ? i.shipped_qty : i.requested_qty,
    })));
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransferAction || !actionType) return;
    try {
      const res = await fetch(`${cloudUrl}/api/v1/transfers/${activeTransferAction.id}/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          items: itemDetails.map(i => ({
            productId: i.productId, batchNumber: i.batchNumber.toUpperCase(), expiryDate: i.expiryDate,
            [actionType === 'dispatch' ? 'shippedQty' : 'receivedQty']: i.qty,
          })),
        }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setMessage({ type: 'success', text: actionType === 'dispatch' ? 'Stock dispatched. Source branch ledger updated.' : 'Stock received. Destination branch ledger updated.' });
      setActiveTransferAction(null); setActionType(null); fetchTransfers();
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <RefreshCw size={20} className="text-blue-600" /> Inter-Branch Stock Transfers
          </h1>
          <p className="page-subtitle">Move inventory between pharmacy branches with full lifecycle tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTransfers} className="btn-secondary btn-sm gap-2"><RefreshCw size={14} /> Refresh</button>
          <button id="btn-request-transfer" onClick={() => setShowRequestModal(true)} className="btn-primary btn-sm gap-2">
            <Plus size={14} /> Request Transfer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-4">

          {message && (
            <div className={message.type === 'success' ? 'alert-success' : 'alert-error'}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span className="flex-1 font-medium">{message.text}</span>
              <button onClick={() => setMessage(null)}><X size={14} /></button>
            </div>
          )}

          {/* Transfer list */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2 text-sm">
              <RefreshCw size={15} className="animate-spin" /> Loading transfers…
            </div>
          ) : transfers.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <ArrowRightLeft size={32} className="opacity-20" />
              <p className="text-sm">No transfer requests yet. Create the first one.</p>
              <button onClick={() => setShowRequestModal(true)} className="btn-primary btn-sm mt-2 gap-1.5">
                <Plus size={14} /> Request Transfer
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {transfers.map(tr => (
                <div key={tr.id} className="card p-5 flex flex-col gap-4">
                  {/* Transfer header */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">{tr.from_branch_name}</span>
                      <ArrowRightLeft size={13} className="text-gray-400" />
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">{tr.to_branch_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={STATUS_BADGE[tr.status] || 'badge badge-gray'}>{tr.status}</span>
                      <span className="text-[11px] text-gray-400 font-mono">#{tr.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  {/* Items table */}
                  <div className="overflow-hidden rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase tracking-wider">Requested</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider">Shipped / Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {tr.items.map(item => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-medium text-gray-800">{item.product_name}</td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-gray-900">{item.requested_qty}</td>
                            <td className="px-3 py-2 text-right text-gray-500 font-mono">{item.shipped_qty} / {item.received_qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="text-xs text-gray-400">
                      Requested by: <span className="font-medium text-gray-600">{tr.requested_by_username}</span>
                      {tr.approved_by_username && <span className="ml-3">Approved by: <span className="font-medium text-gray-600">{tr.approved_by_username}</span></span>}
                      <span className="ml-3">{new Date(tr.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      {tr.status === 'REQUESTED' && (
                        <button onClick={() => handleApprove(tr.id)} className="btn-sm btn bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 gap-1.5">
                          <Check size={12} /> Approve
                        </button>
                      )}
                      {tr.status === 'APPROVED' && (
                        <button onClick={() => openActionForm(tr, 'dispatch')} className="btn-sm btn bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 gap-1.5">
                          <Truck size={12} /> Dispatch
                        </button>
                      )}
                      {tr.status === 'DISPATCHED' && (
                        <button onClick={() => openActionForm(tr, 'complete')} className="btn-sm btn bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 gap-1.5">
                          <CheckCircle2 size={12} /> Mark Received
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Request Transfer Modal ───────────────────────────────────────────── */}
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-600" /> Create Transfer Request
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form id="create-transfer-form" onSubmit={handleCreateRequestSubmit}>
              <div className="modal-body">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">From Branch (Source)</label>
                    <select value={fromBranch} onChange={e => setFromBranch(e.target.value)} className="select-field" required>
                      <option value="">Select source…</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">To Branch (Destination)</label>
                    <select value={toBranch} onChange={e => setToBranch(e.target.value)} className="select-field" required>
                      <option value="">Select destination…</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="card-sm p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-gray-600">Add Items</h4>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[11px] text-gray-500">Product</label>
                      <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="select-field h-9 text-xs">
                        <option value="">Select product…</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-gray-500">Qty</label>
                      <input type="number" value={requestQty || ''} onChange={e => setRequestQty(parseInt(e.target.value, 10) || 0)} placeholder="0" className="input-field h-9 text-xs text-center font-mono" />
                    </div>
                  </div>
                  <button type="button" onClick={handleAddItemToRequest} className="btn-secondary btn-sm self-start gap-1.5">
                    <Plus size={13} /> Add to List
                  </button>

                  {addedItems.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {addedItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                          <span className="font-mono font-semibold text-gray-700">{item.sku}</span>
                          <span className="text-gray-500">{item.qty} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowRequestModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={addedItems.length === 0} className="btn-primary flex-1 disabled:opacity-50">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dispatch / Receive Modal ─────────────────────────────────────────── */}
      {activeTransferAction && actionType && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                {actionType === 'dispatch'
                  ? <><Truck size={16} className="text-amber-500" /> Dispatch Shipment</>
                  : <><CheckCircle2 size={16} className="text-green-600" /> Confirm Receipt</>
                }
              </h3>
              <button onClick={() => { setActiveTransferAction(null); setActionType(null); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form id="action-form" onSubmit={handleActionSubmit}>
              <div className="modal-body overflow-y-auto max-h-[60vh]">
                {itemDetails.map((item, idx) => (
                  <div key={idx} className="card-sm p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-blue-700 font-mono">{item.sku}</span>
                      <span className="text-xs text-gray-400">Requested: {activeTransferAction.items[idx]?.requested_qty}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[11px] text-gray-500">Batch Number</label>
                        <input type="text" value={item.batchNumber} onChange={e => { const v = e.target.value; setItemDetails(prev => prev.map((it, i) => i === idx ? { ...it, batchNumber: v } : it)); }} placeholder="e.g. B-WARF-02" className="input-field text-xs" required />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-500">{actionType === 'dispatch' ? 'Shipped Qty' : 'Received Qty'}</label>
                        <input type="number" value={item.qty || ''} onChange={e => { const v = parseInt(e.target.value, 10) || 0; setItemDetails(prev => prev.map((it, i) => i === idx ? { ...it, qty: v } : it)); }} className="input-field text-xs text-center font-mono" required />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-gray-500">Expiry Date</label>
                      <input type="date" value={item.expiryDate} onChange={e => { const v = e.target.value; setItemDetails(prev => prev.map((it, i) => i === idx ? { ...it, expiryDate: v } : it)); }} className="input-field text-xs" required />
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setActiveTransferAction(null); setActionType(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className={`btn flex-1 text-white ${actionType === 'dispatch' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}>
                  {actionType === 'dispatch' ? 'Confirm Dispatch' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

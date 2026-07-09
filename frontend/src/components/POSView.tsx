import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2,
  AlertTriangle, AlertOctagon, CheckCircle2,
  ShieldAlert, Printer, Search, X, Package,
} from 'lucide-react';
import { UserSession } from '../App';

// ─── Inline Clinical Safety Graph (avoids Vite cross-root resolution issues) ─
type InteractionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
class DrugInteractionGraph {
  private adj: Map<string, Map<string, { severity: InteractionSeverity; description: string }>> = new Map();
  addDrug(d: string) { if (!this.adj.has(d)) this.adj.set(d, new Map()); }
  addInteraction(a: string, b: string, severity: InteractionSeverity, description: string) {
    this.addDrug(a); this.addDrug(b);
    this.adj.get(a)!.set(b, { severity, description });
    this.adj.get(b)!.set(a, { severity, description });
  }
  checkSafety(cartDrugs: { sku: string; name: string }[], allergyFlags: string[] = []) {
    const warnings: string[] = [], blockers: string[] = [];
    for (let i = 0; i < cartDrugs.length; i++) {
      for (let j = i + 1; j < cartDrugs.length; j++) {
        const iMap = this.adj.get(cartDrugs[i].sku);
        if (iMap?.has(cartDrugs[j].sku)) {
          const e = iMap.get(cartDrugs[j].sku)!;
          const msg = `${cartDrugs[i].name} + ${cartDrugs[j].name}: ${e.description} (${e.severity})`;
          (e.severity === 'HIGH' || e.severity === 'CRITICAL' ? blockers : warnings).push(msg);
        }
      }
    }
    for (const d of cartDrugs) if (allergyFlags.includes(d.sku)) blockers.push(`Allergy: Patient is allergic to ${d.name}.`);
    return { passed: blockers.length === 0, warnings, blockers };
  }
}
const defaultSafetyGraph = new DrugInteractionGraph();
defaultSafetyGraph.addInteraction('WARF',     'ASPIRIN',  'CRITICAL', 'Concomitant use increases risk of severe GI bleeding.');
defaultSafetyGraph.addInteraction('ERYTHR',   'SIMVA',    'HIGH',     'Erythromycin raises Simvastatin plasma levels, risking rhabdomyolysis.');
defaultSafetyGraph.addInteraction('ATORV',    'SIMVA',    'MEDIUM',   'Both are statins; combined use may increase muscle-pain risk.');
defaultSafetyGraph.addInteraction('IBUPROFEN','ASPIRIN',  'LOW',      'Ibuprofen may reduce the antiplatelet effect of low-dose aspirin.');
// ─────────────────────────────────────────────────────────────────────────────

interface Product {
  id: string; sku: string; name: string; category: 'Rx' | 'OTC'; description?: string;
}
interface CartItem {
  product: Product; batchNumber: string; quantity: number;
}
interface POSViewProps {
  session: UserSession; edgeUrl: string;
}

export default function POSView({ session, edgeUrl }: POSViewProps) {
  const [products, setProducts]         = useState<Product[]>([]);
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [message, setMessage]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');

  // Clinical parameters
  const [selectedPatientAllergies, setSelectedPatientAllergies] = useState<string[]>([]);
  const [patientProfile, setPatientProfile] = useState<'none' | 'john' | 'jane'>('none');
  const [rxValidated, setRxValidated]   = useState(false);
  const [rxNumber, setRxNumber]         = useState('');
  const [doctorName, setDoctorName]     = useState('');
  const [patientName, setPatientName]   = useState('');

  // Pharmacist override
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideUser, setOverrideUser] = useState('');
  const [overridePass, setOverridePass] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [pharmacistSignature, setPharmacistSignature] = useState<{ username: string } | null>(null);

  // Financials
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'DIGITAL'>('CASH');
  const [paymentDisplay, setPaymentDisplay] = useState<'CASH' | 'CARD' | 'MOBILE'>('CASH');
  const [taxRate] = useState(0.08);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Receipt
  const [printedReceipt, setPrintedReceipt] = useState<any | null>(null);

  // Fetch product catalog
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${edgeUrl}/api/v1/inventory/products`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) setProducts(await res.json());
      } catch (err) { console.error('Failed to load product catalog:', err); }
    })();
  }, [edgeUrl, session.token]);

  // Patient profile effect
  useEffect(() => {
    if (patientProfile === 'john') {
      setSelectedPatientAllergies(['IBUPROFEN']);
      setPatientName('John Doe');
    } else if (patientProfile === 'jane') {
      setSelectedPatientAllergies([]);
      setPatientName('Jane Smith');
    } else {
      setSelectedPatientAllergies([]);
      setPatientName('');
    }
  }, [patientProfile]);

  // Financials
  const subtotal   = useMemo(() => cart.reduce((s, i) => s + i.quantity * 10.00, 0), [cart]);
  const taxAmount  = useMemo(() => subtotal * taxRate, [subtotal, taxRate]);
  const grandTotal = useMemo(() => Math.max(0, subtotal + taxAmount - discountAmount), [subtotal, taxAmount, discountAmount]);

  // Clinical safety
  const safetyChecks = useMemo(() => {
    const result = defaultSafetyGraph.checkSafety(
      cart.map(i => ({ sku: i.product.sku, name: i.product.name })),
      selectedPatientAllergies,
    );
    const hasRx    = cart.some(i => i.product.category === 'Rx');
    const rxBlocker = hasRx && !rxValidated
      ? ['Prescription required: cart contains Rx medications. Validate prescription to proceed.']
      : [];
    return { passed: result.passed && rxBlocker.length === 0, warnings: result.warnings, blockers: [...result.blockers, ...rxBlocker] };
  }, [cart, selectedPatientAllergies, rxValidated]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // Cart handlers
  const addToCart = (product: Product) => {
    setMessage(null);
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      const batch = product.sku === 'WARF'     ? 'B-WARF-02' :
                    product.sku === 'ASPIRIN'  ? 'B-ASPI-02' :
                    product.sku === 'ERYTHR'   ? 'B-ERYT-02' :
                    product.sku === 'SIMVA'    ? 'B-SIMV-02' :
                    product.sku === 'ATORV'    ? 'B-ATOR-02' : 'B-IBUP-02';
      if (idx > -1) return prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it);
      return [...prev, { product, batchNumber: batch, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(it => {
      if (it.product.id === id) {
        const next = it.quantity + delta;
        return next > 0 ? { ...it, quantity: next } : it;
      }
      return it;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(it => it.product.id !== id));

  const clearCart = () => {
    setCart([]); setRxValidated(false); setRxNumber(''); setDoctorName('');
    setPatientProfile('none'); setPharmacistSignature(null); setPrintedReceipt(null);
    setDiscountAmount(0); setMessage(null); setSearchQuery('');
  };

  // Pharmacist override
  const handlePharmacistOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError('');
    try {
      const res = await fetch(`${edgeUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: overrideUser, password: overridePass }),
      });
      if (!res.ok) throw new Error('Authentication failed');
      const data = await res.json();
      if (['PHARMACIST', 'BRANCH_MANAGER', 'ADMIN'].includes(data.user.role)) {
        setPharmacistSignature({ username: data.user.username });
        setShowOverrideModal(false);
        setOverrideUser(''); setOverridePass('');
      } else {
        setOverrideError('Only Pharmacist, Manager, or Admin accounts can authorize overrides.');
      }
    } catch {
      setOverrideError('Invalid credentials. Authorization refused.');
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true); setMessage(null);
    if (safetyChecks.warnings.length > 0 && !pharmacistSignature) {
      setShowOverrideModal(true); setLoading(false); return;
    }
    try {
      const res = await fetch(`${edgeUrl}/api/v1/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          items: cart.map(it => ({ productId: it.product.id, batchNumber: it.batchNumber, quantity: it.quantity })),
          paymentMethod, taxAmount, discountAmount,
          prescription: rxValidated ? { patientName, doctorName, rxNumber } : undefined,
          patientAllergyFlags: selectedPatientAllergies,
          pharmacistOverrideCredentials: pharmacistSignature ? { username: pharmacistSignature.username, role: 'PHARMACIST' } : undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Transaction rejected');
      setMessage({ type: 'success', text: `Transaction completed. Sale ID: ${result.saleId.slice(0, 8)}…` });
      setPrintedReceipt({
        id: result.saleId, cashier: session.username, timestamp: new Date().toLocaleTimeString(),
        items: [...cart], subtotal, taxAmount, discountAmount, grandTotal: result.total,
        paymentMethod, prescription: rxValidated ? { rxNumber, doctorName } : null,
        overridden: pharmacistSignature !== null,
      });
      setCart([]); setRxValidated(false); setRxNumber(''); setDoctorName('');
      setPatientProfile('none'); setPharmacistSignature(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Server error during checkout.' });
    } finally { setLoading(false); }
  };

  const setPayment = (display: 'CASH' | 'CARD' | 'MOBILE', method: 'CASH' | 'DIGITAL') => {
    setPaymentDisplay(display); setPaymentMethod(method);
  };

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky top controls ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-3 shrink-0">

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">POS Checkout</h1>
            <p className="page-subtitle">Branch Edge Terminal — Real-time clinical safety validation</p>
          </div>
          <button id="btn-clear-cart" onClick={clearCart} className="btn-secondary btn-sm no-print">
            Clear Workspace
          </button>
        </div>

        {/* Patient selector — compact horizontal pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-600 shrink-0">Patient:</span>
          {([
            { id: 'none', label: 'Anonymous', allergy: null },
            { id: 'john', label: 'John Doe', allergy: 'Allergic: Ibuprofen' },
            { id: 'jane', label: 'Jane Smith', allergy: null },
          ] as const).map(p => (
            <button
              key={p.id}
              onClick={() => setPatientProfile(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                patientProfile === p.id
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
              {p.allergy && (
                <span className="badge badge-red text-[10px]">⚠</span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            id="pos-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by drug name or SKU…"
            className="input-field pl-9 pr-8"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {message && (
        <div className={`mx-6 mt-4 shrink-0 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertOctagon size={16} />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* ── Main split layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── 70% Catalog ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-w-0">

          {/* Rx prescription form */}
          {cart.some(i => i.product.category === 'Rx') && (
            <div className="card p-4 border-orange-200 bg-orange-50/60">
              <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2 mb-3">
                <AlertTriangle size={15} /> Prescription Validation Required
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text" placeholder="Doctor Name" value={doctorName}
                  onChange={e => setDoctorName(e.target.value)} className="input-field"
                />
                <input
                  type="text" placeholder="Rx Number" value={rxNumber}
                  onChange={e => setRxNumber(e.target.value)} className="input-field"
                />
                <div className="flex items-center gap-2 px-1">
                  <input
                    id="rx-check" type="checkbox" checked={rxValidated}
                    onChange={e => setRxValidated(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="rx-check" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                    Prescription Validated
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Product catalog grid */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {filteredProducts.length} Product{filteredProducts.length !== 1 ? 's' : ''} Available
            </p>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Package size={36} className="opacity-30 mb-3" />
                <p className="text-sm">No products found for <em>"{searchQuery}"</em></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                {filteredProducts.map(product => {
                  const inCart = cart.find(i => i.product.id === product.id);
                  return (
                    <div
                      key={product.id}
                      id={`product-${product.sku}`}
                      onClick={() => addToCart(product)}
                      className={`card flex items-center gap-3 p-4 cursor-pointer transition-all h-[100px]
                        hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md group
                        ${inCart ? 'border-blue-300 bg-blue-50/20' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`badge ${product.category === 'Rx' ? 'badge-orange' : 'badge-teal'}`}>
                            {product.category}
                          </span>
                          {inCart && (
                            <span className="badge badge-blue text-[10px]">In cart ×{inCart.quantity}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 truncate leading-tight">{product.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 font-mono">SKU: {product.sku}</span>
                          <span className="text-xs font-semibold text-gray-700">10.00 ETB</span>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0
                        ${inCart
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-blue-600 group-hover:text-white'
                        }`}>
                        <Plus size={16} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Receipt preview */}
          {printedReceipt && (
            <div className="border-2 border-dashed border-gray-200 bg-white rounded-xl p-6 max-w-sm mx-auto w-full mt-2">
              <div className="text-center border-b border-dashed border-gray-200 pb-4 mb-4">
                <h3 className="font-bold text-gray-900 tracking-widest text-sm">IMANAPHARMA</h3>
                <p className="text-xs text-gray-400 mt-1">Branch Edge: North</p>
                <p className="text-xs text-gray-400">{printedReceipt.timestamp} — {new Date().toLocaleDateString()}</p>
              </div>
              <div className="text-xs text-gray-600 mb-3 flex flex-col gap-0.5">
                <div>Cashier: <span className="font-semibold">{printedReceipt.cashier}</span></div>
                {printedReceipt.prescription && (
                  <div className="text-green-700">Rx: {printedReceipt.prescription.rxNumber} — Dr. {printedReceipt.prescription.doctorName}</div>
                )}
                {printedReceipt.overridden && <div className="text-amber-700">⚠ Pharmacist Override Applied</div>}
              </div>
              <div className="flex flex-col gap-1 border-t border-dashed border-gray-200 pt-3 mb-3">
                {printedReceipt.items.map((item: any) => (
                  <div key={item.product.id} className="flex justify-between text-xs">
                    <span>{item.product.name} ×{item.quantity}</span>
                    <span className="font-mono">{(item.quantity * 10).toFixed(2)} ETB</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1 border-t border-gray-200 pt-3 text-xs">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="font-mono">{printedReceipt.subtotal.toFixed(2)} ETB</span></div>
                <div className="flex justify-between text-gray-400"><span>Tax (8%)</span><span className="font-mono">{printedReceipt.taxAmount.toFixed(2)} ETB</span></div>
                {printedReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600"><span>Discount</span><span>-{printedReceipt.discountAmount.toFixed(2)} ETB</span></div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-sm pt-2 border-t border-gray-200">
                  <span>GRAND TOTAL</span>
                  <span className="font-mono text-blue-600">{printedReceipt.grandTotal.toFixed(2)} ETB</span>
                </div>
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-3 font-mono">ID: {printedReceipt.id}</p>
              <button onClick={() => window.print()} className="btn-secondary w-full mt-3 gap-2">
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          )}
        </div>

        {/* ── 30% Cart Panel ───────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">

          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={15} className="text-blue-600" />
              Cart
              {cart.length > 0 && (
                <span className="badge bg-blue-600 text-white ml-0.5">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              )}
            </h3>
            {patientName && (
              <span className="text-xs text-gray-500 font-medium truncate max-w-[100px]">{patientName}</span>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-12 px-4">
                <ShoppingCart size={36} className="opacity-20" />
                <p className="text-sm text-center text-gray-400">Cart is empty.<br />Click a product to add it.</p>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-1">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`badge text-[10px] ${item.product.category === 'Rx' ? 'badge-orange' : 'badge-teal'}`}>
                          {item.product.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate leading-tight">{item.product.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{(item.quantity * 10).toFixed(2)} ETB</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 pt-1">
                      <button
                        onClick={() => updateQty(item.product.id, -1)}
                        className="w-6 h-6 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="text-sm font-mono font-semibold w-6 text-center text-gray-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product.id, 1)}
                        className="w-6 h-6 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
                      >
                        <Plus size={10} />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center ml-1 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Clinical safety (inside scrollable area, below items) */}
                {cart.length > 0 && (safetyChecks.blockers.length > 0 || safetyChecks.warnings.length > 0) && (
                  <div className="mt-3 flex flex-col gap-2">
                    {safetyChecks.blockers.length > 0 && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                        <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs mb-2">
                          <AlertOctagon size={12} /> BLOCKED — Cannot Proceed
                        </div>
                        {safetyChecks.blockers.map((b: string, i: number) => (
                          <p key={i} className="text-xs text-red-600 leading-snug">{b}</p>
                        ))}
                      </div>
                    )}
                    {safetyChecks.warnings.length > 0 && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs mb-2">
                          <AlertTriangle size={12} /> Warning — Override Required
                        </div>
                        {safetyChecks.warnings.map((w: string, i: number) => (
                          <p key={i} className="text-xs text-amber-600 leading-snug">{w}</p>
                        ))}
                        {pharmacistSignature && (
                          <p className="text-xs text-green-700 mt-2 font-medium">
                            ✓ Authorized: {pharmacistSignature.username}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {cart.length > 0 && safetyChecks.passed && safetyChecks.warnings.length === 0 && (
                  <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 flex items-center gap-2 text-green-700 text-xs font-medium">
                    <CheckCircle2 size={12} /> All safety checks passed
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed footer: totals + payment + checkout */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 p-4 flex flex-col gap-3 shrink-0 bg-white">

              {/* Totals */}
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">{subtotal.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Tax (8%)</span>
                  <span>{taxAmount.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Discount</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={discountAmount || ''}
                    onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-20 h-7 text-right px-2 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Total</span>
                  <span className="text-blue-600 font-mono">{grandTotal.toFixed(2)} ETB</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-3 gap-1.5">
                {(['CASH', 'CARD', 'MOBILE'] as const).map(pm => (
                  <button
                    key={pm}
                    onClick={() => setPayment(pm, pm === 'CASH' ? 'CASH' : 'DIGITAL')}
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      paymentDisplay === pm
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pm === 'CASH' ? 'Cash' : pm === 'CARD' ? 'Card' : 'Mobile'}
                  </button>
                ))}
              </div>

              {/* Checkout button */}
              <button
                id="btn-checkout"
                onClick={handleCheckout}
                disabled={loading || !safetyChecks.passed}
                className={`w-full h-11 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                  !safetyChecks.passed
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : loading
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? 'Processing…' : `Checkout — ${grandTotal.toFixed(2)} ETB`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Pharmacist Override Modal ────────────────────────────────────────── */}
      {showOverrideModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <div className="modal-header">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-500" />
                Pharmacist Authorization Required
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-gray-500">
                Clinical warnings detected. Enter pharmacist credentials to authorize this transaction.
              </p>
              <form id="override-form" onSubmit={handlePharmacistOverrideSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Pharmacist Username</label>
                  <input
                    type="text" value={overrideUser} onChange={e => setOverrideUser(e.target.value)}
                    placeholder="e.g. pharmacist_north" className="input-field" required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password" value={overridePass} onChange={e => setOverridePass(e.target.value)}
                    placeholder="Password" className="input-field" required
                  />
                </div>
                {overrideError && <div className="alert-error text-sm">{overrideError}</div>}
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowOverrideModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" form="override-form" className="btn-primary flex-1">Authorize Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

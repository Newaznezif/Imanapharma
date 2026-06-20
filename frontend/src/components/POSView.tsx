import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, AlertTriangle, AlertOctagon, CheckCircle2, ShieldAlert, Printer, Info } from 'lucide-react';
import { UserSession } from '../App';

// --- Inline Clinical Safety Graph (avoids Vite cross-root resolution issues) ---
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
          const msg = `Interaction: ${cartDrugs[i].name} + ${cartDrugs[j].name}. Severity: ${e.severity}. ${e.description}`;
          (e.severity === 'HIGH' || e.severity === 'CRITICAL' ? blockers : warnings).push(msg);
        }
      }
    }
    for (const d of cartDrugs) if (allergyFlags.includes(d.sku)) blockers.push(`Allergy block: Patient is allergic to ${d.name}.`);
    return { passed: blockers.length === 0, warnings, blockers };
  }
}
const defaultSafetyGraph = new DrugInteractionGraph();
defaultSafetyGraph.addInteraction('WARF', 'ASPIRIN', 'CRITICAL', 'Concomitant use increases risk of severe GI bleeding.');
defaultSafetyGraph.addInteraction('ERYTHR', 'SIMVA', 'HIGH', 'Erythromycin raises Simvastatin plasma levels, risking rhabdomyolysis.');
defaultSafetyGraph.addInteraction('ATORV', 'SIMVA', 'MEDIUM', 'Both are statins; combined use may increase muscle-pain risk.');
defaultSafetyGraph.addInteraction('IBUPROFEN', 'ASPIRIN', 'LOW', 'Ibuprofen may reduce the antiplatelet effect of low-dose aspirin.');
// ---------------------------------------------------------------------------------


interface Product {
  id: string;
  sku: string;
  name: string;
  category: 'Rx' | 'OTC';
  description?: string;
}

interface CartItem {
  product: Product;
  batchNumber: string;
  quantity: number;
}

interface POSViewProps {
  session: UserSession;
  edgeUrl: string;
}

export default function POSView({ session, edgeUrl }: POSViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Clinical parameters
  const [selectedPatientAllergies, setSelectedPatientAllergies] = useState<string[]>([]);
  const [patientProfile, setPatientProfile] = useState<'none' | 'john' | 'jane'>('none');
  const [rxValidated, setRxValidated] = useState(false);
  const [rxNumber, setRxNumber] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [patientName, setPatientName] = useState('');

  // Pharmacist override
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideUser, setOverrideUser] = useState('');
  const [overridePass, setOverridePass] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [pharmacistSignature, setPharmacistSignature] = useState<{ username: string } | null>(null);

  // Financials
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'DIGITAL'>('CASH');
  const [taxRate] = useState(0.08); // 8% tax
  const [discountAmount, setDiscountAmount] = useState(0);

  // Receipt printed simulation
  const [printedReceipt, setPrintedReceipt] = useState<any | null>(null);

  // Load products on start
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch(`${edgeUrl}/api/v1/inventory/products`, {
          headers: { Authorization: `Bearer ${session.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load local product catalog:', err);
      }
    };
    fetchCatalog();
  }, [edgeUrl, session.token]);

  // Adjust patient profile settings
  useEffect(() => {
    if (patientProfile === 'john') {
      setSelectedPatientAllergies(['IBUPROFEN']); // John is allergic to Ibuprofen
      setPatientName('John Doe');
    } else if (patientProfile === 'jane') {
      setSelectedPatientAllergies([]); // Jane has no allergies
      setPatientName('Jane Smith');
    } else {
      setSelectedPatientAllergies([]);
      setPatientName('');
    }
  }, [patientProfile]);

  // Compute subtotal
  const subtotal = useMemo(() => {
    // Treat each product as costing a flat 10.00 ETB for simulation
    return cart.reduce((sum, item) => sum + item.quantity * 10.00, 0);
  }, [cart]);

  const taxAmount = useMemo(() => subtotal * taxRate, [subtotal, taxRate]);
  const grandTotal = useMemo(() => Math.max(0, subtotal + taxAmount - discountAmount), [subtotal, taxAmount, discountAmount]);

  // Perform real-time clinical safety check on frontend
  const safetyChecks = useMemo(() => {
    const graphInput = cart.map(item => ({
      sku: item.product.sku,
      name: item.product.name
    }));

    const result = defaultSafetyGraph.checkSafety(graphInput, selectedPatientAllergies);

    // Check Rx validation
    const hasRxMed = cart.some(i => i.product.category === 'Rx');
    const rxBlocker = (hasRxMed && !rxValidated) ? [
      'Prescription Required: The cart contains prescription-only (Rx) medications. Pharmacist prescription signature is required to continue.'
    ] : [];

    return {
      passed: result.passed && rxBlocker.length === 0,
      warnings: result.warnings,
      blockers: [...result.blockers, ...rxBlocker]
    };
  }, [cart, selectedPatientAllergies, rxValidated]);

  // Handlers
  const addToCart = (product: Product) => {
    setMessage(null);
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      
      // Determine a batch code
      const batchNumber = product.sku === 'WARF' ? 'B-WARF-02' :
                          product.sku === 'ASPIRIN' ? 'B-ASPI-02' :
                          product.sku === 'ERYTHR' ? 'B-ERYT-02' :
                          product.sku === 'SIMVA' ? 'B-SIMV-02' :
                          product.sku === 'ATORV' ? 'B-ATOR-02' : 'B-IBUP-02';

      if (idx > -1) {
        return prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, { product, batchNumber, quantity: 1 }];
      }
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const nextQty = item.quantity + delta;
        return nextQty > 0 ? { ...item, quantity: nextQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setRxValidated(false);
    setRxNumber('');
    setDoctorName('');
    setPatientProfile('none');
    setPharmacistSignature(null);
    setPrintedReceipt(null);
  };

  // Perform pharmacist override check
  const handlePharmacistOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError('');

    try {
      const res = await fetch(`${edgeUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: overrideUser, password: overridePass })
      });

      if (!res.ok) {
        throw new Error('Authentication failed');
      }

      const data = await res.json();
      if (['PHARMACIST', 'BRANCH_MANAGER', 'ADMIN'].includes(data.user.role)) {
        setPharmacistSignature({ username: data.user.username });
        setShowOverrideModal(false);
        setOverrideUser('');
        setOverridePass('');
      } else {
        setOverrideError('Only accounts with Pharmacist, Manager, or Admin roles can override safety alerts.');
      }
    } catch (err) {
      setOverrideError('Invalid credentials. Pharmacist approval refused.');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setMessage(null);

    // If warnings present, enforce pharmacist signature override
    if (safetyChecks.warnings.length > 0 && !pharmacistSignature) {
      setShowOverrideModal(true);
      setLoading(false);
      return;
    }

    const payload = {
      items: cart.map(item => ({
        productId: item.product.id,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
      })),
      paymentMethod,
      taxAmount,
      discountAmount,
      prescription: rxValidated ? {
        patientName,
        doctorName,
        rxNumber,
      } : undefined,
      patientAllergyFlags: selectedPatientAllergies,
      pharmacistOverrideCredentials: pharmacistSignature ? {
        username: pharmacistSignature.username,
        role: 'PHARMACIST'
      } : undefined,
    };

    try {
      const res = await fetch(`${edgeUrl}/api/v1/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Transaction rejected');
      }

      setMessage({ type: 'success', text: `Transaction completed successfully! Sale ID: ${result.saleId.slice(0, 8)}...` });
      
      // Store details for receipt printout
      setPrintedReceipt({
        id: result.saleId,
        cashier: session.username,
        timestamp: new Date().toLocaleTimeString(),
        items: [...cart],
        subtotal,
        taxAmount,
        discountAmount,
        grandTotal: result.total,
        paymentMethod,
        prescription: rxValidated ? { rxNumber, doctorName } : null,
        overridden: pharmacistSignature !== null
      });

      // Reset states
      setCart([]);
      setRxValidated(false);
      setRxNumber('');
      setDoctorName('');
      setPatientProfile('none');
      setPharmacistSignature(null);

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Server error occurred during checkout.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">POS Cashier Workspace</h1>
          <p className="text-slate-400 text-sm">Create customer receipts, scan drugs, and check safety engine rules.</p>
        </div>
        <button 
          onClick={clearCart}
          className="text-xs text-slate-500 hover:text-slate-200 border border-slate-800 p-2 rounded-lg bg-slate-900/40 hover:bg-slate-900 transition-colors"
        >
          Clear Workspace
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertOctagon size={20} />}
          <div className="text-sm font-semibold">{message.text}</div>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Product catalog and checkout parameters (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Patients profile simulator */}
          <div className="glass-card p-5 rounded-2xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Info size={16} className="text-indigo-400" /> Patient Simulation Profile
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setPatientProfile('none')}
                className={`p-3 text-xs font-semibold rounded-xl border text-center transition-all ${patientProfile === 'none' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}
              >
                Anonymous Patient
              </button>
              <button 
                onClick={() => setPatientProfile('john')}
                className={`p-3 text-xs font-semibold rounded-xl border text-center transition-all ${patientProfile === 'john' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}
              >
                John Doe (Allergic: Ibuprofen)
              </button>
              <button 
                onClick={() => setPatientProfile('jane')}
                className={`p-3 text-xs font-semibold rounded-xl border text-center transition-all ${patientProfile === 'jane' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}
              >
                Jane Smith (No Allergies)
              </button>
            </div>
          </div>

          {/* Product Cards Catalog Grid */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">Seeded Product Catalog</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="glass-card p-4 rounded-xl cursor-pointer hover:border-emerald-500/30 flex justify-between items-center relative overflow-hidden"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.category === 'Rx' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
                        {product.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{product.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 truncate max-w-xs">{product.description}</p>
                    <span className="text-xs text-indigo-400 font-mono">SKU: {product.sku}</span>
                  </div>
                  <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
                    <Plus size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rx Prescription inputs if Rx drugs are in cart */}
          {cart.some(item => item.product.category === 'Rx') && (
            <div className="glass-card p-5 rounded-2xl flex flex-col gap-4 border-rose-500/20">
              <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={16} /> Rx Prescription Validation Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input 
                  type="text" 
                  placeholder="Doctor Name" 
                  value={doctorName} 
                  onChange={e => setDoctorName(e.target.value)}
                  className="glass-input p-3 rounded-xl text-xs bg-slate-900 border border-slate-800"
                />
                <input 
                  type="text" 
                  placeholder="Rx Validation Code" 
                  value={rxNumber} 
                  onChange={e => setRxNumber(e.target.value)}
                  className="glass-input p-3 rounded-xl text-xs bg-slate-900 border border-slate-800"
                />
                <div className="flex items-center gap-2 pl-2">
                  <input 
                    type="checkbox" 
                    id="rx_check"
                    checked={rxValidated}
                    onChange={e => setRxValidated(e.target.checked)}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="rx_check" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                    Prescription Validated
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Printable Receipt Preview Simulator */}
          {printedReceipt && (
            <div className="bg-slate-900 border-2 border-dashed border-slate-800 p-6 rounded-2xl flex flex-col gap-4 max-w-md mx-auto w-full shadow-2xl relative">
              <div className="text-center border-b border-dashed border-slate-800 pb-4">
                <h3 className="text-xl font-bold tracking-wider">IMANAPHARMA</h3>
                <p className="text-xs text-slate-400 font-mono">Branch Edge: 22222222 (North)</p>
                <p className="text-xs text-slate-500 font-mono">{printedReceipt.timestamp} - Date: {new Date().toLocaleDateString()}</p>
              </div>

              <div className="flex flex-col gap-2 font-mono text-xs text-slate-300 border-b border-dashed border-slate-800 pb-4">
                <div className="flex justify-between font-semibold">
                  <span>Cashier: {printedReceipt.cashier}</span>
                </div>
                {printedReceipt.prescription && (
                  <div className="text-[10px] text-emerald-400">
                    <div>Rx Validated: {printedReceipt.prescription.rxNumber}</div>
                    <div>Dr. {printedReceipt.prescription.doctorName}</div>
                  </div>
                )}
                {printedReceipt.overridden && (
                  <span className="text-[10px] text-amber-400">Pharmacist Approved Override</span>
                )}
              </div>

              <div className="flex flex-col gap-2 border-b border-dashed border-slate-800 pb-4">
                {printedReceipt.items.map((item: any) => (
                  <div key={item.product.id} className="flex justify-between text-xs font-mono text-slate-300">
                    <span>{item.product.name} (x{item.quantity})</span>
                    <span>{(item.quantity * 10.00).toFixed(2)} ETB</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 font-mono text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{printedReceipt.subtotal.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Taxes (8.00%)</span>
                  <span>{printedReceipt.taxAmount.toFixed(2)} ETB</span>
                </div>
                {printedReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-[10px] text-emerald-400">
                    <span>Discounts</span>
                    <span>-{printedReceipt.discountAmount.toFixed(2)} ETB</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-slate-800">
                  <span>GRAND TOTAL</span>
                  <span>{printedReceipt.grandTotal.toFixed(2)} ETB</span>
                </div>
                <div className="text-center text-[10px] text-slate-500 pt-4">
                  ID: {printedReceipt.id}
                </div>
              </div>

              <button 
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 mt-2"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Cart list, Clinical Validation panels and Checkout (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Cart Sidebar */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col gap-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart size={18} className="text-indigo-400" /> POS Cart List
            </h3>

            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
                <ShoppingCart size={28} className="opacity-30" />
                <p className="text-xs">Your basket is empty. Click on a product to scan.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Cart Items list */}
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-900">
                      <div className="overflow-hidden pr-2">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{item.product.name}</h4>
                        <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                          <span>Batch: {item.batchNumber}</span>
                          <span>-</span>
                          <span>OTC</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          onClick={() => updateQty(item.product.id, -1)}
                          className="p-1 text-slate-400 hover:text-slate-100 bg-slate-900 rounded border border-slate-800"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-mono font-bold text-slate-200 px-1">{item.quantity}</span>
                        <button 
                          onClick={() => updateQty(item.product.id, 1)}
                          className="p-1 text-slate-400 hover:text-slate-100 bg-slate-900 rounded border border-slate-800"
                        >
                          <Plus size={10} />
                        </button>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotals & checkout summary */}
                <div className="border-t border-slate-800 pt-4 flex flex-col gap-2 text-xs font-semibold text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-slate-200">{subtotal.toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Taxes (8.00%):</span>
                    <span className="text-slate-300">{taxAmount.toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Discount:</span>
                    <input 
                      type="number" 
                      placeholder="Discount" 
                      value={discountAmount || ''} 
                      onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="glass-input w-16 text-right px-1.5 py-0.5 rounded text-[11px] bg-slate-950 border border-slate-900 font-mono text-emerald-400"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold text-white pt-3 border-t border-slate-850">
                    <span>GRAND TOTAL:</span>
                    <span className="text-lg text-emerald-400 font-mono">{grandTotal.toFixed(2)} ETB</span>
                  </div>
                </div>

                {/* Payment selectors */}
                <div className="flex flex-col gap-2 pt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setPaymentMethod('CASH')}
                      className={`p-2 text-xs font-semibold rounded-lg border text-center transition-all ${paymentMethod === 'CASH' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300' : 'bg-slate-950/60 border-slate-900 text-slate-500'}`}
                    >
                      Cash Payment
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('DIGITAL')}
                      className={`p-2 text-xs font-semibold rounded-lg border text-center transition-all ${paymentMethod === 'DIGITAL' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300' : 'bg-slate-950/60 border-slate-900 text-slate-500'}`}
                    >
                      Digital Pay
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Clinical Validation Summary Panel */}
          {cart.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col gap-4 shadow-xl">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={18} className="text-indigo-400" /> Clinical Safety Engine
              </h3>

              {/* Warnings List */}
              {safetyChecks.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3.5 rounded-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                    <AlertTriangle size={14} /> Safety Warnings (Overrides Required)
                  </div>
                  <ul className="list-disc pl-4 flex flex-col gap-1 font-medium text-[11px] leading-relaxed">
                    {safetyChecks.warnings.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                  </ul>
                  
                  {pharmacistSignature ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-lg font-bold text-[10px] mt-2 flex items-center gap-2 justify-center">
                      <CheckCircle2 size={12} /> Approved by Pharmacist: {pharmacistSignature.username}
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowOverrideModal(true)}
                      className="mt-2 w-full bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/30 text-amber-300 font-semibold p-2 rounded-lg text-[10px] transition-all"
                    >
                      Verify Pharmacist Override Credentials
                    </button>
                  )}
                </div>
              )}

              {/* Blockers List */}
              {safetyChecks.blockers.length > 0 ? (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                    <AlertOctagon size={14} /> Blocking Violations (Checkout Blocked)
                  </div>
                  <ul className="list-disc pl-4 flex flex-col gap-1 font-medium text-[11px] leading-relaxed">
                    {safetyChecks.blockers.map((b: string, idx: number) => <li key={idx}>{b}</li>)}
                  </ul>
                </div>
              ) : (
                safetyChecks.warnings.length === 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold">
                    <CheckCircle2 size={16} /> All clinical checks passed. Ready for checkout.
                  </div>
                )
              )}

              {/* Checkout Exec button */}
              <button 
                onClick={handleCheckout}
                disabled={loading || !safetyChecks.passed || (safetyChecks.warnings.length > 0 && !pharmacistSignature)}
                className={`w-full text-white font-bold p-3.5 rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-2 border ${safetyChecks.passed && (safetyChecks.warnings.length === 0 || pharmacistSignature) ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 border-indigo-500/20 shadow-lg shadow-indigo-500/10' : 'bg-slate-900 border-slate-950 text-slate-500 cursor-not-allowed'}`}
              >
                {loading ? 'Processing Checkout...' : 'Finalize Sale & Open Drawer'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Pharmacist Credentials Override Modal Dialog */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col gap-4">
            <div className="flex flex-col gap-1 text-center">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 justify-center">
                <ShieldAlert size={18} /> Pharmacist Approval Signature
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">To override warning alerts, present pharmacist login credentials.</p>
            </div>

            <form onSubmit={handlePharmacistOverrideSubmit} className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Pharmacist Username" 
                value={overrideUser}
                onChange={e => setOverrideUser(e.target.value)}
                className="glass-input p-3 rounded-lg text-xs bg-slate-950 border border-slate-900"
                required
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={overridePass}
                onChange={e => setOverridePass(e.target.value)}
                className="glass-input p-3 rounded-lg text-xs bg-slate-950 border border-slate-900"
                required
              />

              {overrideError && (
                <div className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 p-2 rounded text-center">
                  {overrideError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowOverrideModal(false);
                    setOverrideUser('');
                    setOverridePass('');
                    setOverrideError('');
                  }}
                  className="bg-slate-900 border border-slate-850 text-slate-400 p-2 rounded-lg text-xs font-semibold hover:bg-slate-850 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-lg text-xs font-semibold transition-colors"
                >
                  Verify Signature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

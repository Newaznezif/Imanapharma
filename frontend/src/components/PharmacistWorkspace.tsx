import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Minus, Trash2, AlertTriangle, AlertOctagon, CheckCircle2, 
  ShoppingCart, FileText, ClipboardList, Database, UserPlus, X, RefreshCw, CreditCard 
} from 'lucide-react';
import { UserSession } from '../App';
import PharmacyLogo from '../shared/PharmacyLogo';

// ─── Clinical Safety Graph Engine ───────────────────────────────────────────
type InteractionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
class DrugInteractionGraph {
  private adj: Map<string, Map<string, { severity: InteractionSeverity; description: string }>> = new Map();
  addDrug(d: string) { if (!this.adj.has(d)) this.adj.set(d, new Map()); }
  addInteraction(a: string, b: string, severity: InteractionSeverity, description: string) {
    this.addDrug(a); this.addDrug(b);
    this.adj.get(a)!.set(b, { severity, description });
    this.adj.get(b)!.set(a, { severity, description });
  }
  checkSafety(cartDrugs: { drug_name: string; id: string }[], allergyFlags: string[] = []) {
    const warnings: string[] = [], blockers: string[] = [];
    
    // We map drug names/classes to identify matches in clinical constraints
    // Normalized check:
    const drugNames = cartDrugs.map(d => d.drug_name.toUpperCase());

    // WARFARIN + ASPIRIN check
    if (drugNames.some(n => n.includes('WARFARIN')) && drugNames.some(n => n.includes('ASPIRIN'))) {
      blockers.push('CRITICAL INTERACTION: Warfarin + Aspirin. Concomitant use increases risk of severe gastrointestinal bleeding.');
    }
    // ERYTHROMYCIN + SIMVASTATIN check
    if (drugNames.some(n => n.includes('ERYTHROMYCIN')) && drugNames.some(n => n.includes('SIMVASTATIN'))) {
      blockers.push('HIGH INTERACTION: Erythromycin + Simvastatin. Erythromycin increases statin levels, raising rhabdomyolysis risks.');
    }
    // ATORVASTATIN + SIMVASTATIN check
    if (drugNames.some(n => n.includes('ATORVASTATIN')) && drugNames.some(n => n.includes('SIMVASTATIN'))) {
      warnings.push('MEDIUM INTERACTION: Atorvastatin + Simvastatin. Both are statins; combined use may increase myalgia risks.');
    }

    // Allergy check
    for (const d of cartDrugs) {
      if (allergyFlags.some(a => d.drug_name.toUpperCase().includes(a.toUpperCase()))) {
        blockers.push(`ALLERGY BLOCK: Patient has documented allergy flag against "${d.drug_name}".`);
      }
    }

    return { passed: blockers.length === 0, warnings, blockers };
  }
}
const safetyEngine = new DrugInteractionGraph();

// Props definition
interface PharmacistWorkspaceProps {
  session: UserSession;
  onLogout: () => void;
  pharmacyInfo: any;
}

export default function PharmacistWorkspace({ session, onLogout, pharmacyInfo }: PharmacistWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'medicines' | 'create-order' | 'patient-history' | 'checkout'>('create-order');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // States
  const [medicines, setMedicines] = useState<any[]>([]);
  const [medQuery, setMedQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  // patientQuery feeds the search API; setter is intentionally unused (static empty string for now)
  const [patientQuery] = useState('');

  // POS Checkout state
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Stock Adjustment states
  const [adjustReason, setAdjustReason] = useState('MANUAL_ADDITION');
  const [adjustNotes, setAdjustNotes] = useState('');

  // POS Tax and Discount states
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(15);
  const [barcodeInput, setBarcodeInput] = useState('');


  // Cart & Order state
  const [cart, setCart] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('Anonymous');
  const [selectedPatientAllergies, setSelectedPatientAllergies] = useState<string[]>([]);
  const [rxNumber, setRxNumber] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [rxValidated, setRxValidated] = useState(false);
  const [overrideAuthorized, setOverrideAuthorized] = useState(false);

  // Patient Creation Form
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientAllergy, setNewPatientAllergy] = useState('');
  const [newPatientECName, setNewPatientECName] = useState('');
  const [newPatientECPhone, setNewPatientECPhone] = useState('');
  const [newPatientInsProvider, setNewPatientInsProvider] = useState('');
  const [newPatientInsPolicy, setNewPatientInsPolicy] = useState('');
  const [newPatientMedicalHistory, setNewPatientMedicalHistory] = useState('');

  // Stock Adjustment Form
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTargetMed, setAdjustTargetMed] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState(0);

  // Patient History lookup details
  const [lookupPatientId, setLookupPatientId] = useState('');
  const [patientHistory, setPatientHistory] = useState<any>(null);

  const API_URL = 'http://localhost:5001/api/v1';

  // Fetch functions
  const fetchMedicines = async () => {
    try {
      const res = await fetch(`${API_URL}/medicines?q=${medQuery}`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) setMedicines(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_URL}/patients?q=${patientQuery}`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) setPatients(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchPendingOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/orders/pending`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingOrders(data || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchPatientDetailsHistory = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/patients/${id}/history`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) setPatientHistory(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMedicines();
    fetchPatients();
    fetchPendingOrders();
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [medQuery]);

  useEffect(() => {
    fetchPatients();
  }, [patientQuery]);

  useEffect(() => {
    if (lookupPatientId) {
      fetchPatientDetailsHistory(lookupPatientId);
    } else {
      setPatientHistory(null);
    }
  }, [lookupPatientId]);

  // Handle select patient
  const handleSelectPatient = (pat: any) => {
    if (pat === 'none') {
      setSelectedPatientId('');
      setSelectedPatientName('Anonymous');
      setSelectedPatientAllergies([]);
    } else {
      setSelectedPatientId(pat.id);
      setSelectedPatientName(pat.name);
      setSelectedPatientAllergies(pat.allergy_flags || []);
    }
    setOverrideAuthorized(false);
  };

  // Cart operations
  const addToCart = (med: any) => {
    setMessage(null);
    const existing = cart.find(item => item.id === med.id);
    if (existing) {
      if (existing.quantity + 1 > med.quantity) {
        setMessage({ type: 'error', text: `Only ${med.quantity} units of ${med.drug_name} available in stock` });
        return;
      }
      setCart(cart.map(item => item.id === med.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      if (med.quantity < 1) {
        setMessage({ type: 'error', text: `${med.drug_name} is out of stock` });
        return;
      }
      setCart([...cart, { ...med, quantity: 1 }]);
    }
  };

  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    setMessage(null);
    try {
      const code = barcodeInput.trim();
      setBarcodeInput('');
      const res = await fetch(`${API_URL}/medicines?q=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (!res.ok) throw new Error('Failed to search barcode');
      const data = await res.json();
      const match = data.find((m: any) => m.barcode === code || m.barcode?.toLowerCase() === code.toLowerCase());
      if (!match) {
        setMessage({ type: 'error', text: `No medicine matches barcode: "${code}"` });
        return;
      }
      addToCart(match);
      setMessage({ type: 'success', text: `Scanned & added: ${match.drug_name} ${match.strength}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const updateCartQty = (id: string, delta: number) => {
    const item = cart.find(x => x.id === id);
    if (!item) return;

    const nextQty = item.quantity + delta;
    if (nextQty <= 0) {
      setCart(cart.filter(x => x.id !== id));
      return;
    }

    const originalMed = medicines.find(x => x.id === id);
    if (originalMed && nextQty > originalMed.quantity) {
      setMessage({ type: 'error', text: `Only ${originalMed.quantity} units available in stock.` });
      return;
    }

    setCart(cart.map(x => x.id === id ? { ...x, quantity: nextQty } : x));
  };

  // Clinical Safety calculations
  const safetyChecks = useMemo(() => {
    const cartDrugs = cart.map(it => ({ id: it.id, drug_name: it.drug_name }));
    const result = safetyEngine.checkSafety(cartDrugs, selectedPatientAllergies);

    const hasRx = cart.some(it => it.category === 'Rx' || it.category === 'PRESCRIPTION' || it.category === 'CONTROLLED');
    const rxBlocker = hasRx && !rxValidated
      ? ['PRESCRIPTION BLOCK: Prescription verification required for Rx/Prescription/Controlled medication. Enter doctor name and validate.']
      : [];

    const hasControlled = cart.some(it => it.category === 'CONTROLLED');
    const controlledBlocker = hasControlled && (!rxNumber || !doctorName)
      ? ['CONTROLLED SUBSTANCE BLOCK: Controlled substances mandate a valid Prescribing Doctor and Doctor License/Rx Document Number.']
      : [];

    const finalBlockers = [...result.blockers, ...rxBlocker, ...controlledBlocker];

    return {
      passed: finalBlockers.length === 0 && (result.warnings.length === 0 || overrideAuthorized),
      warnings: result.warnings,
      blockers: finalBlockers,
    };
  }, [cart, selectedPatientAllergies, rxValidated, rxNumber, doctorName, overrideAuthorized]);

  // Order Submission
  const handleGenerateOrder = async () => {
    if (cart.length === 0) return;
    setMessage(null);

    if (!safetyChecks.passed) {
      setMessage({ type: 'error', text: 'Order blocked by clinical safety checks.' });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          patient_name: selectedPatientName,
          patient_id: selectedPatientId || undefined,
          rx_number: rxNumber || undefined,
          doctor_name: doctorName || undefined,
          prescriber_license: rxNumber || undefined,
          discount_percent: discountPercent,
          tax_percent: taxPercent,
          items: cart.map(item => ({
            medicine_id: item.id,
            quantity: item.quantity
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit order');

      setMessage({ type: 'success', text: `Order #${data.orderNumber} successfully sent to Cashier.` });
      
      // Clear cart
      setCart([]);
      setSelectedPatientId('');
      setSelectedPatientName('Anonymous');
      setSelectedPatientAllergies([]);
      setRxNumber('');
      setDoctorName('');
      setRxValidated(false);
      setOverrideAuthorized(false);
      setDiscountPercent(0);
      setTaxPercent(15);

      // Refresh stock values
      fetchMedicines();
      fetchPendingOrders();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Create Patient Handler
  const handleCreatePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allergyFlags = newPatientAllergy.trim() 
      // commas separated values to uppercase list
        ? newPatientAllergy.split(',').map(s => s.trim().toUpperCase()) 
        : [];
      
      const res = await fetch(`${API_URL}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ 
          name: newPatientName, 
          phone: newPatientPhone || undefined,
          allergy_flags: allergyFlags,
          emergency_contact_name: newPatientECName || undefined,
          emergency_contact_phone: newPatientECPhone || undefined,
          insurance_provider: newPatientInsProvider || undefined,
          insurance_policy_number: newPatientInsPolicy || undefined,
          medical_history: newPatientMedicalHistory || undefined
        })
      });
      if (!res.ok) throw new Error('Failed to create patient');
      const newPat = await res.json();
      
      handleSelectPatient(newPat);
      setShowPatientModal(false);
      setNewPatientName('');
      setNewPatientPhone('');
      setNewPatientAllergy('');
      setNewPatientECName('');
      setNewPatientECPhone('');
      setNewPatientInsProvider('');
      setNewPatientInsPolicy('');
      setNewPatientMedicalHistory('');
      fetchPatients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Stock Adjustment Handler
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetMed) return;
    try {
      const diff = adjustQty - adjustTargetMed.quantity;
      if (diff === 0) {
        setShowAdjustModal(false);
        return;
      }

      const res = await fetch(`${API_URL}/medicines/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          medicine_id: adjustTargetMed.id,
          quantity_adjusted: diff,
          reason: adjustReason,
          notes: adjustNotes
        })
      });
      if (!res.ok) throw new Error('Adjustment update failed');
      
      setMessage({ type: 'success', text: `Quantity for "${adjustTargetMed.drug_name}" adjusted. Diff: ${diff > 0 ? '+' : ''}${diff}.` });
      setShowAdjustModal(false);
      setAdjustTargetMed(null);
      setAdjustNotes('');
      setAdjustReason('MANUAL_ADDITION');
      fetchMedicines();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const hasRxInCart = cart.some(it => it.category === 'Rx');
  const cartSubtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  // POS Checkout Handler
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setProcessingPayment(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/orders/${selectedOrder.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ payment_method: paymentMethod })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');

      setMessage({ type: 'success', text: `Order #${selectedOrder.order_number} paid successfully via ${paymentMethod}` });
      setSelectedOrder(null);
      fetchPendingOrders();
      fetchMedicines(); // Refresh stock in case other tabs are active
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <PharmacyLogo logoUrl={pharmacyInfo?.logo_url} size={38} shape="circle" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 leading-tight truncate">{pharmacyInfo?.name}</h2>
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mt-0.5">Pharmacist Space</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">
          <div>
            <p className="nav-section-label">Dispensing</p>
            <div className="flex flex-col gap-0.5 mt-1">
              <button onClick={() => setActiveTab('create-order')} className={activeTab === 'create-order' ? 'nav-item-active' : 'nav-item'}>
                <ShoppingCart size={16} /> <span>Create Patient Order</span>
              </button>
              <button onClick={() => setActiveTab('patient-history')} className={activeTab === 'patient-history' ? 'nav-item-active' : 'nav-item'}>
                <ClipboardList size={16} /> <span>Patient History</span>
              </button>
            </div>
          </div>

          <div>
            <p className="nav-section-label">Point of Sale (POS)</p>
            <div className="flex flex-col gap-0.5 mt-1">
              <button onClick={() => setActiveTab('checkout')} className={activeTab === 'checkout' ? 'nav-item-active' : 'nav-item'}>
                <CreditCard size={16} /> 
                <div className="flex items-center justify-between w-full pr-2">
                  <span>Checkout Counter</span>
                  {pendingOrders.length > 0 && (
                    <span className="badge badge-orange py-0.5 px-1.5">{pendingOrders.length}</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div>
            <p className="nav-section-label">Warehouse</p>
            <div className="flex flex-col gap-0.5 mt-1">
              <button onClick={() => setActiveTab('medicines')} className={activeTab === 'medicines' ? 'nav-item-active' : 'nav-item'}>
                <Database size={16} /> <span>Manage Medicines</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="border-t border-gray-100 p-4 shrink-0 flex flex-col gap-3">
          {/* User profile card with pharmacy logo */}
          <div className="flex items-center gap-2.5 bg-blue-50 rounded-lg px-3 py-2.5">
            <PharmacyLogo logoUrl={pharmacyInfo?.logo_url} size={32} shape="circle" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 truncate">{session.username}</p>
              <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Licensed Pharmacist</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="btn bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 w-full h-9 text-xs"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0 flex items-center justify-between h-[49px]">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {activeTab === 'create-order' && 'Order Creation Console'}
            {activeTab === 'patient-history' && 'Patient Clinical Ledgers'}
            {activeTab === 'medicines' && 'Active Inventory Ledger'}
            {activeTab === 'checkout' && 'Point of Sale (POS)'}
          </span>
          <button 
            onClick={() => { fetchMedicines(); fetchPatients(); fetchPendingOrders(); }} 
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={14} />
          </button>
        </header>

        {/* Global Toast */}
        {message && (
          <div className={`mx-6 mt-4 shrink-0 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertOctagon size={16} />}
            <span className="font-semibold text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {/* TAB: MANAGE MEDICINES */}
          {activeTab === 'medicines' && (
            <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto text-left">
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <input
                  type="text"
                  placeholder="Search medicines catalog..."
                  value={medQuery}
                  onChange={e => setMedQuery(e.target.value)}
                  className="input-field max-w-sm"
                />
              </div>

              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Drug Name</th>
                      <th>Strength</th>
                      <th>Category</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Stock Qty</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th className="text-right">Warehouse Adjust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((m: any) => (
                      <tr key={m.id}>
                        <td className="font-semibold text-gray-900">{m.drug_name}</td>
                        <td>{m.strength}</td>
                        <td>
                          <span className={`badge ${m.category === 'Rx' ? 'badge-orange' : 'badge-teal'}`}>
                            {m.category}
                          </span>
                        </td>
                        <td className="text-right font-mono font-medium">{Number(m.price).toFixed(2)} ETB</td>
                        <td className={`text-right font-mono font-bold ${m.quantity < 20 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>{m.quantity}</td>
                        <td className="font-mono text-gray-400 text-xs">{m.batch_number}</td>
                        <td className="text-xs text-gray-500">{new Date(m.expiry_date).toLocaleDateString()}</td>
                        <td className="text-right">
                          <button
                            onClick={() => {
                              setAdjustTargetMed(m);
                              setAdjustQty(m.quantity);
                              setShowAdjustModal(true);
                            }}
                            className="btn-secondary btn-sm"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CREATE ORDER */}
          {activeTab === 'create-order' && (
            <div className="flex h-full overflow-hidden">
              {/* Left Column (70%): Drug catalog + patient metadata */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-w-0 text-left">
                {/* Patient Search / Select Row */}
                <div className="card p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Patient Selection</span>
                    <button 
                      onClick={() => setShowPatientModal(true)} 
                      className="btn-secondary btn-sm text-[11px] gap-1 font-semibold hover:border-blue-400"
                    >
                      <UserPlus size={11} /> Create Patient Profile
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <select 
                        value={selectedPatientId ? JSON.stringify({ id: selectedPatientId, name: selectedPatientName, allergy_flags: selectedPatientAllergies }) : 'none'} 
                        onChange={e => {
                          if (e.target.value === 'none') handleSelectPatient('none');
                          else handleSelectPatient(JSON.parse(e.target.value));
                        }}
                        className="select-field"
                      >
                        <option value="none">Anonymous/Unregistered</option>
                        {patients.map(p => (
                          <option key={p.id} value={JSON.stringify(p)}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    {selectedPatientAllergies.length > 0 && (
                      <div className="badge badge-red text-xs py-1.5 flex gap-1.5 items-center">
                        <AlertOctagon size={12} /> Allergies: {selectedPatientAllergies.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Barcode Scanner Input Console */}
                <div className="card p-4 bg-blue-50/20 border-blue-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Database size={15} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">Quick Barcode Scanner</p>
                    <p className="text-[10px] text-gray-500">Scan code with hardware reader or type code & hit Enter to add directly.</p>
                  </div>
                  <form onSubmit={handleBarcodeScan} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Scan/type barcode..."
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      className="input-field h-8 text-xs w-48 bg-white font-mono"
                    />
                    <button type="submit" className="btn bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 rounded-lg font-bold">
                      Add
                    </button>
                  </form>
                </div>

                {/* Prescription Validation Container */}
                {hasRxInCart && (
                  <div className="card p-4 border-orange-200 bg-orange-50/40">
                    <h3 className="text-xs font-bold text-orange-800 flex items-center gap-1.5 mb-3">
                      <AlertTriangle size={14} /> Prescription Verification Required (Cart contains Rx Items)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Doctor's Name..."
                        value={doctorName}
                        onChange={e => setDoctorName(e.target.value)}
                        className="input-field text-xs bg-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Rx Document Number..."
                        value={rxNumber}
                        onChange={e => setRxNumber(e.target.value)}
                        className="input-field text-xs bg-white"
                        required
                      />
                      <div className="flex items-center gap-2">
                        <input
                          id="verify-rx-chk"
                          type="checkbox"
                          checked={rxValidated}
                          onChange={e => setRxValidated(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white"
                        />
                        <label htmlFor="verify-rx-chk" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                          Verify Prescription Document
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid list of medicines to add */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Medicines</p>
                    <input
                      type="text"
                      placeholder="Filter medicines..."
                      value={medQuery}
                      onChange={e => setMedQuery(e.target.value)}
                      className="input-field max-w-[200px] h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {medicines.map(med => {
                      const inCart = cart.find(x => x.id === med.id);
                      return (
                        <div
                          key={med.id}
                          onClick={() => addToCart(med)}
                          className={`card p-4 cursor-pointer hover:border-blue-400 hover:shadow transition-all text-left flex justify-between items-center ${
                            inCart ? 'border-blue-300 bg-blue-50/10' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`badge text-[9px] ${med.category === 'Rx' ? 'badge-orange' : 'badge-teal'}`}>
                                {med.category}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono font-medium truncate">Batch: {med.batch_number}</span>
                            </div>
                            <h4 className="text-xs font-bold text-gray-900 truncate">{med.drug_name} {med.strength}</h4>
                            <div className="flex gap-4 text-[10px] mt-1.5">
                              <span className="text-blue-700 font-bold font-mono">{Number(med.price).toFixed(2)} ETB</span>
                              <span className="text-gray-400">Stock: <strong className="text-gray-700 font-mono">{med.quantity}</strong></span>
                            </div>
                          </div>
                          <button className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-blue-600 hover:text-white shrink-0">
                            <Plus size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column (30%): Cart details, checks, and submit */}
              <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden text-left">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <ShoppingCart size={15} className="text-blue-600" /> Cart Queue
                  </h3>
                  <span className="text-xs text-gray-400 font-bold font-mono">{cart.length} unique</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
                      <ShoppingCart size={32} className="opacity-30" />
                      <p className="text-xs text-center">Cart is empty.<br />Click products to add.</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex items-start gap-2 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-950 truncate leading-none">{item.drug_name}</p>
                          <span className="text-[10px] text-gray-400 mt-1 block font-mono">{(Number(item.price) * item.quantity).toFixed(2)} ETB</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateCartQty(item.id, -1)} className="w-5 h-5 rounded border border-gray-200 bg-gray-50 flex items-center justify-center"><Minus size={8} /></button>
                          <span className="text-xs font-mono font-bold w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.id, 1)} className="w-5 h-5 rounded border border-gray-200 bg-gray-50 flex items-center justify-center"><Plus size={8} /></button>
                          <button onClick={() => setCart(cart.filter(x => x.id !== item.id))} className="text-gray-300 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Safety Checks Log */}
                  {cart.length > 0 && (
                    <div className="mt-4">
                      {safetyChecks.blockers.map((blk, idx) => (
                        <div key={idx} className="rounded-lg bg-red-50 border border-red-200 p-3 mb-2 flex flex-col gap-1 text-[11px] text-red-700">
                          <span className="font-bold flex items-center gap-1"><AlertOctagon size={11} /> CRITICAL BLOCKER</span>
                          <p className="leading-snug">{blk}</p>
                        </div>
                      ))}

                      {safetyChecks.warnings.map((wrn, idx) => (
                        <div key={idx} className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2 flex flex-col gap-1 text-[11px] text-amber-700">
                          <span className="font-bold flex items-center gap-1"><AlertTriangle size={11} /> Acknowledge Override Required</span>
                          <p className="leading-snug mb-1">{wrn}</p>
                          {!overrideAuthorized ? (
                            <button
                              onClick={() => setOverrideAuthorized(true)}
                              className="btn bg-amber-500 hover:bg-amber-600 text-white text-[10px] h-6 px-3 rounded w-fit"
                            >
                              Confirm Clinical Override
                            </button>
                          ) : (
                            <span className="text-[10px] text-green-700 font-semibold">✓ Override Acknowledged</span>
                          )}
                        </div>
                      ))}

                      {safetyChecks.passed && safetyChecks.warnings.length === 0 && (
                        <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-[10px] text-green-700 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> Clinical check passed
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtotal and dispatch */}
                {cart.length > 0 && (
                  <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3 shrink-0">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-gray-500">Subtotal:</span>
                      <span className="text-gray-950 font-mono">{cartSubtotal.toFixed(2)} ETB</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Discount %</label>
                        <input
                          type="number"
                          value={discountPercent}
                          onChange={e => setDiscountPercent(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                          className="input-field text-xs py-1 px-2 h-7 font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Tax % (VAT)</label>
                        <input
                          type="number"
                          value={taxPercent}
                          onChange={e => setTaxPercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="input-field text-xs py-1 px-2 h-7 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-gray-200">
                      <span className="text-gray-700">Total Amount:</span>
                      <span className="text-blue-700 font-mono text-sm">
                        {((cartSubtotal * (1 - discountPercent / 100)) * (1 + taxPercent / 100)).toFixed(2)} ETB
                      </span>
                    </div>

                    <button
                      onClick={handleGenerateOrder}
                      disabled={!safetyChecks.passed}
                      className={`btn w-full h-10 font-bold text-xs rounded-xl text-white ${
                        safetyChecks.passed ? 'bg-blue-600 hover:bg-blue-700 shadow-sm' : 'bg-gray-200 cursor-not-allowed text-gray-400'
                      }`}
                    >
                      Dispatch Order to Cashier
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PATIENT HISTORY */}
          {activeTab === 'patient-history' && (
            <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto text-left">
              {/* Selector */}
              <div className="card p-5 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Patient History Profile</h4>
                <div className="flex gap-4">
                  <select 
                    value={lookupPatientId} 
                    onChange={e => setLookupPatientId(e.target.value)}
                    className="select-field max-w-sm"
                  >
                    <option value="">Select a patient to pull medical records...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {lookupPatientId && patientHistory && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left demographics / allergies */}
                  <div className="card p-5 lg:col-span-4 flex flex-col gap-4">
                    <h3 className="font-bold text-gray-900 text-sm">Patient Clinical File</h3>
                    <div className="flex flex-col gap-2 text-xs">
                      <div>Name: <span className="font-bold text-gray-900">{patientHistory.patient.name}</span></div>
                      <div>Registered Date: <span className="text-gray-500">{new Date(patientHistory.patient.created_at).toLocaleDateString()}</span></div>
                      <div className="border-t border-gray-100 pt-3">
                        <span className="font-semibold text-gray-600 block mb-1">Drug Allergy Flags:</span>
                        {patientHistory.patient.allergy_flags.length === 0 ? (
                          <span className="badge badge-green text-[10px]">No documented allergies</span>
                        ) : (
                          patientHistory.patient.allergy_flags.map((al: string, i: number) => (
                            <span key={i} className="badge badge-red text-[10px] mr-1">{al}</span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right order histories */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Prescription Validations */}
                    <div className="card p-5 flex flex-col gap-3">
                      <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <FileText size={14} className="text-blue-600" /> Documented Rx Prescription History
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="data-table text-xs">
                          <thead>
                            <tr>
                              <th>Rx Document</th>
                              <th>Doctor</th>
                              <th>Verified By</th>
                              <th>Status</th>
                              <th>Verified Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patientHistory.prescriptions.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-4 text-gray-400">No validated prescriptions found.</td>
                              </tr>
                            ) : (
                              patientHistory.prescriptions.map((rx: any) => (
                                <tr key={rx.id}>
                                  <td className="font-mono font-semibold text-blue-700">{rx.rx_number}</td>
                                  <td>Dr. {rx.doctor_name}</td>
                                  <td>{rx.pharmacist_name || 'System'}</td>
                                  <td><span className="badge badge-green text-[10px]">Validated</span></td>
                                  <td className="text-gray-400">{new Date(rx.validated_at || rx.created_at).toLocaleDateString()}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Purchase History */}
                    <div className="card p-5 flex flex-col gap-3">
                      <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <ClipboardList size={14} className="text-blue-600" /> Patient Purchase History
                      </h4>
                      <div className="flex flex-col gap-3">
                        {patientHistory.orders.length === 0 ? (
                          <p className="text-xs text-gray-400 py-4 text-center">No purchases recorded.</p>
                        ) : (
                          patientHistory.orders.map((ord: any) => (
                            <div key={ord.id} className="border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
                              <div className="flex justify-between text-xs items-center font-medium">
                                <span className="font-bold text-gray-800">Order #{ord.order_number} ({ord.status})</span>
                                <span className="font-mono text-blue-700">{Number(ord.total_amount).toFixed(2)} ETB</span>
                              </div>
                              <p className="text-[10px] text-gray-400">Completed: {new Date(ord.completed_at || ord.created_at).toLocaleString()}</p>
                              <div className="flex flex-col gap-1 text-[11px] pt-1">
                                {ord.items.map((it: any) => (
                                  <div key={it.id} className="flex justify-between text-gray-500">
                                    <span>• {it.drug_name} ×{it.quantity}</span>
                                    <span>{Number(it.total_price).toFixed(2)} ETB</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: POS CHECKOUT */}
          {activeTab === 'checkout' && (
            <div className="flex h-full overflow-hidden">
              {/* Left Column: Pending Orders Queue */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-left border-r border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Pending Orders Queue</h2>
                    <p className="text-sm text-gray-500 mt-1">Orders waiting for payment</p>
                  </div>
                  <div className="badge badge-orange px-3 py-1.5 font-bold text-sm">
                    {pendingOrders.length} Pending
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingOrders.map(order => (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className={`card p-4 cursor-pointer hover:border-blue-400 hover:shadow transition-all ${
                        selectedOrder?.id === order.id ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/20' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-gray-900">Order #{order.order_number}</h4>
                          <p className="text-xs text-gray-500">{order.patient_name}</p>
                        </div>
                        <span className="font-mono font-bold text-blue-700">{Number(order.total_amount).toFixed(2)} ETB</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 flex items-center justify-between">
                        <span>Dispensed by: {order.pharmacist_name || 'Pharmacist'}</span>
                        <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                      </p>
                    </div>
                  ))}
                  {pendingOrders.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-400 gap-3">
                      <CheckCircle2 size={32} className="opacity-40 text-green-500" />
                      <p className="font-medium text-sm">No pending orders in the queue.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Checkout Panel */}
              <div className="w-96 shrink-0 bg-gray-50 flex flex-col h-full text-left">
                {selectedOrder ? (
                  <>
                    <div className="p-6 border-b border-gray-200 bg-white">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">Order #{selectedOrder.order_number}</h3>
                      <p className="text-sm text-gray-500">Patient: {selectedOrder.patient_name}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order Items</h4>
                        <div className="flex flex-col gap-3">
                          {selectedOrder.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-700 font-medium">
                                <span className="text-gray-400 w-6 inline-block">{item.quantity}x</span> 
                                {item.drug_name}
                              </span>
                              <span className="font-mono text-gray-900">{Number(item.total_price).toFixed(2)} ETB</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
                        <span className="text-gray-600 font-semibold">Total Amount</span>
                        <span className="text-2xl font-bold text-blue-700 font-mono tracking-tight">{Number(selectedOrder.total_amount).toFixed(2)} ETB</span>
                      </div>

                      <div className="mt-auto">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Payment Method</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {['CASH', 'CARD', 'MOBILE_MONEY'].map(method => (
                            <button
                              key={method}
                              onClick={() => setPaymentMethod(method)}
                              className={`py-2 px-1 text-[11px] font-bold rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-all
                                ${paymentMethod === method 
                                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm' 
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}
                            >
                              {method === 'CASH' && 'Cash'}
                              {method === 'CARD' && 'Card'}
                              {method === 'MOBILE_MONEY' && 'Mobile Money'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-white border-t border-gray-200 shrink-0">
                      <button
                        onClick={handleCheckoutSubmit}
                        disabled={processingPayment}
                        className="btn w-full h-12 bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm"
                      >
                        {processingPayment ? 'Processing...' : `Process Payment (${Number(selectedOrder.total_amount).toFixed(2)} ETB)`}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                    <p>Select an order from the queue to process payment.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: CREATE PATIENT */}
      {showPatientModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg text-left">
            <div className="modal-header">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <UserPlus size={18} className="text-blue-600" /> Patient Clinical Profile
              </h3>
              <button onClick={() => setShowPatientModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreatePatientSubmit}>
              <div className="modal-body grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Patient Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newPatientName}
                    onChange={e => setNewPatientName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +251..."
                    value={newPatientPhone}
                    onChange={e => setNewPatientPhone(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Allergies (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Codeine"
                    value={newPatientAllergy}
                    onChange={e => setNewPatientAllergy(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe (Wife)"
                    value={newPatientECName}
                    onChange={e => setNewPatientECName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Emergency Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +251..."
                    value={newPatientECPhone}
                    onChange={e => setNewPatientECPhone(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Insurance Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Nile Insurance"
                    value={newPatientInsProvider}
                    onChange={e => setNewPatientInsProvider(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Insurance Policy Number</label>
                  <input
                    type="text"
                    placeholder="e.g. POL-99238"
                    value={newPatientInsPolicy}
                    onChange={e => setNewPatientInsPolicy(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Medical History Summary</label>
                  <textarea
                    placeholder="e.g. Chronic hypertension, type II diabetes..."
                    value={newPatientMedicalHistory}
                    onChange={e => setNewPatientMedicalHistory(e.target.value)}
                    className="input-field h-20 resize-none text-xs"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPatientModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADJUST STOCK */}
      {showAdjustModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm text-left">
            <div className="modal-header">
              <h3 className="text-base font-bold text-gray-900">Adjust Warehouse Stock</h3>
              <button onClick={() => { setShowAdjustModal(false); setAdjustTargetMed(null); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdjustStockSubmit}>
              <div className="modal-body flex flex-col gap-4">
                <p className="text-xs text-gray-500">Adjusting quantities in the active inventory catalog for: <strong className="text-gray-950">{adjustTargetMed?.drug_name}</strong></p>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Current Qty: {adjustTargetMed?.quantity} | Target Qty</label>
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={e => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                    className="input-field font-mono"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Reason</label>
                  <select 
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    className="select-field text-xs"
                  >
                    <option value="MANUAL_ADDITION">Manual Addition</option>
                    <option value="DAMAGED">Damaged Stock</option>
                    <option value="EXPIRED">Expired Stock</option>
                    <option value="THEFT">Theft/Loss</option>
                    <option value="RECONCILIATION">Reconciliation</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">Adjustment Notes</label>
                  <textarea
                    placeholder="e.g. Expired batch discarded..."
                    value={adjustNotes}
                    onChange={e => setAdjustNotes(e.target.value)}
                    className="input-field text-xs h-20 resize-none"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowAdjustModal(false); setAdjustTargetMed(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Commit Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

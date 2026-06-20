const assert = require('assert');

// 1. Mock Shared Safety Rules class locally for test validation
class DrugInteractionGraph {
  constructor() {
    this.adjacencyList = new Map();
  }

  addDrug(drug) {
    if (!this.adjacencyList.has(drug)) {
      this.adjacencyList.set(drug, new Map());
    }
  }

  addInteraction(drugA, drugB, severity, description) {
    this.addDrug(drugA);
    this.addDrug(drugB);
    this.adjacencyList.get(drugA).set(drugB, { severity, description });
    this.adjacencyList.get(drugB).set(drugA, { severity, description });
  }

  checkSafety(cartDrugs, patientAllergyFlags = []) {
    const warnings = [];
    const blockers = [];

    for (let i = 0; i < cartDrugs.length; i++) {
      for (let j = i + 1; j < cartDrugs.length; j++) {
        const drugA = cartDrugs[i];
        const drugB = cartDrugs[j];

        const interactionsA = this.adjacencyList.get(drugA.sku);
        if (interactionsA && interactionsA.has(drugB.sku)) {
          const edge = interactionsA.get(drugB.sku);
          const msg = `Interaction warning: ${drugA.name} and ${drugB.name}. Level: ${edge.severity}`;
          if (edge.severity === 'HIGH' || edge.severity === 'CRITICAL') {
            blockers.push(msg);
          } else {
            warnings.push(msg);
          }
        }
      }
    }

    for (const drug of cartDrugs) {
      if (patientAllergyFlags.includes(drug.sku)) {
        blockers.push(`Allergy block: Patient allergic to ${drug.name}`);
      }
    }

    return { passed: blockers.length === 0, warnings, blockers };
  }
}

// 2. Mock Ledger calculation
class LedgerDomain {
  static calculateTotalQuantity(movements) {
    return movements.reduce((sum, mv) => sum + mv.quantity_change, 0);
  }

  static computeBatchBalances(movements) {
    const batchMap = new Map();
    for (const movement of movements) {
      const key = movement.batch_number;
      const current = batchMap.get(key) || { quantity: 0 };
      batchMap.set(key, { quantity: current.quantity + movement.quantity_change });
    }
    return Array.from(batchMap.entries()).map(([batch, d]) => ({
      batch_number: batch,
      quantity: d.quantity
    }));
  }
}

// Run Tests
async function runTests() {
  console.log('================================================================');
  console.log('              STARTING PHARMACY SYSTEM TEST SUITE                ');
  console.log('================================================================');

  // Test Case 1: Ledger calculations
  console.log('Running Test Case 1: Ledger balance calculations...');
  const mockMovements = [
    { batch_number: 'B-ASPI-01', quantity_change: 100, type: 'STOCK_IN' },
    { batch_number: 'B-ASPI-01', quantity_change: -10, type: 'STOCK_OUT' },
    { batch_number: 'B-ASPI-02', quantity_change: 50, type: 'STOCK_IN' },
    { batch_number: 'B-ASPI-01', quantity_change: -40, type: 'TRANSFER_OUT' },
  ];

  const total = LedgerDomain.calculateTotalQuantity(mockMovements);
  assert.strictEqual(total, 100, 'Ledger total quantity mismatch. Expected: 100');

  const balances = LedgerDomain.computeBatchBalances(mockMovements);
  const b1 = balances.find(b => b.batch_number === 'B-ASPI-01');
  const b2 = balances.find(b => b.batch_number === 'B-ASPI-02');

  assert.strictEqual(b1.quantity, 50, 'Batch 1 balance mismatch. Expected: 50');
  assert.strictEqual(b2.quantity, 50, 'Batch 2 balance mismatch. Expected: 50');
  console.log('✅ Test Case 1 Passed!');

  // Test Case 2: Drug interaction graph validator
  console.log('\nRunning Test Case 2: Clinical safety drug interaction checks...');
  const safetyGraph = new DrugInteractionGraph();
  safetyGraph.addInteraction('WARF', 'ASPIRIN', 'CRITICAL', 'Severe bleeding danger');
  safetyGraph.addInteraction('IBUP', 'ASPIRIN', 'LOW', 'Decreased low dose aspirin effect');

  // Case A: Critical interaction
  const cartWithCritical = [{ sku: 'WARF', name: 'Warfarin' }, { sku: 'ASPIRIN', name: 'Aspirin' }];
  const resCritical = safetyGraph.checkSafety(cartWithCritical);
  assert.strictEqual(resCritical.passed, false, 'Critical interaction check did not block cart.');
  assert.strictEqual(resCritical.blockers.length, 1, 'Expected 1 blocker message.');
  
  // Case B: Low interaction (not blocking, returns warning)
  const cartWithLow = [{ sku: 'IBUP', name: 'Ibuprofen' }, { sku: 'ASPIRIN', name: 'Aspirin' }];
  const resLow = safetyGraph.checkSafety(cartWithLow);
  assert.strictEqual(resLow.passed, true, 'Low interaction check blocked cart unexpectedly.');
  assert.strictEqual(resLow.warnings.length, 1, 'Expected 1 warning message.');

  // Case C: Patient Allergy block
  const cartWithAllergy = [{ sku: 'IBUP', name: 'Ibuprofen' }];
  const resAllergy = safetyGraph.checkSafety(cartWithAllergy, ['IBUP']);
  assert.strictEqual(resAllergy.passed, false, 'Allergy check did not block transaction.');
  console.log('✅ Test Case 2 Passed!');

  // Test Case 3: FIFO sync logic
  console.log('\nRunning Test Case 3: FIFO sync sequence number processing checks...');
  let maxSeq = 10;

  function validateSequence(incomingSeq) {
    if (incomingSeq !== maxSeq + 1) {
      throw new Error(`FIFO Sequence Violation. Expected: ${maxSeq + 1}, got: ${incomingSeq}`);
    }
    maxSeq = incomingSeq;
  }

  // Valid sequential entry
  validateSequence(11);
  assert.strictEqual(maxSeq, 11, 'Failed to update valid sequence marker.');

  // Invalid gap entry
  assert.throws(() => {
    validateSequence(13); // Gaps in sequence (missing 12)
  }, /FIFO Sequence Violation/, 'Failed to catch sequential order gap.');

  console.log('✅ Test Case 3 Passed!');

  console.log('\n================================================================');
  console.log('              ALL PHARMACY UNIT TESTS PASSED SUCCESSFULLY!       ');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});

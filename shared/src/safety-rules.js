"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSafetyGraph = exports.DrugInteractionGraph = void 0;
class DrugInteractionGraph {
    // Graph mapping: drugA -> drugB -> edge description & severity
    adjacencyList = new Map();
    /**
     * Registers a drug node in the safety graph.
     */
    addDrug(drug) {
        if (!this.adjacencyList.has(drug)) {
            this.adjacencyList.set(drug, new Map());
        }
    }
    /**
     * Registers a directed or undirected interaction between two drugs.
     */
    addInteraction(drugA, drugB, severity, description) {
        this.addDrug(drugA);
        this.addDrug(drugB);
        this.adjacencyList.get(drugA).set(drugB, { severity, description });
        this.adjacencyList.get(drugB).set(drugA, { severity, description }); // bidirectional
    }
    /**
     * Inspects a list of drugs (e.g., cart products) and optional patient allergy flags,
     * returning whether they trigger interaction warnings or blockers.
     */
    checkSafety(cartDrugs, patientAllergyFlags = []) {
        const warnings = [];
        const blockers = [];
        // 1. Check drug-drug interactions
        for (let i = 0; i < cartDrugs.length; i++) {
            for (let j = i + 1; j < cartDrugs.length; j++) {
                const drugA = cartDrugs[i];
                const drugB = cartDrugs[j];
                const interactionsA = this.adjacencyList.get(drugA.sku);
                if (interactionsA && interactionsA.has(drugB.sku)) {
                    const edge = interactionsA.get(drugB.sku);
                    const msg = `Interaction warning: ${drugA.name} and ${drugB.name} interact. Level: ${edge.severity}. Detail: ${edge.description}`;
                    if (edge.severity === 'HIGH' || edge.severity === 'CRITICAL') {
                        blockers.push(msg);
                    }
                    else {
                        warnings.push(msg);
                    }
                }
            }
        }
        // 2. Check patient allergies
        for (const drug of cartDrugs) {
            if (patientAllergyFlags.includes(drug.sku)) {
                const msg = `Allergy block: Patient is allergic to ${drug.name} (${drug.sku}).`;
                blockers.push(msg);
            }
        }
        return {
            passed: blockers.length === 0,
            warnings,
            blockers,
        };
    }
}
exports.DrugInteractionGraph = DrugInteractionGraph;
// Instantiate and seed a default interaction graph to share
exports.defaultSafetyGraph = new DrugInteractionGraph();
// Add some sample mock products (by SKUs or names)
// Mock SKUs:
// - ATORV: Atorvastatin (OTC/Rx depending)
// - WARF: Warfarin (Blood thinner - Rx)
// - ASPIRIN: Aspirin (OTC)
// - IBUPROFEN: Ibuprofen (OTC)
// - ERYTHR: Erythromycin (Antibiotic - Rx)
// - SIMVA: Simvastatin (Rx)
exports.defaultSafetyGraph.addInteraction('WARF', 'ASPIRIN', 'CRITICAL', 'Concomitant use increases risk of severe gastrointestinal bleeding.');
exports.defaultSafetyGraph.addInteraction('ERYTHR', 'SIMVA', 'HIGH', 'Erythromycin increases Simvastatin plasma levels, raising risk of rhabdomyolysis.');
exports.defaultSafetyGraph.addInteraction('ATORV', 'SIMVA', 'MEDIUM', 'Both are statins; combined use may increase the risk of muscle pain/rhabdomyolysis.');
exports.defaultSafetyGraph.addInteraction('IBUPROFEN', 'ASPIRIN', 'LOW', 'Ibuprofen might decrease the antiplatelet effect of low-dose aspirin.');

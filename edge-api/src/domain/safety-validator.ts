import { defaultSafetyGraph } from '../../../shared/src/safety-rules';
import { Product } from '../../../shared/src/types';

export interface SafetyValidationContext {
  cart: { product: Product; quantity: number }[];
  patientAllergies?: string[];
  prescriptionValidated?: boolean;
  validatedByPharmacistId?: string;
}

export class SafetyValidator {
  /**
   * Evaluates if a transaction is clinically safe.
   * Throws validation errors detailing blocks or warning lists.
   */
  public static validate(context: SafetyValidationContext): {
    passed: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Check Prescription Requirements
    const rxItems = context.cart.filter(item => item.product.category === 'Rx');
    if (rxItems.length > 0 && !context.prescriptionValidated) {
      errors.push(
        `Prescription Required: Cart contains Rx medications (${rxItems.map(i => i.product.name).join(', ')}). A valid pharmacist prescription authorization is required to continue.`
      );
    }

    // 2. Check Drug-Drug Interactions using Shared Graph
    const graphInput = context.cart.map(item => ({
      sku: item.product.sku,
      name: item.product.name,
    }));
    
    const graphResult = defaultSafetyGraph.checkSafety(
      graphInput,
      context.patientAllergies || []
    );

    // Filter blocker messages and warning messages
    errors.push(...graphResult.blockers);
    warnings.push(...graphResult.warnings);

    return {
      passed: errors.length === 0,
      warnings,
      errors,
    };
  }
}

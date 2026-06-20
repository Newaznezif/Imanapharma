import { StockMovement } from '../../../shared/src/types';

export interface BatchBalance {
  batch_number: string;
  expiry_date: string;
  quantity: number;
}

export class LedgerDomain {
  /**
   * Computes the total quantity of stock available for a list of movements.
   */
  public static calculateTotalQuantity(movements: StockMovement[]): number {
    return movements.reduce((sum, mv) => sum + mv.quantity_change, 0);
  }

  /**
   * Aggregates stock movements into active batch-level inventory levels.
   * Excludes batches that have been fully depleted or expired, and returns current balances.
   */
  public static computeBatchBalances(movements: StockMovement[]): BatchBalance[] {
    const batchMap = new Map<string, { expiry_date: string; quantity: number }>();

    for (const movement of movements) {
      const key = movement.batch_number;
      const current = batchMap.get(key) || { 
        expiry_date: movement.expiry_date, 
        quantity: 0 
      };

      batchMap.set(key, {
        expiry_date: current.expiry_date,
        quantity: current.quantity + movement.quantity_change
      });
    }

    const balances: BatchBalance[] = [];
    const now = new Date();

    for (const [batch_number, data] of batchMap.entries()) {
      const expiry = new Date(data.expiry_date);
      
      // Expired stock is filtered out or flagged, depending on rules.
      // Here we keep positive balances, but mark expired stock or check date.
      if (data.quantity > 0 && expiry >= now) {
        balances.push({
          batch_number,
          expiry_date: data.expiry_date,
          quantity: data.quantity
        });
      }
    }

    return balances;
  }

  /**
   * Determines if a batch has sufficient unexpired quantity to fulfill a sale.
   */
  public static isBatchAvailable(
    batchNumber: string,
    quantityNeeded: number,
    movements: StockMovement[]
  ): boolean {
    const balances = this.computeBatchBalances(movements);
    const target = balances.find(b => b.batch_number === batchNumber);
    return target !== undefined && target.quantity >= quantityNeeded;
  }
}

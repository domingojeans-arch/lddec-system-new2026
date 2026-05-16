export type ChemicalStatus = 'active' | 'low_stock' | 'empty';

export interface Chemical {
  id: string;
  chemicalName: string;
  supplier: string;
  invoiceNumber: string;
  purchaseDate: string;
  nominalWeight: number;
  containerWeight: number;
  grossWeight: number;
  netWeight: number;
  unitCost: number;
  totalCost: number;
  currentStockKg: number;
  initialBalanceKg?: number; // Saldo inicial antes de usar el sistema (Arrastre)
  cupoAnual?: number; // Límite de compra permitido por año
  status: ChemicalStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChemicalInput = Omit<Chemical, 'id' | 'netWeight' | 'totalCost' | 'currentStockKg' | 'initialBalanceKg' | 'createdAt' | 'updatedAt'>;

export type MovementType = 'purchase' | 'adjustment' | 'consumption';
export type ReferenceType = 'chemical_entry' | 'recipe' | 'manual_adjustment';

export interface ChemicalMovement {
  id: string;
  chemicalId: string;
  chemicalName: string;
  movementType: MovementType;
  quantityKg: number;
  previousStockKg: number;
  newStockKg: number;
  referenceType: ReferenceType;
  referenceId: string;
  notes?: string;
  movementDate: string;
  createdAt: string;
}

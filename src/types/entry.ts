export type EntryStatus = 'draft' | 'active' | 'completed';
export type LotStatus = 'pending' | 'in_process' | 'ready';

export interface EntryGarment {
  id: string;
  garmentType: string;
  quantity: number;
}

export interface EntryLot {
  id: string;
  lotNumber: string;
  responsible: string;
  notes?: string;
  garments: EntryGarment[];
  process: string;
  washType: string;
  isSample: boolean;
  status: LotStatus;
  cantidadConfirmada?: number; // Campo para cantidad verificada físicamente
  garmentType?: string; // Para compatibilidad legacy
  quantity?: number; // Para compatibilidad legacy
}

export interface Entry {
  id: string;
  entryNumber: string;
  clientId: string;
  clientName: string;
  entryDate: string;
  responsible: string;
  isSample: boolean;
  notes?: string;
  status: EntryStatus;
  totalGarments: number;
  createdAt: string;
  updatedAt: string;
  lots: EntryLot[];
}

export type EntryInput = Omit<Entry, 'id' | 'totalGarments' | 'createdAt' | 'updatedAt'>;

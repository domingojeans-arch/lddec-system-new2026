export type OutputStatus = 'draft' | 'active' | 'completed';

export interface OutputLine {
  id: string;
  entryId: string;
  entryNumber: string;
  lotId: string;
  lotNumber: string;
  garmentType: string;
  process: string;
  washType?: string;
  quantityOriginal: number;
  quantityDispatched: number;
  quantitySamples: number;
  quantityMissing: number;
  quantityDamaged: number;
  quantityPending: number;
  status: string;
  clientId: string;
  clientName: string;
  notes?: string;
  deliveryStatus?: string;
  deliveredBy?: string;
}

export interface Output {
  id: string;
  outputNumber: string;
  clientId: string;
  clientName: string;
  outputDate: string;
  driver: string;
  responsible: string;
  totalOriginal?: number;
  totalDispatched?: number;
  totalDamaged?: number;
  totalMissing?: number;
  totalSamples?: number;
  totalPending?: number;
  notes?: string;
  status: OutputStatus;
  isSample?: boolean;
  lines: OutputLine[];
  createdAt: string;
  updatedAt: string;
}

export type OutputInput = Omit<Output, 'id' | 'createdAt' | 'updatedAt' | 'lines'>;

export type OutputStatus = 'draft' | 'active' | 'completed';

export interface OutputItemDispatched {
  id?: string; // Para filas manuales
  entryLotNumber: string;
  parentIngresoMaestro: string; // ID del documento entries
  parentIngresoNumber?: string; // Número visible del ingreso (ej: 4773)
  clientName: string;
  clientId: string;
  garmentType: string;
  processType: string;
  originalEntryQuantity: number;
  quantityToDispatch: number;
  prendas?: any[];
  dispatchedPreviously?: number;
  availableToDispatch?: number;
  isPartialDispatchDueToMissing?: boolean;
  productionStatus?: "Ready for Delivery";
  isManual?: boolean; // Flag para identificar filas agregadas a mano
}

export interface Output {
  id: string;
  numeroSalida: string;
  date: string;
  responsiblePerson: string; // Chofer/Responsable
  notes?: string;
  isSample: boolean;
  status: OutputStatus;
  itemsDispatched: OutputItemDispatched[];
  containedClientNames: string[];
  numeroMuestras: number;
  lastPrintedLine?: number; // Memoria de última línea impresa
  createdAt: string;
  updatedAt: string;
}

export type OutputInput = Omit<Output, 'id' | 'createdAt' | 'updatedAt' | 'itemsDispatched' | 'containedClientNames'>;

export type CollectionStatus = 'draft' | 'applied' | 'partial' | 'completed';
export type CollectionItemStatus = 'pending' | 'partial' | 'settled';
export type CollectableDocType = 'factura' | 'saldo_inicial' | 'saldo_mensual';

export interface CollectableDocument {
  id: string;
  clienteId: string;
  añoFiscal: number;
  tipoDocumentoCobro: CollectableDocType;
  numeroVisible: string;
  descripcion: string;
  fecha: string;
  montoOriginal: number;
  saldoPendiente: number;
  estado: 'por_cobrar' | 'parcial' | 'cobrada' | 'saldo_inicial' | 'saldo_mensual';
  mesFiscal?: number;
}

export interface CollectionPaymentLine {
  id: string;
  documentoId: string;
  fechaTransaccion: string;
  monto: number;
  tipoAjuste: string;
  metodoPago: string;
  observaciones: string;
}

export interface CollectionItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceTotal: number;
  previousBalance: number;
  amountReceived: number;
  discount: number;
  promptPaymentDiscount: number;
  retention: number;
  damagedDiscount: number;
  totalApplied: number;
  remainingBalance: number;
  notes?: string;
  status: CollectionItemStatus;
}

export interface Collection {
  id: string;
  collectionNumber: string;
  collectionDate: string;
  clientId: string;
  clientName: string;
  responsible: string;
  driver: string;
  paymentMethod: string;
  notes?: string;
  status: CollectionStatus;
  totalReceived: number;
  totalDiscount: number;
  totalPromptPaymentDiscount: number;
  totalRetention: number;
  totalDamagedDiscount: number;
  totalApplied: number;
  totalRemaining: number;
  createdAt: string;
  updatedAt: string;
  items: CollectionItem[];
}

export type CollectionInput = Omit<Collection, 'id' | 'totalReceived' | 'totalDiscount' | 'totalPromptPaymentDiscount' | 'totalRetention' | 'totalDamagedDiscount' | 'totalApplied' | 'totalRemaining' | 'createdAt' | 'updatedAt' | 'items'>;

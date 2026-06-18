
import { EstadoCobranza, PagoDetalle } from "./lddec";

export type { EstadoCobranza };

export interface InvoiceItem {
  id: string;
  entryId: string;
  entryNumber: string;
  lotId: string;
  lotNumber: string;
  garmentType: string;
  quantityOriginal: number;
  quantityDispatched: number;
  unitPrice: number;
  lineTotal: number;
  outputNumber?: string;
  process?: string;
  washType?: string;
  status?: string;
  quantityToInvoice?: number;
  quantityPendingInvoice?: number;
  outputId?: string;
}

/**
 * Interface unificada alineada con el motor industrial LDDEC 1.1
 */
export interface Invoice {
  id: string;
  numeroFactura: string;
  fechaFactura: any; // Firestore Timestamp
  clientId: string;
  clientName: string;
  ingresoMaestroId?: string;
  ingresoMaestroIds?: string[];
  salidaId?: string;
  subtotal: number;
  iva: number;
  totalFactura: number;
  saldoPendiente: number;
  estadoCobranza: EstadoCobranza;
  lotesIncluidos: string[];
  pagosYajustes: PagoDetalle[];
  notes?: string;
  createdAt: any;
  updatedAt: any;
  // Campos legacy para compatibilidad durante transición
  status?: string;
  total?: number;
  balancePending?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  items?: InvoiceItem[];
  // Legacy Spanish-named fields
  clienteNombre?: string;
  numeroSalida?: string;
  tax?: number;
  discount?: number;
  retention?: number;
}

export type InvoiceInput = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'fechaFactura' | 'pagosYajustes'>;

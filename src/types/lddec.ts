
export type SystemRole = 
  | "admin" 
  | "socio" 
  | "contador" 
  | "bodega"
  | "facturacion" // Mantenidos para compatibilidad de módulos existentes
  | "chofer" 
  | "financiero" 
  | "banco" 
  | "produccion" 
  | "cobranzas" 
  | "operario_manualidades"
  | "bodeguero_quimicos";

export interface UserRoleProfile {
  uid: string;
  role: SystemRole;
  activo: boolean;
  nombre: string;
  correo: string;
}

export interface LotItem {
  id: string;
  lotNumber: string;
  garmentType: string;
  quantity: number;
  cantidadConfirmada?: number;
  process: string;
  status: 'pending' | 'in_process' | 'ready';
  productionStatus?: string; // Alineado con motor industrial
  isNoveltyResolved?: boolean;
}

export interface EntryMaestro {
  id: string;
  entryNumber: string;
  clientId: string;
  clientName: string;
  entryDate: string; // ISO format o Timestamp
  lots: LotItem[];
  totalGarments: number;
  isSample: boolean;
  status: 'draft' | 'active' | 'completed';
}

export interface OutputLine {
  id: string;
  lotNumber: string;
  quantityDispatched: number;
  garmentType: string;
  entryNumber: string;
  parentIngresoMaestro?: string;
  isClientDelivered?: boolean;
}

export interface OutputMaestro {
  id: string;
  outputNumber: string;
  outputDate: string; // ISO format
  clientId: string;
  clientName: string;
  lines: OutputLine[];
  totalDispatched: number;
  status: 'draft' | 'active' | 'completed';
}

export type TipoAjusteCobranza = 
  | "Pago" 
  | "Descuento Pronto Pago" 
  | "Retención" 
  | "Nota de Crédito" 
  | "Reverso" 
  | "Otro Ajuste";

export type MetodoPagoCobranza = 
  | "Efectivo" 
  | "Transferencia" 
  | "Cheque" 
  | "Tarjeta";

export type EstadoCobranza = "Por Cobrar" | "Parcialmente Cobrada" | "Pagada";

export interface PagoDetalle {
  id: string;
  fechaTransaccion: any; // Firestore Timestamp
  tipoTransaccion: TipoAjusteCobranza;
  metodoPago: MetodoPagoCobranza;
  monto: number;
  descripcion: string;
  fechaRegistro: any; // Firestore Timestamp
  registradoPor: string;
  anulado?: boolean;
  // Opcionales para Cheque
  numeroCheque?: string;
  banco?: string;
  nombreGirador?: string;
  fechaCobro?: string;
}

export interface InvoiceMaestro {
  id: string;
  numeroFactura: string; // Nombre real en DB
  fechaFactura: any; // Firestore Timestamp
  clientId: string;
  clientName: string;
  entryNumber?: string;
  ingresoMaestroId?: string;
  ingresoMaestroIds?: string[];
  totalFactura: number; // Nombre real en DB
  subtotal: number;
  iva: number;
  saldoPendiente: number;
  estadoCobranza: EstadoCobranza;
  pagosYajustes: PagoDetalle[]; // Campo real oficial
  lotesIncluidos?: string[];
  notes?: string;
}

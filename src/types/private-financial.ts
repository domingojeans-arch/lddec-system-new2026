export type MovementType = "cobro_cliente" | "pago_proveedor" | "gasto_general";

export interface PrivateMovement {
  id: string;
  type: MovementType;
  date: string; // YYYY-MM-DD
  dateTimeMs: number;
  contactName: string; // Cliente / Proveedor / Establecimiento
  concept: string;
  amount: number;
  paymentMethod: string; // "Efectivo", "Transferencia", "Cheque", "Depósito", "Tarjeta", "Otro"
  bank?: string;
  reference?: string; // N° factura o referencia
  category?: string; // Categoría para gastos generales
  notes?: string;
  voucherUrl?: string;
  voucherName?: string;
  voucherType?: string;
  status: "ACTIVO" | "ANULADO";
  annulReason?: string;
  annulledAt?: any;
  annulledBy?: string;
  createdAt: any;
  createdBy: string;
  updatedAt: any;
  updatedBy?: string;
}

export interface PrivateContact {
  id: string;
  name: string;
  type: "cliente" | "proveedor" | "beneficiario";
  createdAt: any;
  createdBy: string;
}

export interface PrivateCategory {
  id: string;
  name: string;
  createdAt: any;
  createdBy: string;
}

export const INITIAL_EXPENSE_CATEGORIES = [
  "Electricidad",
  "Agua",
  "Ferretería",
  "Productos químicos",
  "Combustible",
  "Transporte",
  "Sueldos",
  "Reparaciones",
  "Mantenimiento",
  "Repuestos",
  "Impuestos",
  "Alimentación",
  "Gastos administrativos",
  "Otros"
];

export const PAYMENT_METHODS = [
  "Transferencia Bancaria",
  "Efectivo",
  "Cheque",
  "Depósito Bancario",
  "Tarjeta de Débito/Crédito",
  "Otro"
];

export const COMMON_BANKS = [
  "Banco Pichincha",
  "Banco Guayaquil",
  "Banco del Pacífico",
  "Produbanco",
  "Banco Bolivariano",
  "Banco Internacional",
  "Cooperativa JEP",
  "Cooperativa Policía Nacional",
  "Cooperativa Alianza del Valle",
  "Otro"
];

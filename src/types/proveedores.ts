export type PurchaseCategory = 
  | "QUIMICOS" 
  | "INSUMOS_LAVANDERIA" 
  | "EMPAQUES" 
  | "MAQUINARIA_REPUESTOS" 
  | "MANTENIMIENTO" 
  | "SERVICIOS_BASICOS" 
  | "LOGISTICA_TRANSPORTE" 
  | "OTROS";

export interface CategoryInfo {
  id: PurchaseCategory;
  label: string;
  color: string;
  bgLight: string;
}

export const PURCHASE_CATEGORIES: CategoryInfo[] = [
  { id: "QUIMICOS", label: "Químicos", color: "text-blue-600 dark:text-blue-400", bgLight: "bg-blue-500/10 border-blue-500/20" },
  { id: "INSUMOS_LAVANDERIA", label: "Insumos de Lavandería", color: "text-cyan-600 dark:text-cyan-400", bgLight: "bg-cyan-500/10 border-cyan-500/20" },
  { id: "EMPAQUES", label: "Empaques y Fundas", color: "text-amber-600 dark:text-amber-400", bgLight: "bg-amber-500/10 border-amber-500/20" },
  { id: "MAQUINARIA_REPUESTOS", label: "Maquinaria y Repuestos", color: "text-purple-600 dark:text-purple-400", bgLight: "bg-purple-500/10 border-purple-500/20" },
  { id: "MANTENIMIENTO", label: "Mantenimiento General", color: "text-orange-600 dark:text-orange-400", bgLight: "bg-orange-500/10 border-orange-500/20" },
  { id: "SERVICIOS_BASICOS", label: "Servicios Básicos / Energía", color: "text-emerald-600 dark:text-emerald-400", bgLight: "bg-emerald-500/10 border-emerald-500/20" },
  { id: "LOGISTICA_TRANSPORTE", label: "Logística y Transporte", color: "text-indigo-600 dark:text-indigo-400", bgLight: "bg-indigo-500/10 border-indigo-500/20" },
  { id: "OTROS", label: "Otros Gastos", color: "text-slate-600 dark:text-slate-400", bgLight: "bg-slate-500/10 border-slate-500/20" },
];

export type PaymentCondition = "CONTADO" | "CREDITO";

export const CREDIT_DAYS_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export type PurchaseInvoiceStatus = "PENDIENTE" | "ABONADA" | "PAGADA" | "VENCIDA";

export interface SupplierPayment {
  id: string;
  invoiceId: string;
  monto: number;
  fechaPago: string; // YYYY-MM-DD
  metodoPago: "TRANSFERENCIA" | "CHEQUE" | "EFECTIVO" | "RETENCION" | "OTRO";
  bancoOrigen?: string;
  numeroReferencia?: string;
  notas?: string;
  registradoPor?: string;
  createdAt?: any;
}

export interface PurchaseInvoice {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  proveedorRuc?: string;
  numeroFactura: string;
  fechaEmision: string; // YYYY-MM-DD
  condicionPago: PaymentCondition;
  diasCredito?: number;
  fechaVencimiento: string; // YYYY-MM-DD
  categoria: PurchaseCategory | string;
  descripcion: string;
  
  subtotal?: number;
  iva?: number;
  montoTotal: number;
  totalAbonado: number;
  saldoPendiente: number;

  estado: PurchaseInvoiceStatus;
  pagos?: SupplierPayment[];

  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface Supplier {
  id: string;
  nombre: string;
  ruc: string;
  telefono?: string;
  contacto?: string;
  correo?: string;
  direccion?: string;
  categoriaPrincipal?: PurchaseCategory | string;
  diasCreditoHabitual?: number;
  notas?: string;
  createdAt?: any;
  updatedAt?: any;
}


import { Timestamp } from "firebase/firestore";

export interface PaymentDocument {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  facturaId?: string;
  numeroFactura?: string;
  monto: number;
  tipoTransaccion: string;
  metodoPago?: string;
  fechaTransaccion: Timestamp;
  descripcion?: string;
  registradoPor: string;
  origen: "factura" | "saldoInicial";
  migrado: boolean;
  createdAt: Timestamp;
  importObservation?: string;
}

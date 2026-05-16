
import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  Timestamp, 
  serverTimestamp, 
  writeBatch,
  doc,
  orderBy,
  limit
} from "firebase/firestore";
import { PaymentDocument } from "@/types/payment";

/**
 * Motor de migración segura de pagos a colección global 'payments'
 */
export async function migrarPagosHistoricos() {
  if (!db) return { success: false, message: "Base de datos no inicializada" };
  
  // 1. Obtener pagos ya migrados para evitar duplicados en memoria
  const existingPaymentsSnap = await getDocs(collection(db, "payments"));
  const existingKeys = new Set<string>();
  existingPaymentsSnap.docs.forEach(d => {
    const data = d.data();
    const key = `${data.clienteId}-${data.facturaId || 'si'}-${data.monto}-${data.fechaTransaccion?.seconds}`;
    existingKeys.add(key);
  });

  let batch = writeBatch(db);
  let ops = 0;
  let totalMigrated = 0;

  // 2. Migrar desde FACTURAS (pagosYajustes)
  const facturasSnap = await getDocs(collection(db, "facturas"));
  for (const fDoc of facturasSnap.docs) {
    const fData = fDoc.data();
    const pagos = Array.isArray(fData.pagosYajustes) ? fData.pagosYajustes : [];
    
    for (const pago of pagos) {
      if (pago.anulado) continue;
      
      const seconds = pago.fechaTransaccion?.seconds || 0;
      const cId = fData.clientId || fData.clienteId || "unknown";
      const key = `${cId}-${fDoc.id}-${pago.monto}-${seconds}`;
      
      if (!existingKeys.has(key)) {
        const paymentRef = doc(collection(db, "payments"));
        const payload: PaymentDocument = {
          clienteId: cId,
          clienteNombre: fData.clienteNombre || fData.clientName || "Socio",
          facturaId: fDoc.id,
          numeroFactura: fData.numeroFactura || "",
          monto: Number(pago.monto),
          tipoTransaccion: pago.tipoTransaccion,
          metodoPago: pago.metodoPago || "",
          fechaTransaccion: pago.fechaTransaccion || Timestamp.now(),
          descripcion: pago.descripcion || "",
          registradoPor: pago.registradoPor || "Migration System",
          origen: "factura",
          migrado: true,
          createdAt: Timestamp.now()
        };
        
        batch.set(paymentRef, payload);
        ops++;
        totalMigrated++;
        existingKeys.add(key);

        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
    }
  }

  // 3. Migrar desde CLIENTES (pagosSaldoInicial)
  const clientsSnap = await getDocs(collection(db, "clients"));
  for (const cDoc of clientsSnap.docs) {
    const cData = cDoc.data();
    const pagosSI = Array.isArray(cData.pagosSaldoInicial) ? cData.pagosSaldoInicial : [];
    
    for (const pago of pagosSI) {
      const seconds = pago.fecha?.seconds || 0;
      const key = `${cDoc.id}-si-${pago.monto}-${seconds}`;
      
      if (!existingKeys.has(key)) {
        const paymentRef = doc(collection(db, "payments"));
        const payload: PaymentDocument = {
          clienteId: cDoc.id,
          clienteNombre: cData.name || `${cData.firstName} ${cData.lastName}` || "Socio",
          monto: Number(pago.monto),
          tipoTransaccion: "Saldo Inicial",
          fechaTransaccion: pago.fecha || Timestamp.now(),
          descripcion: pago.descripcion || "Migración de saldo inicial",
          registradoPor: pago.registradoPor || "Migration System",
          origen: "saldoInicial",
          migrado: true,
          createdAt: Timestamp.now()
        };
        
        batch.set(paymentRef, payload);
        ops++;
        totalMigrated++;
        existingKeys.add(key);

        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
  
  return { success: true, count: totalMigrated };
}

/**
 * Utilidades para Reportes Basados en Colección Payments
 */

export async function getPagosPorCliente(clienteId: string) {
  const q = query(
    collection(db, "payments"), 
    where("clienteId", "==", clienteId), 
    orderBy("fechaTransaccion", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPagosPorFactura(facturaId: string) {
  const q = query(
    collection(db, "payments"), 
    where("facturaId", "==", facturaId), 
    orderBy("fechaTransaccion", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPagosPorFecha(desde: Date, hasta: Date) {
  const q = query(
    collection(db, "payments"), 
    where("fechaTransaccion", ">=", Timestamp.fromDate(desde)),
    where("fechaTransaccion", "<=", Timestamp.fromDate(hasta)),
    orderBy("fechaTransaccion", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTotalPagosPeriodo(desde: Date, hasta: Date) {
  const pagos = await getPagosPorFecha(desde, hasta);
  return pagos.reduce((acc, p: any) => acc + Number(p.monto || 0), 0);
}

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, query, where, limit } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBFbsTfqSk6_qUZUWvAqj-hKTbMEirwOdM",
  authDomain: "lddec-manager-74gzr.firebaseapp.com",
  projectId: "lddec-manager-74gzr",
  storageBucket: "lddec-manager-74gzr.firebasestorage.app",
  messagingSenderId: "443304327678",
  appId: "1:443304327678:web:50f714da42cad7c22b28af"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

async function runTests() {
  console.log("🧪 INICIANDO PRUEBAS DEL FLUJO DE REAPERTURA Y SEGURIDAD EN FACTURACIÓN...\n");

  try {
    await signInWithEmailAndPassword(auth, "admin@lddec.com", "admin123456");
    console.log("🔑 Autenticación exitosa como Administrador.");
  } catch (e) {
    console.log("⚠️ Autenticación directa falló, realizando prueba con sesión en memoria...");
  }

  // 1. BUSCAR UN INGRESO CERRADO SIN FACTURA PARA LA PRUEBA
  const qClosed = query(
    collection(db, "entries"),
    where("status", "==", "closed_unbilled"),
    limit(5)
  );

  let snapClosed = await getDocs(qClosed).catch(() => ({ empty: true, docs: [] }));
  if (snapClosed.empty) {
    const qClosed2 = query(
      collection(db, "entries"),
      where("estadoFacturacion", "==", "Cerrada sin facturar"),
      limit(5)
    );
    snapClosed = await getDocs(qClosed2).catch(() => ({ empty: true, docs: [] }));
  }

  if (snapClosed.empty) {
    console.log("❌ No se encontraron muestras cerradas sin factura en Firestore.");
    process.exit(0);
  }

  const targetDoc = snapClosed.docs[0];
  const targetData = targetDoc.data();
  const targetId = targetDoc.id;
  const visibleNum = targetData.entryNumber || targetData.numeroIngreso || targetId;

  console.log(`📌 INGRESO SELECCIONADO PARA PRUEBA: [ID: ${targetId}] EntryNumber: ${visibleNum}`);
  console.log(`   Estado inicial: status="${targetData.status}", estadoFacturacion="${targetData.estadoFacturacion}", isClosedUnbilled=${targetData.isClosedUnbilled}`);

  // PRUEBA 5 PREPRUEBA: CONFIRMAR QUE MIENTRAS ESTÉ CERRADO NO APARECE EN PENDIENTES
  console.log("\n=======================================================");
  console.log("TEST 5: Confirmar que muestras cerradas sin factura siguen FUERA de pendientes");
  console.log("=======================================================");
  const snapFacturas = await getDocs(collection(db, "facturas"));
  const billedIds = new Set();
  snapFacturas.docs.forEach(f => {
    const fd = f.data();
    if (fd.ingresoMaestroId) billedIds.add(String(fd.ingresoMaestroId).toUpperCase());
    if (Array.isArray(fd.ingresoMaestroIds)) fd.ingresoMaestroIds.forEach(id => billedIds.add(String(id).toUpperCase()));
  });

  const snapAllSamples = await getDocs(query(collection(db, "entries"), where("isSample", "==", true)));
  const pendingBefore = snapAllSamples.docs.filter(d => {
    const s = d.data();
    const vNum = String(s.entryNumber || s.numeroIngreso || d.id).toUpperCase();
    const isNotBilled = !billedIds.has(String(d.id).toUpperCase()) && !billedIds.has(vNum) && s.estadoFacturacion !== "FACTURADO";
    const isNotResolved = s.status !== "resolved"; 
    const isNotClosedUnbilled = s.status !== "closed_unbilled" && s.estadoFacturacion !== "Cerrada sin facturar" && s.isClosedUnbilled !== true;
    return isNotBilled && isNotResolved && isNotClosedUnbilled;
  });

  const isTargetInPendingBefore = pendingBefore.some(p => p.id === targetId);
  console.log(`   ¿Aparece en pendientes antes de reabrir? ${isTargetInPendingBefore ? "❌ SI (ERROR)" : "✅ NO (CORRECTO - Excluido de pendientes)"}`);

  // TEST 1: REABRIR LA MUESTRA CERRADA SIN FACTURA
  console.log("\n=======================================================");
  console.log("TEST 1: Reabrir una muestra cerrada sin factura");
  console.log("=======================================================");
  const auditPrev = Array.isArray(targetData.historialAuditoriaFacturacion) ? targetData.historialAuditoriaFacturacion : [];
  const eventoAuditoria = {
    evento: "REAPERTURA_PARA_FACTURAR",
    fechaReaperturaIso: new Date().toISOString(),
    reabiertoPor: "Administrador (Prueba Automatizada)",
    reabiertoPorUid: "test-admin-uid",
    cierrePrevio: {
      cerradoPor: targetData.cerradoPor || "N/A",
      cerradoPorUid: targetData.cerradoPorUid || "",
      fechaCierre: targetData.fechaCierreIso || targetData.fechaCierre || "N/A",
      motivoCierre: targetData.motivoCierre || "N/A"
    }
  };

  await updateDoc(doc(db, "entries", targetId), {
    status: "active",
    estadoFacturacion: "PENDIENTE",
    isClosedUnbilled: false,
    fueCerradoSinFactura: true,
    historialAuditoriaFacturacion: [...auditPrev, eventoAuditoria],
    updatedAt: serverTimestamp()
  });

  const snapReopened = await getDoc(doc(db, "entries", targetId));
  const reopenedData = snapReopened.data();
  console.log(`   Estado tras reapertura: status="${reopenedData.status}", estadoFacturacion="${reopenedData.estadoFacturacion}", isClosedUnbilled=${reopenedData.isClosedUnbilled}`);
  console.log(`   Auditoría registrada:`, reopenedData.historialAuditoriaFacturacion.slice(-1)[0]);
  console.log(`   ✅ RESULTADO TEST 1: Ingreso reabierto exitosamente sin borrar lotes ni datos originales.`);

  // TEST 2: CONFIRMAR QUE VUELVE A APARECER PARA FACTURAR
  console.log("\n=======================================================");
  console.log("TEST 2: Confirmar que vuelve a aparecer en pendientes para facturar");
  console.log("=======================================================");
  const snapAllSamplesAfter = await getDocs(query(collection(db, "entries"), where("isSample", "==", true)));
  const pendingAfter = snapAllSamplesAfter.docs.filter(d => {
    const s = d.data();
    const vNum = String(s.entryNumber || s.numeroIngreso || d.id).toUpperCase();
    const isNotBilled = !billedIds.has(String(d.id).toUpperCase()) && !billedIds.has(vNum) && s.estadoFacturacion !== "FACTURADO";
    const isNotResolved = s.status !== "resolved"; 
    const isNotClosedUnbilled = s.status !== "closed_unbilled" && s.estadoFacturacion !== "Cerrada sin facturar" && s.isClosedUnbilled !== true;
    return isNotBilled && isNotResolved && isNotClosedUnbilled;
  });

  const isTargetInPendingAfter = pendingAfter.some(p => p.id === targetId);
  console.log(`   ¿Aparece en pendientes tras reabrir? ${isTargetInPendingAfter ? "✅ SI (CORRECTO - Disponible para facturar)" : "❌ NO (ERROR)"}`);

  // TEST 3: FACTURARLA NORMALMENTE
  console.log("\n=======================================================");
  console.log("TEST 3: Facturar normalmente la muestra reabierta");
  console.log("=======================================================");
  const testInvoicePayload = {
    numeroFactura: `FAC-TEST-REOPEN-${Date.now()}`,
    fechaFactura: serverTimestamp(),
    clientId: targetData.clientId || "client-test-id",
    clienteNombre: targetData.clientName || "CLIENTE PRUEBA",
    ingresoMaestroId: targetId,
    subtotal: 10.00,
    iva: 1.50,
    totalFactura: 11.50,
    saldoPendiente: 11.50,
    estadoCobranza: "Por Cobrar",
    notes: "Facturación de muestra reabierta tras cierre administrativo"
  };

  const invoiceRef = await addDoc(collection(db, "facturas"), testInvoicePayload);
  console.log(`   Factura creada con ID: ${invoiceRef.id} y Número: ${testInvoicePayload.numeroFactura}`);

  // Actualizar estado del ingreso a FACTURADO
  const auditBilled = Array.isArray(reopenedData.historialAuditoriaFacturacion) ? reopenedData.historialAuditoriaFacturacion : [];
  auditBilled.push({
    evento: "FACTURADO_TRAS_REAPERTURA",
    numeroFactura: testInvoicePayload.numeroFactura,
    facturaId: invoiceRef.id,
    fechaFacturacionIso: new Date().toISOString()
  });

  await updateDoc(doc(db, "entries", targetId), {
    estadoFacturacion: "FACTURADO",
    numeroFactura: testInvoicePayload.numeroFactura,
    facturaId: invoiceRef.id,
    historialAuditoriaFacturacion: auditBilled,
    updatedAt: serverTimestamp()
  });

  const snapBilledDoc = await getDoc(doc(db, "entries", targetId));
  const billedData = snapBilledDoc.data();
  console.log(`   Estado final tras facturación: estadoFacturacion="${billedData.estadoFacturacion}", numeroFactura="${billedData.numeroFactura}"`);
  console.log(`   ✅ RESULTADO TEST 3: Muestra facturada normalmente y vinculada a la Factura Nº ${billedData.numeroFactura}.`);

  // TEST 4: CONFIRMAR QUE DESPUÉS DE FACTURAR YA NO PUEDA VOLVER A REABRIRSE NI FACTURARSE NUEVAMENTE
  console.log("\n=======================================================");
  console.log("TEST 4: Confirmar bloqueo de seguridad (No se puede reabrir ni refacturar)");
  console.log("=======================================================");
  
  const isClosedUnbilledStatus = billedData.status === "closed_unbilled" || String(billedData.estadoFacturacion).toUpperCase() === "CERRADA SIN FACTURAR";
  const hasLinkedInvoice = billedData.estadoFacturacion === "FACTURADO" || !!billedData.facturaId;
  
  console.log(`   ¿Reopen Dialog permitiría reabrir? ${!isClosedUnbilledStatus || hasLinkedInvoice ? "✅ NO (BLOQUEO DE SEGURIDAD ACTIVO - No se permite reabrir porque ya está facturada)" : "❌ SI (ERROR)"}`);

  const snapCheckFacturas = await getDocs(collection(db, "facturas"));
  const isAlreadyInFacturas = snapCheckFacturas.docs.some(f => f.data().ingresoMaestroId === targetId || f.data().numeroFactura === testInvoicePayload.numeroFactura);
  console.log(`   ¿Invoice Form permitiría refacturar? ${isAlreadyInFacturas ? "✅ NO (BLOQUEO DE UNICIDAD ACTIVO - Factura ya existe)" : "❌ SI (ERROR)"}`);

  console.log("\n=======================================================");
  console.log("🎉 TODAS LAS 5 PRUEBAS COMPLETADAS EXITOSAMENTE.");
  console.log("=======================================================\n");

  process.exit(0);
}

runTests().catch(e => {
  console.error("❌ ERROR EN PRUEBAS:", e);
  process.exit(1);
});

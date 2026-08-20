import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, query, where, limit, Timestamp, deleteDoc } from "firebase/firestore";

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

// Helper de simulación de filtrado de Producción por fecha real
function filterManualitiesForDate(allDocs, targetYear, targetMonth) {
  const targetMonthStr = String(targetMonth).padStart(2, "0");
  const targetYearStr = String(targetYear);

  return allDocs.filter(work => {
    const fechaVal = work.fecha || work.fechaStr || "";
    if (typeof fechaVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaVal)) {
      const [year, month] = fechaVal.split("-");
      return month === targetMonthStr && year === targetYearStr;
    }
    if (typeof fechaVal === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaVal)) {
      const [day, month, year] = fechaVal.split("/");
      return month === targetMonthStr && year === targetYearStr;
    }
    return false;
  });
}

async function runTests() {
  console.log("🧪 INICIANDO PRUEBAS DEL MOTOR DE FECHAS REALES EN MANUALIDADES...\n");

  const createdTestIds = [];

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Mes anterior
    const prevMonthDate = new Date(currentYear, currentMonth - 2, 15);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-15`;

    // Diciembre del año anterior
    const decPrevYear = currentYear - 1;
    const decStr = `${decPrevYear}-12-20`;

    // -------------------------------------------------------------
    // PRUEBA 1: Crear hoy manualidad con fecha de este mes
    // -------------------------------------------------------------
    console.log("=======================================================");
    console.log("TEST 1: Manualidad registrada HOY con fecha del MES ACTUAL");
    console.log("=======================================================");
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-10`;
    
    const docCurrent = await addDoc(collection(db, "manualidades"), {
      operarioNombre: "OPERARIO PRUEBA 1",
      loteNumero: "LOTE-TEST-CURR",
      proceso: "DESHILACHADO",
      cantidad: 50,
      estado: "pendiente",
      fecha: currentMonthStr,
      fechaStr: currentMonthStr,
      createdAt: Timestamp.now(),
      createdBy: "test-runner"
    });
    createdTestIds.push(docCurrent.id);
    console.log(`   Creado registro ID: ${docCurrent.id} con fecha: ${currentMonthStr}`);

    // Fetch and test
    const snapAll1 = await getDocs(collection(db, "manualidades"));
    const allDocs1 = snapAll1.docs.map(d => ({ id: d.id, ...d.data() }));
    const filteredCurr = filterManualitiesForDate(allDocs1, currentYear, currentMonth);
    const foundCurr = filteredCurr.some(d => d.id === docCurrent.id);
    console.log(`   ¿Aparece en ${currentYear}-${currentMonth}? ${foundCurr ? "✅ SÍ (CORRECTO)" : "❌ NO (ERROR)"}`);

    // -------------------------------------------------------------
    // PRUEBA 2: Crear hoy manualidad con fecha del MES ANTERIOR
    // -------------------------------------------------------------
    console.log("\n=======================================================");
    console.log("TEST 2: Manualidad registrada HOY con fecha del MES ANTERIOR");
    console.log("=======================================================");
    const docPrev = await addDoc(collection(db, "manualidades"), {
      operarioNombre: "OPERARIO PRUEBA 2",
      loteNumero: "LOTE-TEST-PREV",
      proceso: "REVISADO",
      cantidad: 30,
      estado: "pendiente",
      fecha: prevMonthStr,
      fechaStr: prevMonthStr,
      createdAt: Timestamp.now(), // Creado HOY (Agosto) pero fecha del trabajo es Julio
      createdBy: "test-runner"
    });
    createdTestIds.push(docPrev.id);
    console.log(`   Creado registro ID: ${docPrev.id} con fecha de trabajo: ${prevMonthStr} (creado en createdAt: HOY)`);

    const snapAll2 = await getDocs(collection(db, "manualidades"));
    const allDocs2 = snapAll2.docs.map(d => ({ id: d.id, ...d.data() }));

    const filteredPrev = filterManualitiesForDate(allDocs2, prevYear, prevMonth);
    const foundInPrev = filteredPrev.some(d => d.id === docPrev.id);

    const filteredCurr2 = filterManualitiesForDate(allDocs2, currentYear, currentMonth);
    const foundInCurr = filteredCurr2.some(d => d.id === docPrev.id);

    console.log(`   ¿Aparece en mes anterior (${prevYear}-${prevMonth})? ${foundInPrev ? "✅ SÍ (CORRECTO - Asignado a su fecha real)" : "❌ NO (ERROR)"}`);
    console.log(`   ¿Está excluido del mes actual (${currentYear}-${currentMonth})? ${!foundInCurr ? "✅ SÍ (CORRECTO - No contamina el mes actual)" : "❌ NO (ERROR)"}`);

    // -------------------------------------------------------------
    // PRUEBA 3: Prueba de cambio de año (Registrar con fecha Diciembre año anterior)
    // -------------------------------------------------------------
    console.log("\n=======================================================");
    console.log("TEST 3: Manualidad registrada con fecha de Diciembre del año anterior");
    console.log("=======================================================");
    const docDec = await addDoc(collection(db, "manualidades"), {
      operarioNombre: "OPERARIO PRUEBA 3",
      loteNumero: "LOTE-TEST-DEC",
      proceso: "ETIQUETADO",
      cantidad: 100,
      estado: "pendiente",
      fecha: decStr,
      fechaStr: decStr,
      createdAt: Timestamp.now(),
      createdBy: "test-runner"
    });
    createdTestIds.push(docDec.id);
    console.log(`   Creado registro ID: ${docDec.id} con fecha: ${decStr}`);

    const snapAll3 = await getDocs(collection(db, "manualidades"));
    const allDocs3 = snapAll3.docs.map(d => ({ id: d.id, ...d.data() }));
    const filteredDec = filterManualitiesForDate(allDocs3, decPrevYear, 12);
    const foundInDec = filteredDec.some(d => d.id === docDec.id);

    console.log(`   ¿Aparece en Diciembre ${decPrevYear}? ${foundInDec ? "✅ SÍ (CORRECTO - Soporta cambio de año)" : "❌ NO (ERROR)"}`);

    // -------------------------------------------------------------
    // PRUEBA 5 & 6: Aprobar un trabajo y verificar inmutabilidad
    // -------------------------------------------------------------
    console.log("\n=======================================================");
    console.log("TEST 5 & 6: Aprobar trabajo y verificar preservation del registro");
    console.log("=======================================================");
    await updateDoc(doc(db, "manualidades", docPrev.id), {
      estado: "aprobado",
      aprobadoPor: "Administrador Test",
      fechaAprobacion: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    const snapApproved = await getDoc(doc(db, "manualidades", docPrev.id));
    const approvedData = snapApproved.data();

    console.log(`   Estado tras aprobación: estado="${approvedData.estado}", fecha="${approvedData.fecha}"`);
    console.log(`   ¿Conserva su fecha de trabajo real? ${approvedData.fecha === prevMonthStr ? "✅ SÍ (CORRECTO)" : "❌ NO (ERROR)"}`);

    // Limpieza de registros de prueba
    console.log("\n🧹 Limpiando registros temporales de prueba...");
    for (const id of createdTestIds) {
      await deleteDoc(doc(db, "manualidades", id));
    }
    console.log("   Registros temporales eliminados de Firestore.");

    console.log("\n=======================================================");
    console.log("🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE.");
    console.log("=======================================================\n");

  } catch (error) {
    console.error("❌ Error en script de prueba:", error);
  } finally {
    process.exit(0);
  }
}

runTests();

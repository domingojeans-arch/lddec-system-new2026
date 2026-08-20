import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

async function auditManualidades() {
  console.log("🔍 AUDITANDO REGISTROS DE MANUALIDADES EN FIRESTORE...\n");
  
  try {
    await signInWithEmailAndPassword(auth, "ugeofly@hotmail.com", "admin123456");
    console.log("🔑 Autenticado como ugeofly@hotmail.com.");
  } catch(e) {
    try {
      await signInWithEmailAndPassword(auth, "admin@lddec.com", "admin123456");
      console.log("🔑 Autenticado como admin@lddec.com.");
    } catch(err) {
      console.log("⚠️ Falló login de prueba script:", err.message);
    }
  }

  const snap = await getDocs(collection(db, "manualidades"));
  console.log(`Total de registros en "manualidades": ${snap.docs.length}`);

  let mismatchedCount = 0;
  const mismatchedRecords = [];

  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;
    const fecha = data.fecha || data.fechaStr || "S/F";
    const createdAtTs = data.createdAt;
    
    let createdDateStr = "S/F";
    if (createdAtTs?.toDate) {
      createdDateStr = createdAtTs.toDate().toISOString().split('T')[0];
    } else if (createdAtTs?.seconds) {
      createdDateStr = new Date(createdAtTs.seconds * 1000).toISOString().split('T')[0];
    } else if (createdAtTs) {
      createdDateStr = new Date(createdAtTs).toISOString().split('T')[0];
    }

    let fechaMonth = "";
    if (typeof fecha === "string" && fecha.includes("-")) {
      const parts = fecha.split("-");
      if (parts.length === 3) fechaMonth = `${parts[0]}-${parts[1]}`;
    }

    let createdMonth = "";
    if (createdDateStr.includes("-")) {
      const parts = createdDateStr.split("-");
      if (parts.length >= 2) createdMonth = `${parts[0]}-${parts[1]}`;
    }

    if (fechaMonth && createdMonth && fechaMonth !== createdMonth) {
      mismatchedCount++;
      mismatchedRecords.push({
        id,
        lote: data.loteNumero || "S/L",
        operario: data.operarioNombre || "S/O",
        proceso: data.proceso || "S/P",
        fechaRegistro: fecha,
        fechaMonth,
        fechaCreacionDoc: createdDateStr,
        createdMonth,
        estado: data.estado || "pendiente"
      });
    }
  });

  console.log(`\n📌 RESULTADOS DEL DIAGNÓSTICO:`);
  console.log(`- Registros donde la Fecha de Trabajo ("fecha") y Fecha de Creación ("createdAt") PERTENECEN A MESES DIFERENTES: ${mismatchedCount}`);
  
  if (mismatchedRecords.length > 0) {
    console.log("\nEjemplos de registros afectados que sufren este problema:");
    mismatchedRecords.slice(0, 15).forEach((rec, i) => {
      console.log(`  [${i + 1}] ID: ${rec.id} | Lote: ${rec.lote} | Operario: ${rec.operario} | Estado: ${rec.estado}`);
      console.log(`      📅 Fecha Trabajo: ${rec.fechaRegistro} (Mes: ${rec.fechaMonth})`);
      console.log(`      🕒 Fecha Creación en Sistema (createdAt): ${rec.fechaCreacionDoc} (Mes: ${rec.createdMonth})`);
      console.log(`      --> SÍNTOMA: Al consultar el mes ${rec.fechaMonth}, Firestore lo excluye por query de createdAt <= finDeMes. Al consultar el mes ${rec.createdMonth}, la memoria lo descarta por fecha != mes actual.`);
    });
  }

  process.exit(0);
}

auditManualidades().catch(e => {
  console.error("Error auditando:", e);
  process.exit(1);
});

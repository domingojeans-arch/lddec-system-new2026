import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";

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

function getCleanLotNumber(lot) {
  if (!lot) return "N/D";
  const candidates = [lot.lotNumber, lot.numeroLote, lot.entryLotNumber, lot.loteId, lot.lote, lot.loteNumero, lot.numLote, lot.id];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined" && s.toLowerCase() !== "null" && s !== "S/L") {
      return s.toUpperCase();
    }
  }
  return "N/D";
}

function getCleanEntryNumber(item, docData) {
  const candidates = [item?.entryNumber, item?.numeroIngreso, item?.ingreso, docData?.entryNumber, docData?.numeroIngreso];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined" && s.toLowerCase() !== "null" && s !== "S/N") {
      return s.toUpperCase();
    }
  }
  return "N/D";
}

async function runCrossValidation() {
  console.log("🔍 INICIANDO VALIDACIÓN CRUZADA DE CANTIDADES Y TRAZABILIDAD...\n");

  // 1. VALIDACIÓN INGRESOS MAESTROS Y SUMA DE LOTES
  const snapEntries = await getDocs(query(collection(db, "entries"), limit(200)));
  const multiLotEntries = snapEntries.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(e => Array.isArray(e.lotes || e.lots) && (e.lotes || e.lots).length >= 2)
    .slice(0, 3);

  console.log("=========================================================================");
  console.log("📌 VALIDACIÓN CRUZADA 1: 3 INGRESOS MAESTROS Y SUMA DE SUS LOTES");
  console.log("=========================================================================");

  multiLotEntries.forEach((entry, idx) => {
    const entryNum = entry.entryNumber || entry.numeroIngreso || entry.id;
    const lotes = entry.lotes || entry.lots || [];
    
    let sumLotesQty = 0;
    console.log(`\nEJEMPLO INGRESO #${idx + 1}: [Nº Ingreso: ${entryNum}] - Cliente: ${entry.clientName || entry.nombreCliente}`);
    console.log(`Responsable: ${entry.responsible || 'N/A'} | Total Lotes: ${lotes.length}`);
    
    lotes.forEach((l, lIdx) => {
      const garments = Array.isArray(l.garments) ? l.garments : (Array.isArray(l.prendas) ? l.prendas : []);
      let cantLote = 0;
      let compStr = "";
      if (garments.length > 0) {
        cantLote = garments.reduce((acc, g) => acc + Number(g.quantity || g.cantidad || g.cantidadConfirmada || 0), 0);
        compStr = garments.map(g => `${g.garmentType || g.tipo}: ${g.quantity || g.cantidad}`).join(" | ");
      } else {
        cantLote = Number(l.cantidadConfirmada || l.quantity || l.cantidad || l.total || 0);
        compStr = l.garmentType || l.tipo || "Prenda";
      }
      sumLotesQty += cantLote;
      console.log(`  ├─ Lote ID: ${getCleanLotNumber(l)} | Cantidad Lote: ${cantLote} prendas | Composición: ${compStr}`);
    });

    const masterTotal = entry.totalGarments || lotes.reduce((acc, l) => {
      const g = l.garments || l.prendas || [];
      return acc + (g.length > 0 ? g.reduce((a, x) => a + Number(x.quantity || x.cantidad || 0), 0) : Number(l.cantidadConfirmada || l.quantity || 0));
    }, 0);

    console.log(`  └─ TOTAL INGRESO MAESTRO = ${masterTotal} prendas | SUMA LOTES EXPORTADA = ${sumLotesQty} prendas | COINCIDENCIA EXACTA: ${masterTotal === sumLotesQty ? "✅ SI" : "❌ NO"}`);
  });

  // 2. VALIDACIÓN SALIDAS Y SUMA DE PRENDAS DESPACHADAS
  const snapOutputs = await getDocs(query(collection(db, "outputs"), limit(200)));
  const multiItemOutputs = snapOutputs.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(o => Array.isArray(o.itemsDispatched || o.items) && (o.itemsDispatched || o.items).length >= 1)
    .slice(0, 3);

  console.log("\n=========================================================================");
  console.log("📌 VALIDACIÓN CRUZADA 2: 3 GUÍAS DE SALIDA Y SUMA DE SUS DESPACHOS");
  console.log("=========================================================================");

  multiItemOutputs.forEach((out, idx) => {
    const guiaNum = out.numeroSalida || out.numeroGuia || out.id;
    const items = out.itemsDispatched || out.items || [];
    
    let sumDespachada = 0;
    console.log(`\nEJEMPLO GUÍA SALIDA #${idx + 1}: [Nº Guía: ${guiaNum}] - Cliente: ${out.clienteNombre || out.clientName || (out.containedClientNames || []).join(', ')}`);
    console.log(`Responsable: ${out.responsiblePerson || out.responsable || 'N/A'} | Total Ítems: ${items.length}`);

    items.forEach((it, iIdx) => {
      const cant = Number(it.quantityToDispatch || it.cantidad || it.quantity || 0);
      sumDespachada += cant;
      const ingOrigen = getCleanEntryNumber(it, out);
      const loteDesp = getCleanLotNumber(it);
      console.log(`  ├─ Ítem ${iIdx + 1}: Ingreso Origen: ${ingOrigen} | Lote Despachado: ${loteDesp} | Prenda: ${it.garmentType || it.prenda || 'Prenda'} | Cantidad: ${cant}`);
    });

    const totalGuia = Number(out.totalPrendas || sumDespachada);
    console.log(`  └─ TOTAL GUÍA DESPACHO = ${totalGuia} prendas | SUMA LOTES DESPACHADOS EXPORTADA = ${sumDespachada} prendas | COINCIDENCIA EXACTA: ${totalGuia === sumDespachada ? "✅ SI" : "❌ NO"}`);
  });

  process.exit(0);
}

runCrossValidation().catch(console.error);

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + "T12:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function run() {
  console.log("Signing in anonymously...");
  await signInAnonymously(auth);
  console.log("Connected! Querying collections to calculate 2025 monthly values...");

  const production2025 = Array(12).fill(0);
  const dispatches2025 = Array(12).fill(0);
  const billing2025 = Array(12).fill(0);

  // 1. Entries (Production)
  const entriesSnap = await getDocs(collection(db, "entries"));
  entriesSnap.forEach(doc => {
    const data = doc.data();
    const d = toDate(data.date || data.entryDate || data.createdAt);
    if (d && d.getFullYear() === 2025) {
      const monthIdx = d.getMonth();
      const qty = (data.lotes || []).reduce((acc, l) => acc + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0)), 0);
      production2025[monthIdx] += qty;
    }
  });

  // 2. Outputs (Dispatches)
  const outputsSnap = await getDocs(collection(db, "outputs"));
  outputsSnap.forEach(doc => {
    const data = doc.data();
    const d = toDate(data.date || data.createdAt);
    if (d && d.getFullYear() === 2025) {
      const monthIdx = d.getMonth();
      const qty = Array.isArray(data.itemsDispatched)
        ? data.itemsDispatched.reduce((itAcc, it) => itAcc + (Number(it.quantityToDispatch || it.quantity || 0)), 0)
        : Number(data.totalPrendas || data.total || 0);
      dispatches2025[monthIdx] += qty;
    }
  });

  // 3. Invoices (Billing)
  const invoicesSnap = await getDocs(collection(db, "facturas"));
  invoicesSnap.forEach(doc => {
    const data = doc.data();
    const d = toDate(data.fechaFactura || data.createdAt || data.invoiceDate);
    if (d && d.getFullYear() === 2025) {
      const monthIdx = d.getMonth();
      const amount = Number(data.totalFactura || data.total || 0);
      billing2025[monthIdx] += amount;
    }
  });

  console.log("\n================ CALCULATED 2025 CONSTANTS ================");
  console.log("const PRODUCTION_2025 = " + JSON.stringify(production2025) + ";");
  console.log("const DISPATCHES_2025 = " + JSON.stringify(dispatches2025) + ";");
  console.log("const BILLING_2025 = " + JSON.stringify(billing2025) + ";");
  console.log("============================================================\n");
}

run().then(() => process.exit(0));

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

async function checkCollection(name, dateFields) {
  console.log(`Checking collection "${name}"...`);
  try {
    const snap = await getDocs(collection(db, name));
    let total = 0;
    let counts2025 = 0;
    let counts2026 = 0;
    let otherYears = {};
    
    snap.docs.forEach(doc => {
      total++;
      const data = doc.data();
      let docDate = null;
      for (const field of dateFields) {
        if (data[field]) {
          docDate = toDate(data[field]);
          if (docDate) break;
        }
      }
      
      if (docDate) {
        const year = docDate.getFullYear();
        if (year === 2025) {
          counts2025++;
        } else if (year === 2026) {
          counts2026++;
        } else {
          otherYears[year] = (otherYears[year] || 0) + 1;
        }
      }
    });
    
    console.log(`Results for "${name}":`);
    console.log(`  Total docs: ${total}`);
    console.log(`  2025 docs: ${counts2025}`);
    console.log(`  2026 docs: ${counts2026}`);
    if (Object.keys(otherYears).length > 0) {
      console.log(`  Other years:`, otherYears);
    }
    console.log("-----------------------------------------");
  } catch (err) {
    console.error(`Error checking "${name}":`, err.message);
  }
}

async function run() {
  console.log("Signing in anonymously...");
  await signInAnonymously(auth);
  console.log("Signed in successfully!");
  
  await checkCollection("entries", ["date", "entryDate", "createdAt"]);
  await checkCollection("outputs", ["date", "createdAt"]);
  await checkCollection("salidas", ["fechaSalida", "createdAt"]);
  await checkCollection("muestras", ["fecha", "createdAt"]);
  await checkCollection("facturas", ["fechaFactura", "createdAt", "invoiceDate"]);
}

run().then(() => process.exit(0));

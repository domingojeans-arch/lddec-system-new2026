import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit, orderBy } from "firebase/firestore";
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
const db = getFirestore(app);

async function run() {
  console.log("Fetching recent entries...");
  const q = query(collection(db, "entries"), limit(50));
  const snap = await getDocs(q);
  console.log(`Found ${snap.docs.length} entries:`);
  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(`ID: ${doc.id} => No: ${d.entryNumber}, client: ${d.clienteNombre || d.clientName}, status: ${d.status}, facturado: ${d.facturado}, facturaId: ${d.facturaId}, date: ${d.date}`);
  }
}

run().then(() => {
  console.log("Done");
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});

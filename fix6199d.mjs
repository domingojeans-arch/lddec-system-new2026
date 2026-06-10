import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "entries"), where("entryNumber", "==", "4542"));
  const snap = await getDocs(q);
  if (!snap.empty) {
      console.log("Found entry by entryNumber 4542:", snap.docs[0].data());
  } else {
      const snap2 = await getDoc(doc(db, "entries", "4542"));
      if (snap2.exists()) console.log("Found entry by ID 4542:", snap2.data());
      else console.log("Entry 4542 not found");
  }
}

run().then(() => process.exit(0));

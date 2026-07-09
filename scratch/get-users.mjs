import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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
  console.log("Fetching users from roles_usuarios...");
  try {
    const snap = await getDocs(collection(db, "roles_usuarios"));
    console.log(`Total users found: ${snap.size}`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`- UID: ${doc.id}, Name: ${data.nombre}, Email: ${data.email}, Role: ${data.role}, Activo: ${data.activo}`);
    });
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run().then(() => process.exit(0));

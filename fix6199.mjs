import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
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
  console.log("Fetching invoice 6199...");
  const q = query(collection(db, "facturas"), where("numeroFactura", "==", "6199"));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("No invoice found with string 6199! Trying numeric.");
    // try numeric
    const q2 = query(collection(db, "facturas"), where("numeroFactura", "==", 6199));
    const snap2 = await getDocs(q2);
    if (snap2.empty) {
        console.log("No invoice found recursively.");
        return;
    } else {
        await processDocs(snap2);
    }
  } else {
    await processDocs(snap);
  }

  async function processDocs(snapshot) {
      for (const d of snapshot.docs) {
        const data = d.data();
        console.log("Found:", d.id, "=> clientId:", data.clientId, "clienteId:", data.clienteId, "clienteNombre:", data.clienteNombre);
        
        // Find client
        if (data.clienteNombre) {
            console.log("Looking up client:", data.clienteNombre);
            const cq = query(collection(db, "clients"), where("name", "==", data.clienteNombre));
            const cSnap = await getDocs(cq);
            if (!cSnap.empty) {
                const clientId = cSnap.docs[0].id;
                console.log("Found client ID:", clientId);
                console.log("Updating document...");
                await updateDoc(doc(db, "facturas", d.id), {
                    clientId: clientId,
                    clienteId: clientId
                });
                console.log("Update complete.");
            } else {
                console.log("Client not found by name.");
            }
        } else {
             console.log("No clienteNombre found to map.");
        }
      }
  }
}

run().then(() => {
    console.log("Done");
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});

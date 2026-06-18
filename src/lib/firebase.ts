import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Configuración oficial LDDEC Manager
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  // Inicialización limpia y segura
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  
  if (typeof window !== "undefined") {
    // Inicialización de App Check comentada para desarrollo local (Evita error "client is offline")
    /*
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LdRBc8sAAAAAIQE3yVhNh2_1dUHAcIYYUjF2Z3n'),
      isTokenAutoRefreshEnabled: true
    });
    */

    console.log("🛠️ Firebase DenimLab 2026 Active:", {
      projectId: firebaseConfig.projectId
    });
  }
} catch (error: any) {
  console.error("❌ Firebase Initialization Error:", error);
  auth = null as any;
  db = null as any;
}

export { auth, db };

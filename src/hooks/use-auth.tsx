
"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, getDoc, setDoc, updateDoc, Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SystemRole } from "@/types/lddec";
import { useRouter } from "next/navigation";

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: SystemRole;
  activo: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  logout: async () => {},
});

const ALLOWED_ROLES = ["admin", "socio", "contador", "bodega", "facturacion", "chofer", "financiero", "banco", "produccion", "cobranzas", "operario_manualidades", "bodega_quimicos"];

function getNormalizedRole(rawRole: any): SystemRole {
  if (rawRole === undefined || rawRole === null || rawRole === "") {
    return "socio";
  }

  let r = String(rawRole).toLowerCase().trim();
  
  if (r === "administrador" || r === "administrator") {
    r = "admin";
  }
  
  if (r === "bodeguero") {
    r = "bodega";
  }

  if (ALLOWED_ROLES.includes(r)) {
    return r as SystemRole;
  }

  return "socio";
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Referencia para guardar la función de des-suscripción de Firestore
  const unsubscribeFirestore = useRef<Unsubscribe | null>(null);

  const cleanupFirestore = () => {
    if (unsubscribeFirestore.current) {
      unsubscribeFirestore.current();
      unsubscribeFirestore.current = null;
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      // Limpiar suscripciones previas siempre que cambie el estado de auth
      cleanupFirestore();

      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const email = firebaseUser.email?.toLowerCase().trim() || "";
        const docRef = doc(db, "roles_usuarios", uid);
        
        setError(null);
        try {
          let docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            const newProfile = {
              uid: uid,
              email: email,
              nombre: firebaseUser.displayName || email.split('@')[0].toUpperCase(),
              role: "socio",
              activo: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            await setDoc(docRef, newProfile);
          }

          // Guardar la nueva suscripción en la referencia
          unsubscribeFirestore.current = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
              const profile = snap.data();
              
              // KILL SWITCH: Si el usuario es desactivado en Firestore, cerrar sesión inmediatamente
              if (profile.activo === false) {
                setUser(null);
                signOut(auth).catch(() => {});
                setLoading(false);
                return;
              }

              const resolvedRole = getNormalizedRole(profile.role);
              
              setUser({
                uid: uid,
                email: firebaseUser.email,
                displayName: profile.nombre || "Usuario LDDEC",
                role: resolvedRole,
                activo: true,
              });
            } else {
              setUser(null);
            }
            setLoading(false);
          });

        } catch (error) {
          console.warn("Auth Context Load Error:", error);
          setError("No se pudo cargar el perfil del usuario desde Firestore");
          setUser(null);
          setLoading(false);
          signOut(auth).catch(() => {});
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      cleanupFirestore();
    };
  }, []);

  const logout = async () => {
    if (!auth) return;
    try {
      const currentUserUid = user?.uid;
      
      // 1. Limpiar estado de forma atómica e inmediata
      setLoading(true); // Bloquear UI durante la transición
      cleanupFirestore(); // Detener cualquier escucha de Firestore antes de salir
      setUser(null);

      // 2. Marcar presencia como offline (no bloqueante)
      if (currentUserUid && db) {
        const docRef = doc(db, "roles_usuarios", currentUserUid);
        updateDoc(docRef, { 
          isOnline: false, 
          lastSeen: serverTimestamp() 
        }).catch(() => {});
      }
      
      // 3. Cerrar sesión en Firebase
      await signOut(auth);
      
      // 4. Limpiar almacenamiento local por seguridad
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }

      // 5. Redirigir y forzar limpieza de historial
      router.replace("/login");
    } catch (error) {
      console.warn("Logout error:", error);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

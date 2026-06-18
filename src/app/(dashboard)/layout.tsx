"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirección definitiva al login si no hay sesión y terminó de cargar
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Heartbeat para estado 'En Línea'
  useEffect(() => {
    if (!user?.uid || !db) return;

    const userRef = doc(db, "roles_usuarios", user.uid);
    
    setDoc(userRef, { 
      isOnline: true, 
      lastSeen: serverTimestamp() 
    }, { merge: true }).catch((err) => {
      console.warn("Presence update failed:", err.message);
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setDoc(userRef, { isOnline: false }, { merge: true }).catch(() => {});
      } else {
        setDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      // Solo intentar marcar offline si todavía tenemos el UID
      if (user?.uid) {
        setDoc(userRef, { isOnline: false }, { merge: true }).catch(() => {});
      }
    };
  }, [user?.uid]);

  // Bloquear renderizado si está cargando o no hay usuario para evitar "flicker"
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Validando Acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-background pb-20 md:pb-0">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>

      <div className="md:hidden">
        <MobileHeader />
      </div>

      <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-[1800px] mx-auto w-full animate-in fade-in duration-700">
        {children}
      </main>

      <div className="md:hidden">
        <MobileNav />
      </div>

      <footer className="hidden md:block py-8 px-10 border-t border-slate-100 text-center">
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em]">
          © 2024 Laboratorio del denim Ecuador • Versión 2.0
        </p>
      </footer>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardContent>{children}</DashboardContent>;
}

"use client";

import React, { useState, useEffect, use } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SalidaPrintContent } from "@/components/salidas/SalidaPrintContent";
import { Loader2 } from "lucide-react";

export default function PrintSalidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [salida, setSalida] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!db || !id) return;
      try {
        const docRef = doc(db, "outputs", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSalida({ id: snap.id, ...snap.data() });
        } else {
          // Fallback a colecciones legacy
          const legacyRefs = ["salidas", "muestras"];
          for (const col of legacyRefs) {
            const lRef = doc(db, col, id);
            const lSnap = await getDoc(lRef);
            if (lSnap.exists()) {
              setSalida({ id: lSnap.id, ...lSnap.data() });
              break;
            }
          }
        }
      } catch (e) {
        console.error("Error loading print data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  useEffect(() => {
    if (!loading && salida) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, salida]);

  if (loading) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preparando Guía...</p>
      </div>
    );
  }

  if (!salida) {
    return <div className="p-10 font-bold">Error: Registro no encontrado.</div>;
  }

  return (
    <div className="print-container">
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          background: white;
          color: black;
          -webkit-print-color-adjust: exact;
        }
        .print-container {
          width: 21cm;
          min-height: 29.7cm;
          margin: 0;
          padding: 0;
          background: white;
          position: relative;
        }
      `}</style>
      <SalidaPrintContent salida={salida} startAtLine={1} />
    </div>
  );
}


"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Loader2, 
  BarChart3, 
  ClipboardCheck, 
  Database,
  Search
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { ReportGeneratorPanel } from "@/components/informes/report-generator-panel";
import { AuditLotPanel } from "@/components/informes/audit-lot-panel";
import { AuditMaestroPanel } from "@/components/informes/audit-maestro-panel";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InformesPage() {
  const [mounted, setMounted] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const { user } = useAuth();
  
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    if (!db) return;

    const loadClients = async () => {
      try {
        const snap = await getDocs(collection(db, "clients"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const sorted = data.sort((a, b) => {
          const nameA = (a.name || a.nombre || "").trim().toUpperCase();
          const nameB = (b.name || b.nombre || "").trim().toUpperCase();
          return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
        });
        
        setClients(sorted);
      } catch (e) {
        console.error("Error loading clients for reports:", e);
      } finally {
        setLoadingClients(false);
      }
    };

    loadClients();
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700">
        
        <div className="space-y-1 print:hidden">
          <h1 className="text-5xl font-black tracking-tighter uppercase">Inteligencia Industrial</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Auditoría y Análisis LDDEC v2.0</p>
        </div>

        {loadingClients ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Iniciando Motor de Datos...</p>
          </div>
        ) : (
          <Tabs defaultValue="reportes" className="w-full space-y-10">
            <TabsList className="bg-muted/30 p-1.5 h-14 rounded-2xl w-fit gap-2 border border-border">
              <TabsTrigger value="reportes" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4" /> Generador de Informes
              </TabsTrigger>
              <TabsTrigger value="auditorias" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <Database className="h-4 w-4" /> Centro de Auditoría
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reportes" className="mt-0 outline-none">
              <ReportGeneratorPanel clients={clients} />
            </TabsContent>

            <TabsContent value="auditorias" className="mt-0 space-y-10 outline-none">
              <div className="grid grid-cols-1 gap-10">
                <AuditLotPanel />
                <AuditMaestroPanel />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

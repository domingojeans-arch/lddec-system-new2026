"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Search, 
  Loader2, 
  History as HistoryIcon, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { HandicraftsReviewTable } from "@/components/produccion/handicrafts-review-table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  updateDoc, 
  doc, 
  Timestamp,
  orderBy,
  deleteDoc,
  where,
  limit,
  serverTimestamp,
  getDocs
} from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD VISIBLE (LOTE)
 */
function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [
    lote.lotNumber,
    lote.numeroLote,
    lote.loteId,
    lote.lote,
    lote.loteNumero,
    lote.numLote,
    lote.id
  ];

  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined") {
      return s.toUpperCase();
    }
  }
  return "S/L";
}

export default function ProduccionPage() {
  const [activeTab, setActiveTab] = useState("pendiente");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<any[]>([]);
  const [manualWorks, setManualWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const router = useRouter();
  const isReadOnly = user?.role === "socio";

  // ESTADOS DE BÚSQUEDA DEBOUNCED
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOperator, setSearchOperator] = useState("");
  const [inputSearch, setInputSearch] = useState("");
  const [inputOperator, setInputOperator] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(inputSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchOperator(inputOperator.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputOperator]);

  const [manualSortKey, setManualSortKey] = useState("createdAt");
  const [manualSortDir, setManualSortDir] = useState("desc");
  
  const { toast } = useToast();

  /**
   * MOTOR DE CARGA OPTIMIZADO (GET DOCS)
   * Descarga manualidades del mes y entradas relacionadas para cruce de lotes.
   */
  const loadData = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const start = Timestamp.fromDate(startOfMonth(selectedDate));
      const end = Timestamp.fromDate(endOfMonth(selectedDate));
      
      // 1. Cargar Manualidades del mes y estado actual
      const qManual = query(
        collection(db, "manualidades"), 
        where("estado", "==", activeTab),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
      
      const manualSnap = await getDocs(qManual);
      const manualList = manualSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Cargar Entradas relacionadas para cruce (Ventana de 3 meses para asegurar match)
      const threeMonthsAgo = new Date(selectedDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
      const startEntries = Timestamp.fromDate(startOfMonth(threeMonthsAgo));
      
      const qEntries = query(
        collection(db, "entries"), 
        where("date", ">=", startEntries),
        where("date", "<=", end),
        orderBy("date", "desc"),
        limit(500) // Límite reducido para optimizar costos
      );
      
      const entriesSnap = await getDocs(qEntries);
      
      setManualWorks(manualList);
      setEntries(entriesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.warn("Error en carga de producción:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key: string) => {
    if (manualSortKey === key) {
      setManualSortDir(manualSortDir === "asc" ? "desc" : "asc");
    } else {
      setManualSortKey(key);
      setManualSortDir("asc");
    }
  };

  const filteredManualWorks = useMemo(() => {
    const s = searchTerm.toLowerCase();
    const op = searchOperator.toLowerCase();
    
    const enriched = manualWorks.map(work => {
      const lotNum = (work.loteNumero || "").toString().toUpperCase();
      let originalQty = null;
      
      for (const entry of entries) {
        const found = (entry.lotes || []).find((l: any) => {
          const vName = getVisibleLotName(l);
          const iId = (l.lotNumber || l.id || l.loteId || l.numeroLote || "").toString().toUpperCase();
          return iId === lotNum || vName === lotNum;
        });
        if (found) {
          originalQty = Number(found.cantidadConfirmada || found.quantity || found.cantidad || 0);
          break;
        }
      }
      return { ...work, loteOriginalCant: originalQty };
    });

    const filtered = enriched.filter(m => 
      (m.loteNumero?.toLowerCase().includes(s) || m.clienteNombre?.toLowerCase().includes(s)) && 
      m.operarioNombre?.toLowerCase().includes(op)
    );

    return filtered.sort((a, b) => {
      const valA = a[manualSortKey];
      const valB = b[manualSortKey];
      
      const getComparable = (v: any) => {
        if (!v) return "";
        if (v && typeof v === 'object' && v.seconds !== undefined) return v.seconds; 
        return v;
      };

      const compA = getComparable(valA);
      const compB = getComparable(valB);

      const numA = Number(compA);
      const numB = Number(compB);
      if (compA !== "" && compB !== "" && !isNaN(numA) && !isNaN(numB)) {
        return manualSortDir === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(compA || "").toLowerCase();
      const strB = String(compB || "").toLowerCase();
      return manualSortDir === "asc" ? strA.localeCompare(strB, 'es') : strB.localeCompare(strA, 'es');
    });
  }, [manualWorks, searchTerm, searchOperator, manualSortKey, manualSortDir, entries]);

  const handleReviewManualWork = async (workId: string, status: 'aprobado' | 'rechazado', price?: number) => {
    if (isReadOnly) return;
    
    try {
      const updates: any = { 
        estado: status, 
        updatedAt: serverTimestamp(), 
        reviewedBy: user?.displayName || "Sistema", 
        reviewedAt: serverTimestamp() 
      };

      if (status === 'aprobado' && price !== undefined) {
        const work = manualWorks.find(m => m.id === workId);
        updates.precioUnitario = price;
        updates.total = price * (work?.cantidad || 0);
      }

      await updateDoc(doc(db, "manualidades", workId), updates);
      toast({ title: `Registro ${status.toUpperCase()}` });
      loadData(); // Recargar datos para reflejar el cambio de pestaña
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Error al actualizar", 
        description: "No se pudo sincronizar el cambio con Firestore." 
      });
    }
  };

  const handleUpdateManualWork = async (workId: string, data: any) => {
    if (isReadOnly) return;
    try {
      const workRef = doc(db, "manualidades", workId);
      await updateDoc(workRef, {
        ...data,
        updatedAt: serverTimestamp(),
        lastEditedBy: user?.displayName || "Sistema"
      });
      toast({ title: "Registro Actualizado" });
      loadData();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const handleDeleteManualWork = async (workId: string) => {
    if (isReadOnly) return;
    if (!window.confirm("¿Seguro que deseas eliminar este registro?")) return;
    try {
      await deleteDoc(doc(db, "manualidades", workId));
      toast({ title: "Registro eliminado" });
      loadData();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const handlePrevMonth = () => setSelectedDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedDate(prev => addMonths(prev, 1));

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">Revisión de Manualidades</h1>
          <p className="text-muted-foreground text-sm font-medium">Control de calidad y aprobación por periodo y estado.</p>
          {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3">Modo Solo Lectura</Badge>}
        </div>

        <div className="bg-muted/30 p-2 rounded-xl border border-border flex flex-col lg:flex-row items-center gap-4">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input placeholder="Lote o Cliente..." className="pl-10 erp-input h-10 text-xs w-full bg-background border border-border rounded-lg outline-none" value={inputSearch} onChange={e => setInputSearch(e.target.value)} />
          </div>
          <div className="relative w-full lg:w-64">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input placeholder="Operario..." className="pl-10 erp-input h-10 text-xs border-primary/20 w-full bg-background border rounded-lg outline-none" value={inputOperator} onChange={e => setInputOperator(e.target.value)} />
          </div>
          <div className="h-10 flex items-center px-4 bg-background border border-border rounded-lg text-[10px] font-black uppercase text-muted-foreground">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <span className="text-primary mr-2 text-sm">{filteredManualWorks.length}</span>} Registros
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-center gap-6 bg-card border border-border p-4 rounded-[2rem] shadow-premium max-w-fit mx-auto">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-10 w-10 rounded-full hover:bg-primary/10 text-primary">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-3 min-w-[200px] justify-center">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="text-lg font-black uppercase tracking-tight text-foreground">
              {format(selectedDate, "MMMM yyyy", { locale: es })}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-10 w-10 rounded-full hover:bg-primary/10 text-primary">
            <ChevronRight className="h-6 w-6" />
          </Button>
          <div className="w-px h-8 bg-border mx-2" />
          <Button 
            onClick={loadData} 
            disabled={loading}
            className="h-10 px-4 bg-muted hover:bg-muted/80 text-foreground font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl border border-border"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            Consultar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-card border border-border p-1 h-12 w-fit rounded-xl gap-2">
            <TabsTrigger value="pendiente" className="px-8 rounded-lg font-black text-[10px] uppercase tracking-widest gap-2">
              <Clock className="h-3.5 w-3.5" /> Pendientes
            </TabsTrigger>
            <TabsTrigger value="aprobado" className="px-8 rounded-lg font-black text-[10px] uppercase tracking-widest gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobados
            </TabsTrigger>
            <TabsTrigger value="rechazado" className="px-8 rounded-lg font-black text-[10px] uppercase tracking-widest gap-2">
              <XCircle className="h-3.5 w-3.5" /> Rechazados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendiente" className="m-0 outline-none">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando mes...</p>
              </div>
            ) : (
              <HandicraftsReviewTable 
                works={filteredManualWorks} 
                onReview={handleReviewManualWork} 
                onUpdate={handleUpdateManualWork}
                onDelete={handleDeleteManualWork}
                isHistory={false} 
                sortKey={manualSortKey} 
                sortDir={manualSortDir} 
                onSort={handleSort} 
              />
            )}
          </TabsContent>
          
          <TabsContent value="aprobado" className="m-0 outline-none">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recuperando aprobados...</p>
              </div>
            ) : (
              <HandicraftsReviewTable 
                works={filteredManualWorks} 
                onReview={handleReviewManualWork} 
                onUpdate={handleUpdateManualWork}
                onDelete={handleDeleteManualWork}
                isHistory={true} 
                sortKey={manualSortKey} 
                sortDir={manualSortDir} 
                onSort={handleSort} 
              />
            )}
          </TabsContent>

          <TabsContent value="rechazado" className="m-0 outline-none">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargando descartados...</p>
              </div>
            ) : (
              <HandicraftsReviewTable 
                works={filteredManualWorks} 
                onReview={handleReviewManualWork} 
                onUpdate={handleUpdateManualWork}
                onDelete={handleDeleteManualWork}
                isHistory={true} 
                sortKey={manualSortKey} 
                sortDir={manualSortDir} 
                onSort={handleSort} 
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

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
  RefreshCcw,
  Zap
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
  getDocs,
  writeBatch
} from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toDate } from "@/lib/toDate";

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
  const loadData = useCallback(async (silent = false) => {
    if (!db) return;
    if (!silent) setLoading(true);
    try {
      // 1. Consulta unificada: Traer todos los lotes de manualidades sin límites físicos de fecha de creación
      // Esto asegura que cualquier lote ingresado con fecha lógica en el mes seleccionado sea visible.
      const qManual = query(
        collection(db, "manualidades")
      );
      
      const manualSnap = await getDocs(qManual);
      const allManualList = manualSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Extraer año y mes seleccionados en el control visual (ej: "05" y "2026")
      const targetMonthStr = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const targetYearStr = String(selectedDate.getFullYear());

      // Filtrar y ordenar en memoria estrictamente por la fecha de origen real
      const manualList = allManualList
        .filter(work => {
          const fechaStr = work.fecha || work.fechaStr || "";
          
          // Lógica del filtro split para texto "yyyy-MM-dd"
          if (typeof fechaStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
            const [year, month, day] = fechaStr.split("-");
            return month === targetMonthStr && year === targetYearStr;
          }

          // Lógica del filtro split para texto "DD/MM/YYYY"
          if (typeof fechaStr === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
            const [day, month, year] = fechaStr.split("/");
            return month === targetMonthStr && year === targetYearStr;
          }
          
          // Fallback robusto a objeto Date / Timestamp
          const d = toDate(work.fecha || work.fechaStr || work.workDate || work.createdAt);
          if (!d) return false;
          return (
            String(d.getMonth() + 1).padStart(2, "0") === targetMonthStr &&
            String(d.getFullYear()) === targetYearStr
          );
        })
        .sort((a, b) => {
          const timeA = toDate(a.fecha || a.fechaStr || a.workDate || a.createdAt)?.getTime() || 0;
          const timeB = toDate(b.fecha || b.fechaStr || b.workDate || b.createdAt)?.getTime() || 0;
          return timeB - timeA; // orden descendente
        });

      // 2. Cargar Entradas relacionadas para cruce (Ventana de 3 meses para asegurar match)
      const threeMonthsAgo = new Date(selectedDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
      const startEntries = Timestamp.fromDate(startOfMonth(threeMonthsAgo));
      const end = Timestamp.fromDate(endOfMonth(selectedDate));
      
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
  }, [selectedDate]);

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

    // Dividir los datos y separar en el cliente según activeTab
    const filtered = enriched.filter(m => 
      m.estado === activeTab &&
      (m.loteNumero?.toLowerCase().includes(s) || m.clienteNombre?.toLowerCase().includes(s)) && 
      m.operarioNombre?.toLowerCase().includes(op)
    );

    return filtered.sort((a, b) => {
      let compA: any;
      let compB: any;

      if (manualSortKey === "createdAt") {
        const dRestoredA = toDate(a.fecha || a.fechaStr || a.workDate || a.createdAt);
        const dRestoredB = toDate(b.fecha || b.fechaStr || b.workDate || b.createdAt);
        compA = dRestoredA ? dRestoredA.getTime() : 0;
        compB = dRestoredB ? dRestoredB.getTime() : 0;
      } else {
        const valA = a[manualSortKey];
        const valB = b[manualSortKey];
        
        const getComparable = (v: any) => {
          if (!v) return "";
          if (v && typeof v === 'object' && v.seconds !== undefined) return v.seconds; 
          return v;
        };

        compA = getComparable(valA);
        compB = getComparable(valB);
      }

      const numA = Number(compA);
      const numB = Number(compB);
      if (compA !== "" && compB !== "" && !isNaN(numA) && !isNaN(numB)) {
        return manualSortDir === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(compA || "").toLowerCase();
      const strB = String(compB || "").toLowerCase();
      return manualSortDir === "asc" ? strA.localeCompare(strB, 'es') : strB.localeCompare(strA, 'es');
    });
  }, [manualWorks, activeTab, searchTerm, searchOperator, manualSortKey, manualSortDir, entries]);

  const handleReviewManualWork = async (workId: string, status: 'aprobado' | 'rechazado' | 'pendiente', price?: number) => {
    if (isReadOnly) return;

    const work = manualWorks.find(m => m.id === workId);
    if (!work) return;

    // VALIDACIÓN DE SEGURIDAD CONTRA DUPLICADOS ANTES DE APROBAR
    if (status === 'aprobado') {
      try {
        // 1. Consulta rápida a Firestore buscando registros aprobados del mismo lote, proceso y operario
        const q = query(
          collection(db, "manualidades"),
          where("loteNumero", "==", work.loteNumero),
          where("proceso", "==", work.proceso),
          where("operarioNombre", "==", work.operarioNombre || work.operarioId || ""),
          where("estado", "==", "aprobado")
        );
        const querySnapshot = await getDocs(q);
        const approvedDocs = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(doc => doc.id !== workId);

        // 2. Comprobar también en la lista cargada en memoria local para máxima reactividad
        const localApproved = manualWorks.filter(m =>
          m.id !== workId &&
          m.estado === "aprobado" &&
          String(m.loteNumero).trim().toUpperCase() === String(work.loteNumero).trim().toUpperCase() &&
          String(m.proceso).trim().toUpperCase() === String(work.proceso).trim().toUpperCase() &&
          String(m.operarioNombre || m.operarioId || "").trim().toUpperCase() === String(work.operarioNombre || work.operarioId || "").trim().toUpperCase()
        );

        // 3. Unificar por id
        const allApprovedMap = new Map<string, any>();
        approvedDocs.forEach(d => allApprovedMap.set(d.id, d));
        localApproved.forEach(d => allApprovedMap.set(d.id, d));
        const combinedApproved = Array.from(allApprovedMap.values());

        // 4. Buscar coincidencia exacta de 4 niveles: N° Lote, Manualidad, Operario y Cantidad
        const isDuplicate = combinedApproved.some(d => {
          const sameLot = String(d.loteNumero).trim().toUpperCase() === String(work.loteNumero).trim().toUpperCase();
          const sameProcess = String(d.proceso).trim().toUpperCase() === String(work.proceso).trim().toUpperCase();
          const sameQty = Number(d.cantidad) === Number(work.cantidad);
          
          const dOp = String(d.operarioNombre || d.operarioId || "").trim().toUpperCase();
          const wOp = String(work.operarioNombre || work.operarioId || "").trim().toUpperCase();
          const sameOperator = dOp === wOp && dOp !== "";

          return sameLot && sameProcess && sameQty && sameOperator;
        });

        if (isDuplicate) {
          toast({
            variant: "destructive",
            title: "Error de Aprobación",
            description: "Ya está registrado"
          });
          return; // DETIENE POR COMPLETO LA ACCIÓN
        }
      } catch (error) {
        console.error("Error en validación de seguridad de duplicados:", error);
        toast({
          variant: "destructive",
          title: "Error de validación",
          description: "No se pudo completar la verificación de duplicados de seguridad."
        });
        return;
      }
    }
    
    // 1. Guardar copia del estado previo de manualWorks para posibilitar rollback en caso de fallo
    const previousManualWorks = [...manualWorks];

    // Calcular valores optimistas
    let precioFinal = price;
    let totalFinal = work?.total || 0;

    if (status === 'aprobado' && price !== undefined) {
      totalFinal = price * (work?.cantidad || 0);
    }

    // 2. ACTUALIZACIÓN OPTIMISTA INSTANTÁNEA (En memoria)
    setManualWorks(prev => prev.map(m => {
      if (m.id === workId) {
        return {
          ...m,
          estado: status,
          precioUnitario: precioFinal !== undefined ? precioFinal : m.precioUnitario,
          total: precioFinal !== undefined ? totalFinal : m.total,
          reviewedBy: status !== 'pendiente' ? (user?.displayName || "Sistema") : null,
          reviewedAt: status !== 'pendiente' ? new Date() : null
        };
      }
      return m;
    }));

    // Notificación inmediata al usuario
    toast({ title: `Registro ${status.toUpperCase()}` });

    try {
      const updates: any = { 
        estado: status, 
        updatedAt: serverTimestamp()
      };

      if (status !== 'pendiente') {
        updates.reviewedBy = user?.displayName || "Sistema";
        updates.reviewedAt = serverTimestamp();
        updates.fechaAprobacion = serverTimestamp();
      } else {
        updates.reviewedBy = null;
        updates.reviewedAt = null;
        updates.fechaAprobacion = null;
      }

      if (status === 'aprobado' && price !== undefined) {
        updates.precioUnitario = price;
        updates.total = totalFinal;
      }

      // 3. Ejecución en segundo plano (Background)
      updateDoc(doc(db, "manualidades", workId), updates)
        .then(() => {
          // Recargar silenciosamente en fondo para sincronizar con los Timestamps finales del servidor
          loadData(true);
        })
        .catch((error) => {
          console.error("Error asincrónico al sincronizar en Firestore:", error);
          // Rollback local por fallo de red o permisos
          setManualWorks(previousManualWorks);
          toast({ 
            variant: "destructive", 
            title: "Error al actualizar en Firestore", 
            description: "No se pudo sincronizar el cambio. Se revirtió el estado del lote." 
          });
        });

    } catch (error) {
      console.error("Error sincrónico al preparar actualización:", error);
      // Rollback local por cualquier error inesperado
      setManualWorks(previousManualWorks);
      toast({ 
        variant: "destructive", 
        title: "Error de ejecución", 
        description: "Se ha revertido el estado local del lote." 
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
    if (!window.confirm("¿Está seguro de eliminar este registro de lote de forma permanente?")) return;
    try {
      await deleteDoc(doc(db, "manualidades", workId));
      toast({ title: "Registro eliminado" });
      loadData();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const [syncingTariffs, setSyncingTariffs] = useState(false);

  const handleSyncTariffs = async () => {
    if (!db) return;
    setSyncingTariffs(true);
    try {
      // 1. Obtener todas las tarifas
      const tariffSnap = await getDocs(collection(db, "manualidad_tarifas"));
      const tariffsList = tariffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (tariffsList.length === 0) {
        toast({
          variant: "destructive",
          title: "Sincronización cancelada",
          description: "No se encontraron tarifas registradas en 'manualidad_tarifas'."
        });
        setSyncingTariffs(false);
        return;
      }

      // 2. Obtener todos los registros de manualidades que estén pendientes
      const q = query(collection(db, "manualidades"), where("estado", "==", "pendiente"));
      const manualSnap = await getDocs(q);
      
      let updatedCount = 0;
      let skippedCount = 0;
      const batch = writeBatch(db);

      for (const docSnap of manualSnap.docs) {
        const data = docSnap.data();
        const price = Number(data.precioUnitario || 0);
        const total = Number(data.total || 0);

        if (price === 0 || total === 0) {
          const proceso = String(data.proceso || "").trim().toUpperCase();
          const tipoPrenda = String(data.tipoPrenda || "Adulto").trim();
          
          const tariff = tariffsList.find(t => 
            String(t.manualidad || t.processName || t.id).trim().toUpperCase() === proceso
          );

          if (tariff) {
            const isAdult = tipoPrenda.toLowerCase() === "adulto";
            const currentPrice = isAdult 
              ? Number(tariff.precioAdulto ?? tariff.adultPrice ?? 0)
              : Number(tariff.precioNino ?? tariff.childPrice ?? 0);
            
            const qty = Number(data.cantidad || 0);
            const newTotal = currentPrice * qty;

            batch.update(doc(db, "manualidades", docSnap.id), {
              precioUnitario: currentPrice,
              total: newTotal,
              updatedAt: serverTimestamp(),
              lastEditedBy: "Sistema (Sincronización)"
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        toast({
          title: "Sincronización Completada",
          description: `Se actualizaron ${updatedCount} lotes con sus tarifas. (${skippedCount} sin tarifa encontrada)`
        });
        loadData();
      } else {
        toast({
          title: "Sin cambios",
          description: "No se encontraron lotes pendientes con costo $0.00 que requieran actualización."
        });
      }
    } catch (error: any) {
      console.error("Error al sincronizar tarifas:", error);
      toast({
        variant: "destructive",
        title: "Error de Sincronización",
        description: error.message || "Ocurrió un error inesperado al actualizar Firestore."
      });
    } finally {
      setSyncingTariffs(false);
    }
  };

  const pendingZeroCostCount = useMemo(() => {
    return manualWorks.filter(m => m.estado === "pendiente" && (Number(m.precioUnitario || 0) === 0 || Number(m.total || 0) === 0)).length;
  }, [manualWorks]);

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
          {!isReadOnly && (
            <>
              <div className="w-px h-8 bg-border mx-2" />
              <Button
                onClick={handleSyncTariffs}
                disabled={loading || syncingTariffs}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl border-none shadow-md shadow-emerald-500/10"
              >
                {syncingTariffs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Sincronizar Tarifas
              </Button>
            </>
          )}
        </div>

        {!isReadOnly && pendingZeroCostCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-black uppercase text-amber-800">Lotes Pendientes sin Costo</p>
                <p className="text-[11px] text-amber-700 font-medium">Hay {pendingZeroCostCount} lotes en este periodo con precio o total en $0.00. Sincroniza las tarifas para corregirlos.</p>
              </div>
            </div>
            <Button
              onClick={handleSyncTariffs}
              disabled={loading || syncingTariffs}
              className="w-full sm:w-auto h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-widest gap-2 rounded-xl border-none shadow-md shadow-amber-500/10 shrink-0"
            >
              {syncingTariffs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Sincronizar Ahora
            </Button>
          </div>
        )}

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

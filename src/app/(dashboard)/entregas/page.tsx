"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  Truck, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  PackageCheck,
  Loader2,
  CheckCircle,
  CheckSquare,
  X,
  CalendarDays,
  Filter,
  Wifi,
  WifiOff,
  RefreshCw,
  Cloud,
  CloudOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  serverTimestamp,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  getPendingDeliveries,
  addPendingDelivery,
  addMultiplePendingDeliveries,
  getCachedOutputsAsync,
  setCachedOutputsAsync,
  mergePendingDeliveriesWithOutputs,
  syncDeliveriesToFirestore,
  withTimeout,
  PendingDeliveryItem
} from "@/lib/offline-deliveries";

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD PARA SALIDAS (LDDEC 1.1)
 */
function isVisibleGuide(value: any): boolean {
  const v = String(value ?? "").trim();
  if (!v || v === "undefined" || v === "[object Object]") return false;
  if (v.length > 18) return false;
  return /^[0-9]+$/.test(v) || /^[A-Z0-9\-]+$/.test(v);
}

function getGuiaRaw(item: any): string {
  const candidates = [item?.numeroSalida, item?.numeroGuia, item?.outputNumber, item?.id];
  for (const val of candidates) {
    if (isVisibleGuide(val)) return String(val).toUpperCase();
  }
  return "GUÍA SIN NÚMERO";
}

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

function cleanClientNames(nameStr: string): string {
  if (!nameStr) return "";
  const parts = nameStr.split(",").map(p => p.trim()).filter(Boolean);
  const seenSignatures = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    const cleanWords: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (i === 0 || words[i].toUpperCase() !== words[i - 1].toUpperCase()) {
        cleanWords.push(words[i]);
      }
    }
    const cleanPart = cleanWords.join(" ");
    const signature = cleanWords
      .map(w => w.toUpperCase())
      .sort()
      .join(" ");

    if (signature && !seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueParts.push(cleanPart);
    }
  }

  const result = uniqueParts.join(", ");
  const finalWords = result.split(/\s+/).filter(Boolean);
  const finalCleanWords: string[] = [];
  for (let i = 0; i < finalWords.length; i++) {
    const currentWordClean = finalWords[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase();
    const prevWordClean = i > 0 ? finalWords[i - 1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase() : "";
    if (i === 0 || currentWordClean !== prevWordClean) {
      finalCleanWords.push(finalWords[i]);
    }
  }
  
  let finalStr = finalCleanWords.join(" ");
  finalStr = finalStr.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
  return finalStr;
}

function getClienteSalida(item: any): string {
  let rawClient = item?.clienteNombre || item?.cliente || item?.clientName || "";
  if (!rawClient) {
    const clientNamesArray = Array.isArray(item?.containedClientNames) ? item.containedClientNames : [];
    rawClient = clientNamesArray.length > 0 ? clientNamesArray.join(", ") : "S/D";
  }
  return cleanClientNames(rawClient.toString().toUpperCase());
}

function formatFechaEC(rawDate: any): string {
  if (!rawDate) return "---";
  let date: Date;
  if (typeof rawDate.toDate === "function") date = rawDate.toDate();
  else date = new Date(rawDate);
  if (isNaN(date.getTime())) return "---";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

const MESES = [
  { value: "0", label: "Enero" },
  { value: "1", label: "Febrero" },
  { value: "2", label: "Marzo" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Mayo" },
  { value: "5", label: "Junio" },
  { value: "6", label: "Julio" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Septiembre" },
  { value: "9", label: "Octubre" },
  { value: "10", label: "Noviembre" },
  { value: "11", label: "Diciembre" },
];

export default function EntregasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "socio";
  const [outputs, setOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pendientes");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingBulk, setProcessingBulk] = useState(false);

  // Estados de conexión offline y sincronización
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [pendingItems, setPendingItems] = useState<PendingDeliveryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Estados de paginación por mes
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const canEdit = user?.role !== "socio";

  // Cargar caché local y detectar estado de red al iniciar
  useEffect(() => {
    // 1. Cargar cola de entregas offline existentes
    setPendingItems(getPendingDeliveries());

    // 2. Cargar caché de salidas si existe (para renderizar de inmediato aunque no haya internet)
    getCachedOutputsAsync().then((cached) => {
      if (cached && cached.length > 0) {
        setOutputs(prev => prev.length === 0 ? cached : prev);
        setLoading(false);
      }
    }).catch(() => {});

    // 3. Timeout de seguridad: si la señal en el celular es nula, nunca dejar al chofer bloqueado en cargando
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // 4. Detectar conexión de red
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        clearTimeout(safetyTimer);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Suscripción a Firestore (cuando hay conexión)
  useEffect(() => {
    if (!db) return;
    try {
      const q = query(collection(db, "outputs"), orderBy("date", "desc"));
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const loadedOutputs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setOutputs(loadedOutputs);
          setCachedOutputsAsync(loadedOutputs);
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore snapshot offline o no disponible:", error);
          // Si falla por estar offline, mantenemos la caché cargada
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn("Error subscribing to outputs:", err);
      setLoading(false);
    }
  }, []);

  // Conexión efectiva (considera el toggle de simulación para pruebas locales)
  const effectiveOnline = isOnline && !simulateOffline;

  // Auto-sincronización cuando se recupera internet y hay items pendientes
  useEffect(() => {
    if (!effectiveOnline || isSyncing || pendingItems.length === 0 || !db) return;

    const timer = setTimeout(() => {
      handleSyncNow();
    }, 1200);

    return () => clearTimeout(timer);
  }, [effectiveOnline, pendingItems.length]);

  // Mezclar salidas con las entregas offline que están en la cola local
  const liveOutputs = useMemo(() => {
    return mergePendingDeliveriesWithOutputs(outputs, pendingItems, getVisibleLotName);
  }, [outputs, pendingItems]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredOutputs = useMemo(() => {
    return liveOutputs.filter(out => {
      const guia = getGuiaRaw(out).toLowerCase();
      const cliente = getClienteSalida(out).toLowerCase();
      const matchesSearch = guia.includes(searchTerm.toLowerCase()) || cliente.includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const items = out.itemsDispatched || [];
      const isDelivered = items.length > 0 && items.every((i: any) => i.isClientDelivered === true);
      
      const isCorrectTab = activeTab === "pendientes" ? !isDelivered : isDelivered;
      if (!isCorrectTab) return false;

      // Si estamos en la pestaña de entregados, aplicamos el filtro por mes y año
      if (activeTab === "entregados") {
        const outDateRaw = out.date || out.fechaSalida || out.createdAt;
        let date: Date;
        if (outDateRaw?.toDate) date = outDateRaw.toDate();
        else date = new Date(outDateRaw);

        const monthMatch = date.getMonth().toString() === selectedMonth;
        const yearMatch = date.getFullYear().toString() === selectedYear;
        return monthMatch && yearMatch;
      }

      return true;
    });
  }, [liveOutputs, searchTerm, activeTab, selectedMonth, selectedYear]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current.toString(), (current - 1).toString(), (current - 2).toString()];
  }, []);

  const handleToggleSelect = (id: string) => {
    if (!canEdit) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Acción manual de sincronización
  const handleSyncNow = async () => {
    if (!db || isSyncing || pendingItems.length === 0) return;
    setIsSyncing(true);
    try {
      const result = await syncDeliveriesToFirestore(db, pendingItems, getVisibleLotName);
      const remaining = getPendingDeliveries();
      setPendingItems(remaining);

      if (result.syncedCount > 0) {
        toast({
          title: "Sincronización Exitosa ✅",
          description: `Se subieron ${result.syncedCount} entrega(s) pendientes a la nube.`,
          className: "bg-emerald-600 text-white font-bold"
        });
      }
    } catch (err: any) {
      console.error("Error al sincronizar entregas:", err);
      toast({
        variant: "destructive",
        title: "Error al Sincronizar",
        description: "No se pudo conectar con el servidor. Se reintentará automáticamente."
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Entregar un lote individual (Optimistic UI + background sync con timeout)
  const handleDeliverLot = async (outputId: string, lotNumber: string) => {
    if (!canEdit) return;
    const output = liveOutputs.find(o => o.id === outputId);
    if (!output) return;

    const itemToDeliver = (output.itemsDispatched || []).find((i: any) => getVisibleLotName(i) === lotNumber.toUpperCase());
    if (!itemToDeliver) return;

    const nowIso = new Date().toISOString();
    const currentUser = user?.displayName || user?.email || "Chofer";

    // 1. Guardar de inmediato en la cola local para no perder NADA
    const pendingItem: PendingDeliveryItem = {
      id: `${outputId}_${lotNumber}_${Date.now()}`,
      outputId,
      lotNumber,
      parentIngresoMaestro: itemToDeliver.parentIngresoMaestro || null,
      deliveredAt: nowIso,
      deliveredBy: currentUser,
    };

    addPendingDelivery(pendingItem);
    setPendingItems(getPendingDeliveries());

    // 2. Feedback visual instantáneo (0 milisegundos de espera)
    toast({
      title: "Lote Entregado ✅",
      description: effectiveOnline 
        ? "Registrado exitosamente. Sincronizando con la nube..." 
        : "Registrado en tu celular 💾. Se subirá automáticamente al volver la señal.",
      className: effectiveOnline ? "bg-emerald-600 text-white font-bold" : "bg-amber-600 text-white font-bold"
    });

    // 3. Intento de sincronización en segundo plano si parece haber conexión
    if (effectiveOnline && db) {
      try {
        await withTimeout(syncDeliveriesToFirestore(db, [pendingItem], getVisibleLotName), 3500);
        setPendingItems(getPendingDeliveries());
      } catch (err) {
        console.warn("Sincronización en segundo plano pospuesta (sin señal o timeout):", err);
      }
    }
  };

  // Entregar selección masiva (Optimistic UI + background sync con timeout)
  const handleDeliverSelected = async () => {
    if (!canEdit || selectedIds.length === 0) return;
    setProcessingBulk(true);

    const nowIso = new Date().toISOString();
    const currentUser = user?.displayName || user?.email || "Chofer";

    const itemsToAdd: PendingDeliveryItem[] = [];
    selectedIds.forEach(id => {
      const out = liveOutputs.find(o => o.id === id);
      if (out) {
        (out.itemsDispatched || []).forEach((item: any) => {
          const lotNum = getVisibleLotName(item);
          if (lotNum !== "S/L" && !item.isClientDelivered) {
            itemsToAdd.push({
              id: `${id}_${lotNum}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              outputId: id,
              lotNumber: lotNum,
              parentIngresoMaestro: item.parentIngresoMaestro || null,
              deliveredAt: nowIso,
              deliveredBy: currentUser,
            });
          }
        });
      }
    });

    // 1. Guardar en cola local
    addMultiplePendingDeliveries(itemsToAdd);
    setPendingItems(getPendingDeliveries());
    setSelectedIds([]);
    setProcessingBulk(false);

    // 2. Feedback visual
    toast({
      title: "Entregas Registradas ✅",
      description: effectiveOnline 
        ? `Se registraron ${itemsToAdd.length} lote(s). Sincronizando en la nube...` 
        : `Se guardaron ${itemsToAdd.length} lote(s) en tu celular 💾.`,
      className: effectiveOnline ? "bg-emerald-600 text-white font-bold" : "bg-amber-600 text-white font-bold"
    });

    // 3. Intento de subida en segundo plano
    if (effectiveOnline && db) {
      try {
        await withTimeout(syncDeliveriesToFirestore(db, itemsToAdd, getVisibleLotName), 5000);
        setPendingItems(getPendingDeliveries());
      } catch (err) {
        console.warn("Sincronización masiva en segundo plano pospuesta:", err);
      }
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-700 pb-20 px-3 sm:px-6">
      {/* CABECERA Y PANEL DE CONEXIÓN */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter uppercase">Confirmación de Entregas</h1>
            
            {/* DISTINTIVO DE CONEXIÓN OFFLINE / ONLINE */}
            {!effectiveOnline ? (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-xl">
                <WifiOff className="h-3.5 w-3.5" /> Modo Ruta (Sin Conexión)
              </Badge>
            ) : pendingItems.length > 0 ? (
              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-xl animate-pulse">
                <Cloud className="h-3.5 w-3.5" /> Conectado ({pendingItems.length} pendiente{pendingItems.length > 1 ? "s" : ""})
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1.5 px-3 py-1 text-xs font-black uppercase rounded-xl">
                <Wifi className="h-3.5 w-3.5" /> En Línea (Sincronizado)
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground text-sm font-medium">Recepción final del cliente basada en guías de salida.</p>
          {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
        </div>

        {/* CONTROLES DE SINCRONIZACIÓN Y PRUEBAS LOCALES */}
        <div className="flex flex-wrap items-center gap-3">
          {/* BOTÓN MANUAL DE SINCRONIZACIÓN (Si hay items pendientes) */}
          {pendingItems.length > 0 && (
            <Button
              onClick={handleSyncNow}
              disabled={isSyncing || !effectiveOnline}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs h-11 px-5 rounded-xl shadow-lg gap-2"
              title="Subir entregas pendientes guardadas localmente a la nube"
            >
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              {isSyncing ? "Sincronizando..." : `Sincronizar (${pendingItems.length})`}
            </Button>
          )}

          {/* TOGGLE PARA PROBAR LOCALMENTE MODO SIN CONEXIÓN */}
          <div className="flex items-center gap-2.5 bg-muted/40 hover:bg-muted/60 transition-colors px-3.5 py-2 rounded-xl border border-border">
            <Switch
              id="simulate-offline"
              checked={simulateOffline}
              onCheckedChange={setSimulateOffline}
            />
            <label htmlFor="simulate-offline" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none">
              {simulateOffline ? "Simulando Sin Conexión" : "Probar Sin Conexión"}
            </label>
          </div>

          {/* ACCIÓN MASIVA SI HAY SELECCIONADOS */}
          {canEdit && selectedIds.length > 0 && activeTab === "pendientes" && (
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-primary uppercase">Seleccionadas</span>
                <span className="text-xl font-black text-primary leading-tight">{selectedIds.length}</span>
              </div>
              <Button 
                onClick={handleDeliverSelected} 
                disabled={processingBulk} 
                className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs h-11 px-6 rounded-xl shadow-xl gap-2"
              >
                {processingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />} 
                Entregar Seleccionadas
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedIds([])} 
                className="h-9 w-9 text-muted-foreground hover:text-red-500 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* BANNER INFORMATIVO EN CASO DE ESTAR OFFLINE O CON PENDIENTES */}
      {!effectiveOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <WifiOff className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-800 dark:text-amber-200">
                Operando en Modo Sin Conexión (Ruta)
              </p>
              <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80">
                Puedes registrar entregas normalmente. Se guardarán en el celular y se subirán a la nube automáticamente cuando vuelva la señal.
              </p>
            </div>
          </div>
          <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-none font-bold text-xs shrink-0">
            {pendingItems.length} en cola
          </Badge>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds([]); }} className="w-full space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <TabsList className="bg-muted/30 border border-border p-1 h-11 w-full lg:w-auto grid grid-cols-2 lg:flex">
            <TabsTrigger value="pendientes" className="px-4 sm:px-8 rounded-lg font-bold text-xs uppercase gap-2"><Clock className="h-3.5 w-3.5" /> Pendientes</TabsTrigger>
            <TabsTrigger value="entregados" className="px-4 sm:px-8 rounded-lg font-bold text-xs uppercase gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Entregados</TabsTrigger>
          </TabsList>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {activeTab === "entregados" && (
              <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-xl border border-border justify-between sm:justify-start">
                <div className="flex items-center gap-1.5 px-2 text-[10px] font-black uppercase text-muted-foreground border-r border-border shrink-0">
                  <Filter className="h-3 w-3" />
                  Periodo
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-9 border-none bg-transparent text-[11px] font-bold w-28 sm:w-32 shadow-none focus:ring-0">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-9 border-none bg-transparent text-[11px] font-bold w-20 sm:w-24 shadow-none focus:ring-0">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar guía o cliente..." 
                className="pl-12 erp-input h-11" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-premium">
          <div className="bg-muted/10 p-3.5 sm:p-4 border-b border-border flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 truncate">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">
                {activeTab === "entregados" 
                  ? `Entregas de ${MESES.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
                  : "Entregas Pendientes de Confirmación"}
              </span>
            </h3>
            <Badge variant="outline" className="bg-background font-black text-primary border-border h-6 px-2.5 shrink-0 text-[11px]">
              {filteredOutputs.length}
            </Badge>
          </div>

          {/* VISTA MÓVIL (IPHONE / ANDROID): Formato ultra-compacto de 2 líneas, CERO scroll horizontal */}
          <div className="block md:hidden divide-y divide-border/60">
            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/30 mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cargando entregas...</p>
              </div>
            ) : filteredOutputs.length > 0 ? (
              filteredOutputs.map((output) => {
                const hasPendingOffline = (output.itemsDispatched || []).some((i: any) => i.isOfflinePendingSync);
                const isExpanded = !!expandedRows[output.id];
                const isSelected = selectedIds.includes(output.id);
                const items = output.itemsDispatched || [];

                return (
                  <div 
                    key={output.id} 
                    className={cn(
                      "p-3 transition-colors", 
                      isExpanded ? "bg-muted/15" : "hover:bg-muted/5",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    {/* BLOQUE DE 2 LÍNEAS (Parece una sola línea integrada y elegante) */}
                    <div 
                      onClick={() => toggleRow(output.id)} 
                      className="cursor-pointer select-none space-y-1.5"
                    >
                      {/* LÍNEA 1: Guía + Fecha + Estado + Chevron */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {canEdit && activeTab === "pendientes" && (
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0 mr-0.5">
                              <Checkbox 
                                checked={isSelected} 
                                onCheckedChange={() => handleToggleSelect(output.id)} 
                                className="h-4 w-4 border-muted-foreground/40 data-[state=checked]:bg-primary"
                              />
                            </div>
                          )}
                          <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Truck className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-black text-xs text-foreground tracking-tight truncate">
                            {getGuiaRaw(output)}
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                            • {formatFechaEC(output.date || output.fechaSalida)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasPendingOffline ? (
                            <Badge variant="outline" className="text-[8px] font-black uppercase border-none px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 gap-1 inline-flex items-center">
                              <CloudOff className="h-2.5 w-2.5" /> Offline
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={cn("text-[8px] font-black uppercase border-none px-2 py-0.5", activeTab === "entregados" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                              {activeTab === "entregados" ? 'Entregado' : 'Pendiente'}
                            </Badge>
                          )}
                          <div className="text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>

                      {/* LÍNEA 2: Cliente / Socio + Cantidad de Lotes */}
                      <div className="flex items-center justify-between gap-2 pl-8">
                        <span className="text-xs font-bold text-foreground/90 uppercase truncate flex-1 leading-snug">
                          {getClienteSalida(output)}
                        </span>
                        <Badge variant="secondary" className="text-[9px] font-black px-1.5 py-0 h-4 bg-muted/60 shrink-0 text-muted-foreground border-none">
                          {items.length} {items.length === 1 ? 'lote' : 'lotes'}
                        </Badge>
                      </div>
                    </div>

                    {/* DETALLE DESPLEGABLE EN IPHONE (Lotes para entregar con botón táctil grande) */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/60 pl-2 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <PackageCheck className="h-3.5 w-3.5 text-primary" /> Lotes de esta guía:
                        </p>
                        <div className="space-y-1.5">
                          {items.map((item: any, idx: number) => {
                            const lotVisible = getVisibleLotName(item);
                            return (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/80 gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-black text-primary truncate">{lotVisible}</span>
                                  {item.isOfflinePendingSync ? (
                                    <Badge className="text-[8px] font-black uppercase px-1.5 h-4.5 rounded-full border-none bg-amber-500/20 text-amber-700 dark:text-amber-300 gap-1">
                                      <CloudOff className="h-2 w-2" /> Pend. Sinc
                                    </Badge>
                                  ) : (
                                    <Badge className={cn("text-[8px] font-black uppercase px-1.5 h-4.5 rounded-full border-none", item.isClientDelivered ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                                      {item.isClientDelivered ? 'Entregado' : 'En Tránsito'}
                                    </Badge>
                                  )}
                                </div>

                                {canEdit && !item.isClientDelivered && (
                                  <Button 
                                    size="sm" 
                                    className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg gap-1 shadow-sm shrink-0 active:scale-95 transition-transform" 
                                    onClick={() => handleDeliverLot(output.id, lotVisible)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Entregar
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center opacity-40">
                <Truck className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs font-black uppercase">Sin registros en este periodo</p>
                {!effectiveOnline && (
                  <p className="text-[11px] text-amber-600 font-bold mt-1">
                    Abre la app una vez con internet para descargar las guías del día en tu celular.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* VISTA ESCRITORIO (PANTALLAS MEDIANAS Y GRANDES) */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b border-border hover:bg-transparent">
                  {canEdit && activeTab === "pendientes" && <TableHead className="w-12 pl-6"><Checkbox checked={selectedIds.length === filteredOutputs.length && filteredOutputs.length > 0} onCheckedChange={() => { if(selectedIds.length === filteredOutputs.length) setSelectedIds([]); else setSelectedIds(filteredOutputs.map(o => o.id)); }} className="border-border data-[state=checked]:bg-primary"/></TableHead>}
                  <TableHead className="w-12 text-center"></TableHead>
                  <TableHead className="text-[11px] font-black uppercase py-5">Guía de Salida</TableHead>
                  <TableHead className="text-[11px] font-black uppercase">Socio Industrial</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-center">Fecha Salida</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-center">Lotes</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-right pr-8">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20"/></TableCell></TableRow>
                ) : filteredOutputs.length > 0 ? filteredOutputs.map((output) => {
                  const hasPendingOffline = (output.itemsDispatched || []).some((i: any) => i.isOfflinePendingSync);
                  return (
                    <React.Fragment key={output.id}>
                      <TableRow className={cn("border-b border-border hover:bg-muted/20 transition-colors group", expandedRows[output.id] && "bg-muted/10", selectedIds.includes(output.id) && "bg-primary/5")}>
                        {canEdit && activeTab === "pendientes" && <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(output.id)} onCheckedChange={() => handleToggleSelect(output.id)}/></TableCell>}
                        <TableCell className="text-center" onClick={() => toggleRow(output.id)}><button className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-all">{expandedRows[output.id] ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}</button></TableCell>
                        <TableCell onClick={() => toggleRow(output.id)} className="cursor-pointer"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Truck className="h-4.5 w-4.5" /></div><span className="font-black text-foreground">{getGuiaRaw(output)}</span></div></TableCell>
                        <TableCell onClick={() => toggleRow(output.id)} className="cursor-pointer"><span className="font-bold text-foreground uppercase truncate block max-w-[250px]">{getClienteSalida(output)}</span></TableCell>
                        <TableCell onClick={() => toggleRow(output.id)} className="text-center cursor-pointer"><span className="text-xs font-medium text-muted-foreground">{formatFechaEC(output.date || output.fechaSalida)}</span></TableCell>
                        <TableCell onClick={() => toggleRow(output.id)} className="text-center cursor-pointer"><Badge variant="outline" className="bg-muted/50 border-none font-black text-primary">{(output.itemsDispatched || []).length}</Badge></TableCell>
                        <TableCell className="text-right pr-8" onClick={() => toggleRow(output.id)}>
                          {hasPendingOffline ? (
                            <Badge variant="outline" className="text-[9px] font-black uppercase border-none px-3 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 gap-1 inline-flex items-center">
                              <CloudOff className="h-3 w-3" /> Entregado (Offline)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase border-none px-3 py-1", activeTab === "entregados" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                              {activeTab === "entregados" ? 'Entregado' : 'Pendiente'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedRows[output.id] && (
                        <TableRow className="bg-muted/5">
                          <TableCell colSpan={7} className="p-0 border-b border-border">
                            <div className="p-8 space-y-6">
                              <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Detalle de Lotes</h4>
                              <div className="rounded-2xl border border-border bg-background overflow-hidden">
                                <Table>
                                  <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[9px] font-black uppercase py-3 pl-6">Lote</TableHead><TableHead className="text-[9px] font-black uppercase text-center">Estado</TableHead><TableHead className="text-[9px] font-black uppercase text-right pr-6">Acción</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                    {(output.itemsDispatched || []).map((item: any, idx: number) => {
                                      const lotVisible = getVisibleLotName(item);
                                      return (
                                        <TableRow key={idx} className="border-b border-border last:border-0">
                                          <TableCell className="pl-6 font-black text-xs text-primary">{lotVisible}</TableCell>
                                          <TableCell className="text-center">
                                            {item.isOfflinePendingSync ? (
                                              <Badge className="text-[8px] font-black uppercase px-2 h-5 rounded-full border-none bg-amber-500/20 text-amber-700 dark:text-amber-300 gap-1">
                                                <CloudOff className="h-2.5 w-2.5" /> Pendiente Sinc
                                              </Badge>
                                            ) : (
                                              <Badge className={cn("text-[8px] font-black uppercase px-2 h-5 rounded-full border-none", item.isClientDelivered ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                                                {item.isClientDelivered ? 'Entregado' : 'En Tránsito'}
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right pr-6">
                                            {canEdit && !item.isClientDelivered && (
                                              <Button 
                                                size="sm" 
                                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg gap-1.5" 
                                                onClick={() => handleDeliverLot(output.id, lotVisible)}
                                              >
                                                <CheckCircle2 className="h-3 w-3" /> Entregar
                                              </Button>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                }) : (
                  <TableRow><TableCell colSpan={7} className="h-64 text-center opacity-20"><Truck className="h-16 w-16 mx-auto mb-4"/><p className="text-sm font-black uppercase">Sin registros en este periodo</p></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

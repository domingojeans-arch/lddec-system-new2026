
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Search, 
  History, 
  CheckCircle2, 
  Loader2, 
  FlaskConical,
  Beaker,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Database,
  Layers,
  Scale,
  Package,
  Calendar as CalendarIcon,
  Edit3,
  X,
  Save,
  ShieldCheck,
  ShieldAlert,
  Zap,
  ArrowRight,
  Info,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Settings2,
  Power,
  PowerOff,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Timestamp, 
  getDoc,
  where,
  getDocs,
  limit,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { toDate } from "@/lib/toDate";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface PesadaItem {
  id: string;
  chemicalId: string;
  procesoTecnico: string;
  quantity: string;
  unit: string;
  suggestion?: string;
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

function getVisibleLotNumber(lot: any): string {
  if (!lot) return "S/L";
  const candidates = [lot.lotNumber, lot.numeroLote, lot.loteId, lot.lote, lot.loteNumero, lot.numLote, lot.id];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined") return s.toUpperCase();
  }
  return "S/L";
}

function normalizeDate(fecha: any): Date {
  if (!fecha) return new Date();
  if (fecha instanceof Date) return fecha;
  if (typeof fecha.toDate === 'function') return fecha.toDate();
  if (typeof fecha === 'string' || typeof fecha === 'number') {
    const d = new Date(fecha);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export default function ChemicalInventoryPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingKardex, setLoadingKardex] = useState(false);
  const initialBalancesCalculated = useRef<Record<string, boolean>>({});
  
  const isAdmin = user?.role === "admin";
  const isReadOnly = user?.role === "socio";
  const isBodegueroQuimicos = user?.role === "bodega_quimicos";
  const canManagePurchases = user?.role === "admin" || user?.role === "produccion";

  const [chemicals, setChemicals] = useState<any[]>([]);
  const [kardex, setKardex] = useState<any[]>([]);
  const [chemMaestro, setChemMaestro] = useState<any[]>([]);
  
  // Estados de consulta mensual
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const activeMonthTab = useMemo(() => {
    const date = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
    return format(date, "MMMM yyyy", { locale: es });
  }, [selectedMonth, selectedYear]);

  const [tableSearch, setTableSearch] = useState("");
  const [chemicalFilter, setChemicalFilter] = useState("all");

  const [editingInitialId, setEditingInitialId] = useState<string | null>(null);
  const [tempInitialValue, setTempInitialValue] = useState<string>("");
  const [isSavingInitial, setIsSavingInitial] = useState(false);

  // Estados para gestión de catálogo
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [newChemicalName, setNewChemicalName] = useState("");
  const [isSavingNewChem, setIsSavingNewChemical] = useState(false);

  // Estados para modo edición desde Kárdex
  const [editingKardexId, setEditingKardexId] = useState<string | null>(null);
  
  // Estado para eliminación del Kárdex
  const [isDeleteKardexOpen, setIsDeleteKardexOpen] = useState(false);
  const [kardexToDelete, setKardexToDelete] = useState<any>(null);

  // Estados de Ordenamiento
  const [sortField, setSortField] = useState<"fecha" | "order">("order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [purchaseData, setPurchaseData] = useState({ 
    name: "", 
    qty: "", 
    unit: "g", 
    invoice: "", 
    fecha: new Date().toISOString().split('T')[0] 
  });

  const [pesadaHeader, setPesadaHeader] = useState({ 
    orderType: "NORMAL",
    order: "", 
    lotSearch: "", 
    clientRef: "", 
    lotQty: 0,
    orderWeight: "",
    fecha: new Date().toISOString().split('T')[0]
  });
  const [lotFound, setLotFound] = useState(false);
  const [isSearchingLot, setIsSearchingLot] = useState(false);
  const [pesadaItems, setPesadaItems] = useState<PesadaItem[]>([
    { id: Math.random().toString(36).substr(2, 9), chemicalId: "", procesoTecnico: "", quantity: "", unit: "g" }
  ]);
  const [processing, setProcessing] = useState(false);



  /**
   * MOTOR DE CARGA REAL DESDE FIRESTORE
   */
  useEffect(() => {
    setMounted(true);
    if (!db) return;

    const unsubs: any[] = [];
    
    // 1. Cargar Catálogo de Químicos Reales
    unsubs.push(
      onSnapshot(collection(db, "quimicos_stock"), (snap) => {
        setChemicals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
    );

    // 2. Cargar Procesos Maestro Reales
    unsubs.push(
      onSnapshot(collection(db, "quimicos_procesos_maestro"), (snap) => {
        setChemMaestro(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
    );
    
    setLoading(false);
    return () => unsubs.forEach(u => u());
  }, []);

  const loadKardexData = useCallback(async () => {
    if (!db) return;
    setLoadingKardex(true);
    try {
      const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
      const start = Timestamp.fromDate(startOfMonth(targetDate));
      const end = Timestamp.fromDate(endOfMonth(targetDate));

      const q = query(
        collection(db, "quimicos_kardex"),
        where("fecha", ">=", start),
        where("fecha", "<=", end)
      );

      const snap = await getDocs(q);
      const kData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Ordenar local
      kData.sort((a: any, b: any) => {
        const timeA = normalizeDate(a.fecha || a.createdAt).getTime();
        const timeB = normalizeDate(b.fecha || b.createdAt).getTime();
        return timeB - timeA;
      });

      setKardex(kData);

      // HERENCIA DE SALDOS INICIALES
      // Si el químico no tiene saldo inicial para este mes, lo calculamos buscando el mes anterior.
      const curKey = `${selectedYear}-${selectedMonth}`;
      if (chemicals.length > 0 && !initialBalancesCalculated.current[curKey]) {
        initialBalancesCalculated.current[curKey] = true;
        
        let prevYear = parseInt(selectedYear);
        let prevMonth = parseInt(selectedMonth) - 1;
        if (prevMonth < 0) {
          prevMonth = 11;
          prevYear -= 1;
        }
        const prevKey = `${prevYear}-${prevMonth}`;

        for (const chem of chemicals) {
          const saldos = chem.saldosIniciales || {};
          if (saldos[curKey] === undefined) {
            // No existe saldo inicial para el mes actual.
            // Si tampoco hay saldo para el mes anterior, lo dejamos en 0.
            if (saldos[prevKey] !== undefined) {
              // Necesitamos buscar el Kardex del mes anterior para este químico
              const prevDate = new Date(prevYear, prevMonth, 1);
              const pStart = Timestamp.fromDate(startOfMonth(prevDate));
              const pEnd = Timestamp.fromDate(endOfMonth(prevDate));
              
              const qPrev = query(
                collection(db, "quimicos_kardex"),
                where("chemicalId", "==", chem.id),
                where("fecha", ">=", pStart),
                where("fecha", "<=", pEnd)
              );
              const pSnap = await getDocs(qPrev);
              
              let runningGrams = Number(saldos[prevKey]);
              pSnap.docs.forEach(docSnap => {
                const m = docSnap.data();
                const qty = Number(m.cant || 0);
                const qtyG = (m.unit === "kg" || m.unit === "kilogramos") ? qty * 1000 : qty;
                if (m.tipo.includes("INGRESO")) runningGrams += qtyG;
                else runningGrams -= qtyG;
              });

              // Guardar el nuevo saldo inicial calculado
              await updateDoc(doc(db, "quimicos_stock", chem.id), {
                [`saldosIniciales.${curKey}`]: runningGrams
              });
            } else {
              // Inicializar en 0 si no hay historial
              await updateDoc(doc(db, "quimicos_stock", chem.id), {
                [`saldosIniciales.${curKey}`]: 0
              });
            }
          }
        }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKardex(false);
    }
  }, [selectedMonth, selectedYear, chemicals]);

  useEffect(() => {
    if (chemicals.length > 0) {
      loadKardexData();
    }
  }, [selectedMonth, selectedYear, loadKardexData]);

  // 2. Calcular balances dinámicos para el mes cargado
  const runningBalancesMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (kardex.length === 0) return map;

    const byChemical: Record<string, any[]> = {};
    kardex.forEach(m => {
      const name = (m.quimico || "").trim().toUpperCase();
      if (!byChemical[name]) byChemical[name] = [];
      byChemical[name].push(m);
    });

    Object.keys(byChemical).forEach(chemName => {
      const chemData = chemicals.find(c => (c.chemicalName || "").trim().toUpperCase() === chemName);
      let running = Number(chemData?.saldosIniciales?.[`${selectedYear}-${selectedMonth}`] || 0);

      const sorted = [...byChemical[chemName]].sort((a, b) => {
        const timeA = normalizeDate(a.fecha || a.createdAt).getTime();
        const timeB = normalizeDate(b.fecha || b.createdAt).getTime();
        return timeA - timeB;
      });

      sorted.forEach(m => {
        const qty = Number(m.cant || 0);
        const qtyG = (m.unit === "kg" || m.unit === "kilogramos") ? qty * 1000 : qty;
        if (m.tipo.includes("INGRESO")) running += qtyG;
        else running -= qtyG;
        map[m.id] = running;
      });
    });

    return map;
  }, [kardex, chemicals, selectedYear, selectedMonth]);

  // 3. Resúmenes mensuales para las tarjetas de balance
  const monthlySummaries = useMemo(() => {
    if (chemicals.length === 0) return [];
    
    return chemicals
      .filter(c => c.active !== false)
      .map(chem => {
        const chemName = (chem.chemicalName || "").trim().toUpperCase();
        const monthMovements = kardex.filter(m => (m.quimico || "").trim().toUpperCase() === chemName);

        const getSumGrams = (mList: any[], types: string[]) => 
          mList.filter(m => types.includes(m.tipo))
               .reduce((acc, m) => {
                 const val = Number(m.cant || 0);
                 const valG = (m.unit === "kg" || m.unit === "kilogramos") ? val * 1000 : val;
                 return acc + valG;
               }, 0);

        const compraMesG = getSumGrams(monthMovements, ["INGRESO", "INGRESO_AJUSTE"]);
        const consumoMesG = getSumGrams(monthMovements, ["SALIDA", "SALIDA_AJUSTE"]);
        
        const saldoInicialMesG = Number(chem.saldosIniciales?.[`${selectedYear}-${selectedMonth}`] || 0);
        const disponibleMesG = saldoInicialMesG + compraMesG - consumoMesG;

        return { 
          id: chem.id, 
          name: chemName, 
          saldoInicialMesKg: saldoInicialMesG / 1000, 
          compraMesKg: compraMesG / 1000, 
          consumoMesKg: consumoMesG / 1000, 
          disponibleMesKg: disponibleMesG / 1000 
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [chemicals, kardex, selectedYear, selectedMonth]);

  const generateAutoID = async (type: "LAVADO_MAQUINA" | "MUESTRA") => {
    const prefix = type === "LAVADO_MAQUINA" ? "LAV-MAQ-" : "MUE-";
    try {
      const q = query(collection(db, "quimicos_kardex"), where("orderType", "==", type));
      const snap = await getDocs(q);
      const nextNum = snap.size + 1;
      return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    } catch (e) {
      return `${prefix}0001`;
    }
  };

  const handleOrderTypeChange = async (type: string) => {
    let newHeader = { ...pesadaHeader, orderType: type, order: "", clientRef: "", lotSearch: "", lotQty: 0 };
    if (type === "LAVADO_MAQUINA" || type === "MUESTRA") {
      const autoId = await generateAutoID(type as any);
      newHeader.order = autoId;
      newHeader.clientRef = "LABORATORIO DEL DENIM";
      newHeader.lotSearch = type === "LAVADO_MAQUINA" ? "LAVADO" : "MUESTRA";
      setLotFound(true);
    } else if (type === "REPROCESO") {
      newHeader.clientRef = "REPROCESO";
      newHeader.lotSearch = "REPROCESO";
      setLotFound(true);
    } else setLotFound(false);
    setPesadaHeader(newHeader);
  };


  const handleStartEditInitial = (id: string, currentKg: number) => {
    if (isReadOnly) return;
    setEditingInitialId(id);
    setTempInitialValue(currentKg.toString());
  };

  const handleSaveInitialBalance = async (id: string) => {
    const valKg = parseFloat(tempInitialValue);
    if (isNaN(valKg)) return;
    setIsSavingInitial(true);
    
    try {
      await updateDoc(doc(db, "quimicos_stock", id), {
        [`saldosIniciales.${selectedYear}-${selectedMonth}`]: valKg * 1000
      });
      toast({ title: "Saldo Inicial Actualizado" });
      setEditingInitialId(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    } finally {
      setIsSavingInitial(false);
    }
  };

  const handleSearchLot = async () => {
    const term = pesadaHeader.lotSearch.trim().toUpperCase();
    if (!term) return;
    setIsSearchingLot(true);
    try {
      const q = query(collection(db, "entries"), where("loteIdList", "array-contains", term), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const entryData = snap.docs[0].data();
        const lot = (entryData.lots || entryData.lotes || []).find((l: any) => getVisibleLotNumber(l) === term);
        setPesadaHeader(prev => ({ ...prev, clientRef: (entryData.clientName || "SOCIO").toUpperCase(), lotQty: lot?.cantidadConfirmada || lot?.quantity || 0 }));
        setLotFound(true);
      } else {
        toast({ variant: "destructive", title: "Lote no encontrado" });
        setLotFound(false);
      }
    } catch (e) { console.error(e); } finally { setIsSearchingLot(false); }
  };

  const handleRegisterPurchase = async () => {
    if (isReadOnly || isBodegueroQuimicos) return;
    if (!purchaseData.name || !purchaseData.qty || !purchaseData.fecha) return;
    setProcessing(true);
    
    try {
      const targetChem = chemicals.find(c => c.chemicalName === purchaseData.name);
      if (!targetChem) { setProcessing(false); return; }
      const qty = parseFloat(purchaseData.qty);
      const qtyGrams = purchaseData.unit === "kg" ? qty * 1000 : qty;

      const newKardex = { 
        fecha: Timestamp.fromDate(new Date(purchaseData.fecha + "T12:00:00")), 
        tipo: "INGRESO", 
        chemicalId: targetChem.id, 
        quimico: targetChem.chemicalName.toUpperCase(), 
        cant: qtyGrams, 
        unit: "g", 
        lote: purchaseData.invoice.toUpperCase() || "S/N", 
        orderType: "COMPRA",
        createdAt: serverTimestamp(), 
        registradoPor: user?.displayName || user?.email || "Usuario"
      };
      
      await addDoc(collection(db, "quimicos_kardex"), newKardex);
      toast({ title: "Compra Registrada" });
      setPurchaseData({ ...purchaseData, qty: "", invoice: "" });
      loadKardexData();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar" });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPesada = async () => {
    if (isReadOnly) return;
    const hasInvalidQty = pesadaItems.some(i => !i.quantity || parseFloat(i.quantity) <= 0);
    if (!pesadaHeader.order || pesadaItems.some(i => !i.chemicalId || !i.procesoTecnico) || hasInvalidQty || !lotFound) {
      toast({ variant: "destructive", title: "Datos incompletos" });
      return;
    }

    setProcessing(true);
    
    try {
      if (!editingKardexId) {
        const qDup = query(collection(db, "quimicos_kardex"), where("order", "==", pesadaHeader.order.toUpperCase()));
        const snapDup = await getDocs(qDup);
        if (!snapDup.empty) {
          toast({ variant: "destructive", title: "Orden Duplicada" });
          setProcessing(false);
          return;
        }
      }

      const pesadaDate = pesadaHeader.fecha ? Timestamp.fromDate(new Date(pesadaHeader.fecha + "T12:00:00")) : serverTimestamp();

      if (editingKardexId) {
        const item = pesadaItems[0];
        const targetChem = chemicals.find(c => c.id === item.chemicalId);
        const qtyRaw = parseFloat(item.quantity);
        const qtyGrams = item.unit === "kg" ? qtyRaw * 1000 : qtyRaw;

        await updateDoc(doc(db, "quimicos_kardex", editingKardexId), {
          fecha: pesadaDate,
          quimico: targetChem.chemicalName.toUpperCase(),
          chemicalId: item.chemicalId,
          order: pesadaHeader.order.toUpperCase(),
          orderType: pesadaHeader.orderType,
          tipoSalida: pesadaHeader.orderType === "NORMAL" ? "produccion" : (pesadaHeader.orderType === "REPROCESO" ? "reproceso" : (pesadaHeader.orderType === "LAVADO_MAQUINA" ? "lavado_maquina" : "muestras")),
          procesoTecnico: item.procesoTecnico,
          pesoOrden: parseFloat(pesadaHeader.orderWeight) || 0,
          cant: qtyGrams,
          unit: "g",
          lote: pesadaHeader.lotSearch.toUpperCase(),
          updatedAt: serverTimestamp(),
          lastEditedBy: user?.displayName || user?.email || "Usuario"
        });
        toast({ title: "Movimiento Actualizado" });
        handleCancelEdit();
      } else {
        for (const item of pesadaItems) {
          const qtyRaw = parseFloat(item.quantity) || 0;
          const qtyGrams = item.unit === "kg" ? qtyRaw * 1000 : qtyRaw;
          const targetChem = chemicals.find(c => c.id === item.chemicalId);
          
          await addDoc(collection(db, "quimicos_kardex"), { 
            fecha: pesadaDate, 
            tipo: "SALIDA", 
            orderType: pesadaHeader.orderType,
            tipoSalida: pesadaHeader.orderType === "NORMAL" ? "produccion" : (pesadaHeader.orderType === "REPROCESO" ? "reproceso" : (pesadaHeader.orderType === "LAVADO_MAQUINA" ? "lavado_maquina" : "muestras")),
            chemicalId: item.chemicalId, 
            quimico: targetChem?.chemicalName.toUpperCase() || "UNKNOWN", 
            order: pesadaHeader.order.toUpperCase(), 
            procesoTecnico: item.procesoTecnico, 
            pesoOrden: parseFloat(pesadaHeader.orderWeight) || 0, 
            cant: qtyGrams, 
            unit: "g", 
            lote: pesadaHeader.lotSearch.toUpperCase(), 
            clientName: pesadaHeader.clientRef,
            createdAt: serverTimestamp(), 
            registradoPor: user?.displayName || user?.email || "Usuario"
          });
        }
        toast({ title: "Pesada Confirmada" });
        setPesadaHeader({ orderType: "NORMAL", order: "", lotSearch: "", clientRef: "", lotQty: 0, orderWeight: "", fecha: new Date().toISOString().split('T')[0] });
        setPesadaItems([{ id: Math.random().toString(36).substr(2, 9), chemicalId: "", procesoTecnico: "", quantity: "", unit: "g" }]);
        setLotFound(false);
      }
      loadKardexData();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setProcessing(false);
    }
  };

  const handleEditKardex = (item: any) => {
    if (isReadOnly) return;
    setEditingKardexId(item.id);
    setPesadaHeader({ orderType: item.orderType || "NORMAL", order: item.order || "", lotSearch: item.lote || "", clientRef: item.clientName || "SOCIO", lotQty: item.lotQty || 0, orderWeight: String(item.pesoOrden || ""), fecha: item.fecha ? normalizeDate(item.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] });
    setPesadaItems([{ id: Math.random().toString(36).substr(2, 9), chemicalId: item.chemicalId, procesoTecnico: item.procesoTecnico || "", quantity: String(item.cant), unit: "g" }]);
    setLotFound(true);
    document.getElementById("pesada-form-anchor")?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingKardexId(null);
    setPesadaHeader({ orderType: "NORMAL", order: "", lotSearch: "", clientRef: "", lotQty: 0, orderWeight: "", fecha: new Date().toISOString().split('T')[0] });
    setPesadaItems([{ id: Math.random().toString(36).substr(2, 9), chemicalId: "", procesoTecnico: "", quantity: "", unit: "g" }]);
    setLotFound(false);
  };
  
  const handleDeleteKardex = async () => {
    if (!kardexToDelete || isReadOnly) return;
    setProcessing(true);
    try {
      await deleteDoc(doc(db, "quimicos_kardex", kardexToDelete.id));
      toast({ title: "Éxito", description: "Movimiento eliminado" });
      setIsDeleteKardexOpen(false);
      setKardexToDelete(null);
      loadKardexData();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveNewChemical = async () => {
    if (!newChemicalName.trim()) return;
    setIsSavingNewChemical(true);
    const nameUpper = newChemicalName.trim().toUpperCase();
    
    try {
      const q = query(collection(db, "quimicos_stock"), where("chemicalName", "==", nameUpper));
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Error", description: "Ya existe un insumo con ese nombre." }); 
        setIsSavingNewChemical(false);
        return; 
      }
      
      await addDoc(collection(db, "quimicos_stock"), {
        chemicalName: nameUpper,
        active: true,
        saldosIniciales: {},
        createdAt: serverTimestamp()
      });
      
      setNewChemicalName("");
      toast({ title: "Insumo Registrado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar" });
    } finally {
      setIsSavingNewChemical(false);
      setIsCatalogModalOpen(false);
    }
  };

  const handleToggleChemicalStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "quimicos_stock", id), {
        active: !currentStatus
      });
      toast({ title: "Estado Actualizado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar estado" });
    }
  };

  const addPesadaItem = () => setPesadaItems([...pesadaItems, { id: Math.random().toString(36).substr(2, 9), chemicalId: "", procesoTecnico: "", quantity: "", unit: "g" }]);
  const removePesadaItem = (id: string) => pesadaItems.length > 1 && setPesadaItems(pesadaItems.filter(i => i.id !== id));
  const updatePesadaItem = (id: string, updates: Partial<PesadaItem>) => setPesadaItems(pesadaItems.map(item => item.id === id ? { ...item, ...updates } : item));

  const uniqueChemicals = useMemo(() => chemicals.filter(c => c.active !== false).sort((a, b) => a.chemicalName.localeCompare(b.chemicalName, 'es')), [chemicals]);

  const processesByChemicalId = useMemo(() => {
    const map: Record<string, string[]> = {};
    chemicals.forEach(c => {
      const pList = chemMaestro.filter(m => m.sustancia === c.chemicalName.toUpperCase()).map(m => m.proceso);
      map[c.id] = Array.from(new Set(pList));
    });
    return map;
  }, [chemicals, chemMaestro]);
  
  const handleSort = (field: "fecha" | "order") => {
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("asc"); }
  };

  const SortIcon = ({ field }: { field: "fecha" | "order" }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const filteredKardex = useMemo(() => {
    let list = [...kardex];
    if (chemicalFilter !== "all") list = list.filter(m => (m.quimico || "").trim().toUpperCase() === chemicalFilter.trim().toUpperCase());
    if (tableSearch) {
      const s = tableSearch.toLowerCase();
      list = list.filter(m => m.quimico?.toLowerCase().includes(s) || m.lote?.toLowerCase().includes(s) || m.order?.toLowerCase().includes(s));
    }
    return list.sort((a, b) => {
      if (sortField === "fecha") {
        const timeA = normalizeDate(a.fecha || a.createdAt).getTime();
        const timeB = normalizeDate(b.fecha || b.createdAt).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }
      if (sortField === "order") {
        const valA = String(a.order || "");
        const valB = String(b.order || "");
        return sortDirection === "asc" ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
      }
      return 0;
    });
  }, [kardex, tableSearch, chemicalFilter, sortField, sortDirection]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current.toString(), (current - 1).toString(), (current - 2).toString()];
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="space-y-1">
        <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">Bodega de Químicos</h1>
        <p className="text-muted-foreground text-sm font-medium">Gestión mensual de insumos y consumos operativos (Motor v1.2).</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
      </div>

      {!isReadOnly && (
        <div className="grid grid-cols-1 gap-10 items-start">
          {canManagePurchases && user?.role !== "bodega" && user?.role !== "bodega_quimicos" && (
            <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card lg:col-span-12">
              <CardHeader className="bg-primary/5 border-b p-6 flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Package className="h-5 w-5 text-primary" /> A. COMPRA DE INSUMOS</CardTitle>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsCatalogModalOpen(true)}
                    className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 gap-2"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Gestionar Catálogo
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Insumo Químico</Label>
                    <Select value={purchaseData.name} onValueChange={v => setPurchaseData({...purchaseData, name: v})}>
                      <SelectTrigger className="erp-input h-11 font-bold flex-1"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-2xl">
                        {uniqueChemicals.map(c => <SelectItem key={c.id} value={c.chemicalName} className="uppercase font-bold text-xs">{c.chemicalName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Cantidad</Label><Input type="number" step="0.01" value={purchaseData.qty} onChange={e => setPurchaseData({...purchaseData, qty: e.target.value})} className="erp-input h-11 font-black text-emerald-600" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Unidad</Label>
                      <Select value={purchaseData.unit} onValueChange={v => setPurchaseData({...purchaseData, unit: v})}>
                        <SelectTrigger className="erp-input h-11 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl"><SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Factura</Label><Input value={purchaseData.invoice} onChange={e => setPurchaseData({...purchaseData, invoice: e.target.value.toUpperCase()})} className="erp-input h-11" /></div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1">Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild><Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs rounded-xl"><CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />{purchaseData.fecha ? format(parseISO(purchaseData.fecha), "dd/MM/yyyy") : "Fecha"}</Button></PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none z-[100]"><Calendar mode="single" selected={parseISO(purchaseData.fecha)} onSelect={d => setPurchaseData({...purchaseData, fecha: d ? format(d, "yyyy-MM-dd") : ""})} locale={es} initialFocus /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button onClick={handleRegisterPurchase} disabled={processing} className="w-full bg-primary text-white font-black uppercase h-12 rounded-xl mt-2">{processing ? <Loader2 className="h-5 w-5 animate-spin" /> : "REGISTRAR COMPRA"}</Button>
              </CardContent>
            </Card>
          )}

          <Card id="pesada-form-anchor" className={cn("scroll-mt-24 rounded-[2.5rem] border shadow-premium overflow-hidden bg-card lg:col-span-12 transition-all w-full", editingKardexId ? "border-amber-500 shadow-amber-500/10" : "border-border")}>
              <CardHeader className={cn("border-b p-6 flex flex-row items-center justify-between", editingKardexId ? "bg-amber-500/10" : "bg-amber-500/5")}>
                <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                  <FlaskConical className="h-5 w-5 text-amber-600" /> 
                  {editingKardexId ? "EDITANDO MOVIMIENTO" : "B. SALIDA / PESADA (PRODUCCIÓN)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 lg:p-10 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 gap-4 lg:gap-6">
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label className="text-[10px] font-black uppercase text-primary ml-1">Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild><Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs rounded-xl"><CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />{pesadaHeader.fecha ? format(parseISO(pesadaHeader.fecha), "dd/MM/yyyy") : "Fecha"}</Button></PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none z-[100]"><Calendar mode="single" selected={pesadaHeader.fecha ? parseISO(pesadaHeader.fecha) : undefined} onSelect={d => setPesadaHeader({...pesadaHeader, fecha: d ? format(d, "yyyy-MM-dd") : ""})} locale={es} initialFocus /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5 xl:col-span-3">
                    <Label className="text-[10px] font-black uppercase text-primary ml-1">TIPO DE SALIDA</Label>
                    <Select value={pesadaHeader.orderType} onValueChange={handleOrderTypeChange}>
                      <SelectTrigger className="erp-input h-11 font-black text-[11px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="NORMAL" className="font-bold text-xs">PRODUCCIÓN NORMAL</SelectItem>
                        <SelectItem value="REPROCESO" className="font-bold text-xs">REPROCESO</SelectItem>
                        <SelectItem value="LAVADO_MAQUINA" className="font-bold text-xs">LAVADO DE MÁQUINA</SelectItem>
                        <SelectItem value="MUESTRA" className="font-bold text-xs">MUESTRAS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={cn("space-y-1.5", pesadaHeader.orderType === "REPROCESO" ? "xl:col-span-5" : "xl:col-span-2")}>
                    <Label className="text-[10px] font-black uppercase text-primary ml-1">N° ORDEN / CONTROL</Label>
                    <Input className="erp-input h-11 font-black" value={pesadaHeader.order} onChange={e => setPesadaHeader({...pesadaHeader, order: e.target.value.toUpperCase()})} readOnly={pesadaHeader.orderType === "LAVADO_MAQUINA" || pesadaHeader.orderType === "MUESTRA"} />
                  </div>
                  {pesadaHeader.orderType !== "REPROCESO" && (
                    <div className="space-y-1.5 xl:col-span-3">
                      <Label className="text-[10px] font-black uppercase text-primary ml-1">ID Lote Planta</Label>
                      <div className="flex gap-1.5">
                        <Input className="erp-input h-11 font-black flex-1" placeholder="Lote" value={pesadaHeader.lotSearch} onChange={e => setPesadaHeader({...pesadaHeader, lotSearch: e.target.value.toUpperCase()})} readOnly={pesadaHeader.orderType !== "NORMAL"} />
                        <Button onClick={handleSearchLot} disabled={isSearchingLot || pesadaHeader.orderType !== "NORMAL"} size="icon" className="h-11 w-11 shrink-0 bg-amber-500 rounded-xl">
                          {isSearchingLot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label className="text-[10px] font-black uppercase text-primary ml-1">Peso Orden (Kg)</Label>
                    <Input type="number" step="0.01" className="erp-input h-11 font-black text-amber-600" value={pesadaHeader.orderWeight} onChange={e => setPesadaHeader({...pesadaHeader, orderWeight: e.target.value})}/>
                  </div>
                </div>

                {lotFound && (
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border flex items-center justify-between animate-in zoom-in duration-300">
                    <div><p className="text-[9px] font-black text-muted-foreground uppercase">Socio / Referencia</p><p className="font-bold text-xs uppercase">{pesadaHeader.clientRef}</p></div>
                    {pesadaHeader.orderType === "NORMAL" && (
                      <div className="text-right"><p className="text-[9px] font-black text-muted-foreground uppercase">Prendas en Lote</p><p className="font-black text-amber-600 text-lg">{pesadaHeader.lotQty}</p></div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Insumos de la Mezcla</Label>
                  </div>
                  <div className="space-y-4">
                    {pesadaItems.map((item) => {
                      const availableProcesses = item.chemicalId ? (processesByChemicalId[item.chemicalId] || []) : [];
                      return (
                        <div key={item.id} className="p-5 md:p-6 bg-muted/10 rounded-[1.5rem] border border-border/80 space-y-4 animate-in slide-in-from-right-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 items-end">
                            <div className="lg:col-span-5 xl:col-span-4 space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Sustancia</Label>
                              <Select value={item.chemicalId} onValueChange={v => updatePesadaItem(item.id, { chemicalId: v, procesoTecnico: "" })}>
                                <SelectTrigger className="h-11 bg-background border-border font-black text-xs rounded-xl shadow-sm"><SelectValue placeholder="Elegir Químico..." /></SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl max-h-[250px]">{uniqueChemicals.map(c => <SelectItem key={c.id} value={c.id} className="text-xs uppercase font-bold">{c.chemicalName}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="lg:col-span-4 xl:col-span-4 space-y-1.5">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Proceso Técnico</Label>
                              <Select disabled={!item.chemicalId} value={item.procesoTecnico} onValueChange={v => updatePesadaItem(item.id, { procesoTecnico: v })}>
                                <SelectTrigger className="h-11 bg-background border-border font-black text-xs rounded-xl shadow-sm"><SelectValue placeholder="Proceso..." /></SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl">{availableProcesses.map(p => <SelectItem key={p} value={p} className="text-xs uppercase font-bold">{p}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="lg:col-span-3 xl:col-span-4 flex gap-3">
                              <div className="flex-1 space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Cant. ({item.unit})</Label>
                                <Input type="number" step="0.01" value={item.quantity} onChange={e => updatePesadaItem(item.id, { quantity: e.target.value })} className="h-11 text-center font-black text-primary bg-background border-border rounded-xl shadow-sm" />
                              </div>
                              <div className="w-20 space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-transparent ml-1">.</Label>
                                <Select value={item.unit} onValueChange={v => updatePesadaItem(item.id, { unit: v })}>
                                  <SelectTrigger className="h-11 bg-background border-border font-black text-[10px] rounded-xl shadow-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent className="rounded-2xl"><SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem></SelectContent>
                                </Select>
                              </div>
                              {!editingKardexId && (
                                <div className="space-y-1.5">
                                  <Label className="text-[9px] font-black uppercase text-transparent ml-1">.</Label>
                                  <Button variant="ghost" size="icon" onClick={() => removePesadaItem(item.id)} className="h-11 w-11 text-destructive hover:bg-red-50 rounded-xl bg-red-50/50 shrink-0"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!editingKardexId && (
                    <div className="flex justify-center mt-2">
                      <Button variant="ghost" size="sm" onClick={addPesadaItem} className="h-9 px-6 text-[10px] font-black uppercase text-primary border border-dashed border-primary/30 hover:bg-primary/5 rounded-xl">
                        <Plus className="h-4 w-4 mr-2" /> Añadir Otro Químico a la Mezcla
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={handleConfirmPesada} disabled={processing || !lotFound} className="flex-1 h-14 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl transition-all">{processing ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingKardexId ? <Save className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />)} {editingKardexId ? "GUARDAR CAMBIOS" : "CONFIRMAR Y DESCARGAR"}</Button>
                  {editingKardexId && <Button onClick={handleCancelEdit} variant="outline" className="h-14 px-8 border-border text-muted-foreground font-black uppercase text-[10px] tracking-widest rounded-2xl"><RotateCcw className="h-4 w-4 mr-2" /> CANCELAR EDICIÓN</Button>}
                </div>
              </CardContent>
            </Card>
        </div>
      )}

      <div className="space-y-6 pt-4">
        <div className="flex items-center gap-3 px-2"><Database className="h-5 w-5 text-primary" /><h2 className="text-xl font-black uppercase tracking-tight">Balance Mensual: {activeMonthTab}</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {monthlySummaries.map((m) => (
            <Card key={m.id} className="rounded-3xl border border-border bg-card overflow-hidden shadow-premium group">
              <div className="p-6 space-y-6">
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] truncate">{m.name}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-3 rounded-2xl border border-border/50 text-center relative group/edit">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Inicial</p>
                    {editingInitialId === m.id ? (
                      <div className="flex items-center gap-1 justify-center"><Input type="number" step="0.1" value={tempInitialValue} onChange={e => setTempInitialValue(e.target.value)} className="h-7 w-20 text-center font-black p-1 text-xs border-primary bg-background" autoFocus /><button onClick={() => handleSaveInitialBalance(m.id)} disabled={isSavingInitial} className="text-emerald-600">{isSavingInitial ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}</button></div>
                    ) : (
                      <div className="flex items-center justify-center gap-2"><p className="text-xl font-black">{m.saldoInicialMesKg.toFixed(1)} <span className="text-[10px]">kg</span></p><button onClick={() => handleStartEditInitial(m.id, m.saldoInicialMesKg)} className="opacity-0 group-hover/edit:opacity-100 transition-opacity"><Edit3 className="h-3 w-3" /></button></div>
                    )}
                  </div>
                  <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10 text-center"><p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Disponible</p><p className={cn("text-2xl font-black", m.disponibleMesKg < 10 ? "text-red-600" : "text-primary")}>{m.disponibleMesKg.toFixed(1)} <span className="text-[10px]">kg</span></p></div>
                </div>
                <div className="pt-4 border-t border-border/50 flex justify-between text-right">
                  <div className="text-left"><p className="text-[8px] font-bold text-muted-foreground uppercase">Compra</p><p className="text-xs font-black text-emerald-600">+{m.compraMesKg.toFixed(1)} kg</p></div>
                  <div><p className="text-[8px] font-bold text-muted-foreground uppercase">Consumo</p><p className="text-xs font-black text-amber-600">-{m.consumoMesKg.toFixed(1)} kg</p></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-card p-8 rounded-[3rem] border border-border shadow-premium space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 bg-muted flex items-center justify-center rounded-xl text-muted-foreground"><History className="h-5 w-5" /></div><h3 className="text-xl font-black uppercase tracking-tight">Kardex de Movimientos</h3></div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-xl border border-border">
              <div className="flex items-center gap-2 px-3 text-[10px] font-black uppercase text-muted-foreground border-r border-border">
                <CalendarDays className="h-3.5 w-3.5" /> Periodo
              </div>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 border-none bg-transparent text-[11px] font-bold w-32 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">{MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9 border-none bg-transparent text-[11px] font-bold w-24 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={loadKardexData} disabled={loadingKardex} size="sm" variant="ghost" className="h-9 w-9 rounded-lg text-primary"><RefreshCcw className={cn("h-4 w-4", loadingKardex && "animate-spin")} /></Button>
            </div>
            
            <Select value={chemicalFilter} onValueChange={setChemicalFilter}><SelectTrigger className="w-56 h-10 erp-input font-black uppercase text-[10px]"><Beaker className="h-3.5 w-3.5 mr-2" /><SelectValue placeholder="Insumo..." /></SelectTrigger><SelectContent className="rounded-2xl max-h-[300px]"><SelectItem value="all" className="font-black text-primary text-[10px]">TODOS</SelectItem>{uniqueChemicals.map(c => <SelectItem key={c.chemicalName} value={c.chemicalName} className="font-bold text-[10px]">{c.chemicalName}</SelectItem>)}</SelectContent></Select>
            <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-10 erp-input h-10 text-xs" value={tableSearch} onChange={e => setTableSearch(e.target.value)} /></div>
          </div>
        </div>
        <div className="rounded-[2rem] border border-border overflow-hidden bg-background min-h-[300px]">
          {loadingKardex ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recuperando pesadas...</p></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead onClick={() => handleSort("fecha")} className="py-5 pl-8 text-[10px] font-black uppercase cursor-pointer hover:bg-muted/80 transition-colors group"><div className="flex items-center">Fecha <SortIcon field="fecha" /></div></TableHead>
                  <TableHead className="text-[10px] font-black uppercase">TIPO ORDEN</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Tipo Mov.</TableHead>
                  <TableHead onClick={() => handleSort("order")} className="text-[10px] font-black uppercase cursor-pointer hover:bg-muted/80 transition-colors group"><div className="flex items-center">Orden / Lote <SortIcon field="order" /></div></TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Peso Orden (kg)</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Insumo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Cantidad</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Cantidad Final</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right pr-8">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKardex.map((item) => (
                  <TableRow key={item.id} className={cn("border-border hover:bg-muted/5 transition-colors", editingKardexId === item.id && "bg-amber-50")}>
                    <TableCell className="py-5 pl-8 text-xs font-medium text-muted-foreground">{item.fecha || item.createdAt ? format(normalizeDate(item.fecha || item.createdAt), "dd/MM/yy HH:mm") : "---"}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[8px] font-black uppercase border-none px-2.5 h-6 rounded-full", item.orderType === "LAVADO_MAQUINA" ? "bg-purple-500/10 text-purple-600" : item.orderType === "MUESTRA" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600")}>{item.orderType || "NORMAL"}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[8px] font-black uppercase border-none px-2.5 h-6 rounded-full", item.tipo.includes("INGRESO") ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{item.tipo}</Badge></TableCell>
                    <TableCell><div className="flex flex-col"><span className="font-black text-xs text-primary uppercase">{item.order || "---"}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">Ref: {item.lote}</span></div></TableCell>
                    <TableCell className="text-xs font-bold text-muted-foreground">{item.pesoOrden ? `${item.pesoOrden} kg` : "---"}</TableCell>
                    <TableCell className="font-bold text-xs uppercase">{item.quimico}</TableCell>
                    <TableCell className="text-center font-black text-sm">{item.tipo.includes("INGRESO") ? "+" : "-"}{item.cant} g</TableCell>
                    <TableCell className="text-right"><span className="text-xs font-black text-foreground">{runningBalancesMap[item.id] !== undefined ? `${runningBalancesMap[item.id].toFixed(0)} g` : "---"}</span></TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditKardex(item)} className={cn("h-8 w-8 rounded-lg transition-all", editingKardexId === item.id ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setKardexToDelete(item); setIsDeleteKardexOpen(true); }} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredKardex.length === 0 && !loadingKardex && (
                  <TableRow><TableCell colSpan={9} className="h-40 text-center opacity-20"><History className="h-10 w-10 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Sin movimientos en el periodo</p></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* MODAL GESTIÓN DE CATÁLOGO */}
      <Dialog open={isCatalogModalOpen} onOpenChange={setIsCatalogModalOpen}>
        <DialogContent className="max-w-2xl p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card max-h-[90vh] flex flex-col">
          <div className="p-8 border-b border-border bg-primary/5 shrink-0"><DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3"><Settings2 className="h-6 w-6 text-primary" />Gestión del Catálogo de Químicos</DialogTitle><p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">Alta y Control de Insumos Industriales</p></div>
          <div className="p-8 space-y-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed border-border space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Registrar Nuevo Insumo</Label><div className="flex gap-3"><Input placeholder="NOMBRE DEL QUÍMICO..." value={newChemicalName} onChange={e => setNewChemicalName(e.target.value.toUpperCase())} className="erp-input h-12 font-bold flex-1" /><Button onClick={handleSaveNewChemical} disabled={isSavingNewChem || !newChemicalName.trim()} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-12 px-8 rounded-xl shadow-lg">{isSavingNewChem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Añadir</Button></div></div>
            <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Listado de Insumos Registrados</Label><div className="rounded-2xl border border-border overflow-hidden bg-background"><Table><TableHeader className="bg-muted/50 sticky top-0 z-10"><TableRow><TableHead className="text-[9px] font-black uppercase py-3 pl-6">Nombre del Químico</TableHead><TableHead className="text-[9px] font-black uppercase text-center">Estado</TableHead><TableHead className="text-[9px] font-black uppercase text-right pr-6">Acción</TableHead></TableRow></TableHeader><TableBody>{chemicals.sort((a, b) => a.chemicalName.localeCompare(b.chemicalName)).map((c) => (<TableRow key={c.id} className={cn("hover:bg-muted/5", c.active === false && "bg-muted/20 opacity-60")}><TableCell className="pl-6 py-3 font-bold text-xs uppercase">{c.chemicalName}</TableCell><TableCell className="text-center"><Badge variant="outline" className={cn("text-[8px] font-black uppercase border-none px-2 h-5 rounded-full", c.active !== false ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{c.active !== false ? "ACTIVO" : "INACTIVO"}</Badge></TableCell><TableCell className="text-right pr-6"><Button variant="ghost" size="icon" onClick={() => handleToggleChemicalStatus(c.id, c.active !== false)} className={cn("h-8 w-8 rounded-lg", c.active !== false ? "text-red-500 hover:bg-red-50" : "text-emerald-500 hover:bg-emerald-50")}>{c.active !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}</Button></TableCell></TableRow>))}</TableBody></Table></div></div>
          </div>
          <div className="p-8 border-t border-border bg-muted/5 flex justify-end shrink-0"><Button variant="ghost" onClick={() => setIsCatalogModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px] h-11 px-8">Cerrar Gestión</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteKardexOpen} onOpenChange={setIsDeleteKardexOpen}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 bg-card border-none shadow-2xl">
          <AlertDialogHeader className="items-center text-center"><div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="h-8 w-8 text-red-600" /></div><AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Eliminar Movimiento</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground font-medium">¿Seguro que deseas eliminar este movimiento del kárdex?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3"><AlertDialogCancel className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest border-border">Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteKardex} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20">Confirmar Eliminación</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

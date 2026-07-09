"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Search, 
  Plus, 
  Trash2, 
  Truck, 
  Layers, 
  CheckCircle2, 
  X,
  Printer,
  Eye,
  Loader2,
  Shirt,
  Save,
  AlertTriangle,
  History,
  MoreVertical,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Zap,
  Edit3,
  RefreshCcw,
  Package,
  UserPlus,
  Calendar as CalendarIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  doc, 
  writeBatch, 
  Timestamp,
  limit,
  onSnapshot,
  orderBy,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  setDoc,
  or
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { OutputDetail } from "@/components/salidas/output-detail";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

/**
 * MOTOR DE NORMALIZACIÓN LDDEC 1.1
 */
function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [
    lote.entryLotNumber, 
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
    if (s && s.length < 25 && s !== "[object Object]") return s.toUpperCase();
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

const normalizarSalida = (item: any, origen: string) => {
  const numeroSalida = (item.numeroSalida ?? item.numeroGuia ?? item.outputNumber ?? item.numero ?? item.id ?? "S/N").toString().toUpperCase();
  const fechaDate = toDateSafe(item.date ?? item.fechaSalida ?? item.fecha ?? item.createdAt);
  const fechaMs = fechaDate ? fechaDate.getTime() : 0;
  
  let socioIndustrial = "";
  const singleCleanClient = item.clienteNombre || item.cliente || item.clientName;
  if (singleCleanClient) {
    socioIndustrial = singleCleanClient;
  } else if (Array.isArray(item.containedClientNames) && item.containedClientNames.length > 0) {
    socioIndustrial = Array.from(new Set(item.containedClientNames.map((n: string) => n.trim().toUpperCase()))).join(", ");
  } else {
    socioIndustrial = "S/D";
  }
  
  socioIndustrial = cleanClientNames(socioIndustrial).toUpperCase();
  
  let prendas = 0;
  if (Array.isArray(item.itemsDispatched)) prendas = item.itemsDispatched.reduce((acc: number, it: any) => acc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);
  else prendas = Number(item.totalPrendas ?? item.total ?? 0);
  return { id: item.id, numeroSalida, fecha: fechaDate, fechaMs, socioIndustrial, prendas, origenColeccion: origen, raw: item };
};

export default function SalidasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "socio";

  const [guideInfo, setGuideInfo] = useState({ numeroSalida: "", fecha: new Date().toISOString().split('T')[0], responsiblePerson: "", notes: "", isSample: false });
  const [itemsToDispatch, setItemsToDispatch] = useState<any[]>([]);
  const [searchLote, setSearchLote] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundLotResult, setFoundLotResult] = useState<any | null>(null);

  // Estados para Lote Manual (Contingencia)
  const [clients, setClients] = useState<any[]>([]);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualLotForm, setManualLotForm] = useState({
    lotNumber: "",
    entryNumber: "",
    clientId: "",
    garmentType: "",
    process: "",
    quantity: ""
  });
  
  const [editingDoc, setEditingDoc] = useState<{ id: string, collection: string, createdAt: any } | null>(null);

  const [outputsRaw, setOutputsRaw] = useState<any[]>([]);
  const [salidasRaw, setSalidasRaw] = useState<any[]>([]);
  const [muestrasRaw, setMuestrasRaw] = useState<any[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Estados para controlar los Popovers de calendario
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);

  const [isQtyModalOpen, setIsQtyModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [numeroMuestrasTemp, setNumeroMuestrasTemp] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [viewingOutput, setViewingOutput] = useState<any>(null);

  const loadHistory = useCallback(async () => {
    if (!db) return;
    setLoadingHistory(true);
    try {
      const term = tableSearch.trim().toUpperCase();
      let snapOutputs, snapSalidas, snapMuestras;

      if (term) {
        // Si hay término de búsqueda, ignoramos fechas y buscamos directo por guía o cliente
        // Firestore procesará el 'or' siempre que no tenga 'orderBy' que rompa los índices por defecto.
        const qOutputs = query(collection(db, "outputs"), or(
          where("numeroSalida", "==", term),
          where("containedClientNames", "array-contains", term)
        ), limit(100));

        const qSalidas = query(collection(db, "salidas"), or(
          where("numeroSalida", "==", term),
          where("numeroGuia", "==", term),
          where("clienteNombre", "==", term),
          where("clientName", "==", term)
        ), limit(100));

        const qMuestras = query(collection(db, "muestras"), or(
          where("numeroSalida", "==", term),
          where("numero", "==", term),
          where("cliente", "==", term)
        ), limit(100));

        const [resOutputs, resSalidas, resMuestras] = await Promise.all([
          getDocs(qOutputs),
          getDocs(qSalidas),
          getDocs(qMuestras)
        ]);
        
        snapOutputs = resOutputs;
        snapSalidas = resSalidas;
        snapMuestras = resMuestras;

        // Intentar buscar también por el ID del documento si no hubo resultados en outputs (por si el ID es la guía)
        if (snapOutputs.empty) {
          const docRef = doc(db, "outputs", term);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setOutputsRaw([{ id: docSnap.id, ...docSnap.data() }]);
          } else {
            setOutputsRaw([]);
          }
        } else {
          setOutputsRaw(snapOutputs.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        }

        setSalidasRaw(snapSalidas.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        setMuestrasRaw(snapMuestras.docs.map((d: any) => ({ id: d.id, ...d.data() })));

      } else {
        // Lógica estándar con fechas
        const fromTs = Timestamp.fromDate(new Date(dateFrom + "T00:00:00"));
        const toTs = Timestamp.fromDate(new Date(dateTo + "T23:59:59"));

        const qOutputs = query(collection(db, "outputs"), where("date", ">=", fromTs), where("date", "<=", toTs), orderBy("date", "desc"), limit(200));
        const qSalidas = query(collection(db, "salidas"), where("fechaSalida", ">=", fromTs), where("fechaSalida", "<=", toTs), orderBy("fechaSalida", "desc"), limit(200));
        const qMuestras = query(collection(db, "muestras"), where("fecha", ">=", fromTs), where("fecha", "<=", toTs), orderBy("fecha", "desc"), limit(200));

        const [resOutputs, resSalidas, resMuestras] = await Promise.all([
          getDocs(qOutputs),
          getDocs(qSalidas),
          getDocs(qMuestras)
        ]);

        setOutputsRaw(resOutputs.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        setSalidasRaw(resSalidas.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        setMuestrasRaw(resMuestras.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      }
    } catch (error) {
      console.warn("Error cargando historial de salidas:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [dateFrom, dateTo, tableSearch]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "clients"), (snap) => {
      setClients(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.name || a.nombre || "").localeCompare(b.name || b.nombre || ""))
      );
    });
    return () => unsub();
  }, []);

  const recentOutputs = useMemo(() => {
    const allNormalized = [...outputsRaw.map(x => normalizarSalida(x, "outputs")), ...salidasRaw.map(x => normalizarSalida(x, "salidas")), ...muestrasRaw.map(x => normalizarSalida(x, "muestras"))];
    allNormalized.sort((a, b) => b.fechaMs - a.fechaMs);
    return allNormalized;
  }, [outputsRaw, salidasRaw, muestrasRaw]);

  const filteredHistory = useMemo(() => {
    let list = [...recentOutputs];
    if (tableSearch) list = list.filter(o => o.numeroSalida.toLowerCase().includes(tableSearch.toLowerCase()) || o.socioIndustrial.toLowerCase().includes(tableSearch.toLowerCase()));
    return list;
  }, [recentOutputs, tableSearch]);

  const handleSearchLote = async () => {
    if (isReadOnly) return;
    const term = searchLote.trim().toUpperCase();
    if (!term) return;
    setSearching(true);
    try {
      const q = query(collection(db, "entries"), where("loteIdList", "array-contains", term), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) { 
        toast({ variant: "destructive", title: "Lote no encontrado" });
        setSearching(false); 
        return; 
      }
      const entryDoc = snap.docs[0];
      const entryData = entryDoc.data();
      const lot = (entryData.lotes || []).find((l: any) => getVisibleLotName(l) === term);
      if (!lot) { 
        setSearching(false); 
        return; 
      }
      
      const garmentsSource = lot.garments || lot.prendas || [];
      const originalTotalQty = garmentsSource.length > 0
        ? garmentsSource.reduce((acc: number, g: any) => acc + (Number(g.cantidadConfirmada || g.quantity || 0)), 0)
        : Number(lot.cantidadConfirmada || lot.quantity || lot.cantidad || 0);

      // Calcular cuánto se ha despachado en el historial cargado (outputsRaw, salidasRaw)
      const getHistoricalDispatched = (tUpper?: string) => {
        let historicalTotal = 0;
        const allLocalHistory = [...outputsRaw, ...salidasRaw, ...muestrasRaw];
        
        allLocalHistory.forEach((out: any) => {
          // Evitar contar si estamos editando la misma guía
          if (editingDoc && (editingDoc.id === out.numeroSalida || editingDoc.id === out.id)) return;
          
          const items = out.itemsDispatched || out.raw?.itemsDispatched || [];
          const lotItems = items.filter((it: any) => getVisibleLotName(it) === term);
          
          lotItems.forEach((it: any) => {
            if (tUpper) {
              const prendas = it.prendas || [];
              const prendasOfType = prendas.filter((p: any) => (p.garmentType || p.tipo || "").toUpperCase() === tUpper);
              const sumPrendas = prendasOfType.reduce((acc: number, p: any) => acc + (Number(p.quantityToDispatch || p.cantidad || p.quantity || 0)), 0);
              
              if (prendas.length > 0) {
                historicalTotal += sumPrendas;
              } else if ((it.garmentType || "").toUpperCase() === tUpper) {
                historicalTotal += Number(it.quantityToDispatch || it.cantidad || it.quantity || 0);
              }
            } else {
              historicalTotal += Number(it.quantityToDispatch || it.cantidad || it.quantity || 0);
            }
          });
        });
        return historicalTotal;
      };

      // Sumar lo que ya existe agregado en la guía para este lote
      const existingQtyInGuide = itemsToDispatch
        .filter((it: any) => getVisibleLotName(it) === term)
        .reduce((acc: number, it: any) => acc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);

      const existingQtyHistorical = getHistoricalDispatched();
      const totalAlreadyUsed = existingQtyInGuide + existingQtyHistorical;

      const isResolved = !!(lot.isNoveltyResolved || lot.fallaLavado);

      // Bloquear si el lote ya está despachado por completo (historia + actual)
      if (!isResolved && totalAlreadyUsed >= originalTotalQty) {
        toast({
          variant: "destructive",
          title: "Acción Bloqueada",
          description: "El lote ya fue despachado en su totalidad o ya está agregado por completo en esta u otra guía."
        });
        setSearching(false);
        return;
      }

      // Pre-calcular el desglose con la cantidad restante disponible
      const breakdown = garmentsSource.map((g: any) => {
        const typeUpper = (g.garmentType || g.tipo || "VARIOS").toUpperCase();
        
        // Calcular cuánto se ha despachado de este tipo específico en la guía actual
        const alreadyDispatchedInGuide = itemsToDispatch
          .filter((it: any) => getVisibleLotName(it) === term)
          .flatMap((it: any) => it.prendas || [])
          .filter((p: any) => (p.garmentType || p.tipo || "").toUpperCase() === typeUpper)
          .reduce((sum: number, p: any) => sum + (Number(p.quantityToDispatch || p.cantidad || p.quantity || 0)), 0);

        const alreadyDispatchedHist = getHistoricalDispatched(typeUpper);
        
        const originalVal = Number(g.quantity || g.cantidad || 0);
        const confirmedVal = Number(g.cantidadConfirmada !== undefined ? g.cantidadConfirmada : originalVal);
        
        const remaining = isResolved ? 0 : Math.max(0, confirmedVal - alreadyDispatchedInGuide - alreadyDispatchedHist);

        return { 
          id: g.id || Math.random().toString(36).substr(2, 9), 
          type: typeUpper, 
          original: originalVal, 
          confirmed: confirmedVal,
          toDispatch: remaining 
        };
      });

      if (breakdown.length === 0) {
        const typeUpper = (lot.garmentType || "VARIOS").toUpperCase();
        const alreadyDispatchedInGuide = itemsToDispatch
          .filter((it: any) => getVisibleLotName(it) === term)
          .reduce((sum: number, it: any) => sum + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);

        const alreadyDispatchedHist = getHistoricalDispatched(typeUpper);
        
        const originalVal = Number(lot.quantity || lot.cantidad || 0);
        const confirmedVal = Number(lot.cantidadConfirmada !== undefined ? lot.cantidadConfirmada : originalVal);
        
        const remaining = isResolved ? 0 : Math.max(0, confirmedVal - alreadyDispatchedInGuide - alreadyDispatchedHist);

        breakdown.push({
          id: "legacy",
          type: typeUpper,
          original: originalVal,
          confirmed: confirmedVal,
          toDispatch: remaining
        });
      }

      setFoundLotResult({ 
        lotNumber: term, 
        entryId: entryDoc.id, 
        entryNumber: entryData.entryNumber || entryDoc.id,
        clientName: (entryData.clientName || entryData.clienteNombre || "SOCIO").toUpperCase(), 
        process: (lot.process || lot.proceso || "S/D").toUpperCase(),
        breakdown, 
        isReviewed: lot.status === "reviewed" || lot.status === "ready",
        reportarFaltante: false
      });
      setIsQtyModalOpen(true);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setSearching(false); 
    }
  };

  const handleConfirmLotAddition = () => {
    if (!foundLotResult) return;
    const totalQty = foundLotResult.breakdown.reduce((acc: number, g: any) => acc + (Number(g.toDispatch) || 0), 0);
    if (totalQty <= 0) return;

    if (itemsToDispatch.length > 0) {
      const currentClient = itemsToDispatch[0].clientName;
      if (currentClient && foundLotResult.clientName !== currentClient) {
        toast({
          variant: "destructive",
          title: "Cliente Incompatible",
          description: "El lote pertenece a otro cliente. Una guía solo puede contener lotes del mismo cliente."
        });
        return;
      }
    }

    // Calcular cuánto ya hay agregado en la guía para este lote
    const existingQty = itemsToDispatch
      .filter((it: any) => getVisibleLotName(it) === foundLotResult.lotNumber)
      .reduce((acc: number, it: any) => acc + (Number(it.quantityToDispatch) || 0), 0);

    const originalTotalQty = foundLotResult.breakdown.reduce((acc: number, g: any) => acc + (Number(g.original) || 0), 0);

    // 1. Validar si ya está al límite
    if (existingQty >= originalTotalQty) {
      toast({
        variant: "destructive",
        title: "Acción Bloqueada",
        description: "El lote ya se encuentra agregado en esta guía o no tiene cantidades pendientes por despachar"
      });
      setIsQtyModalOpen(false);
      setFoundLotResult(null);
      setSearchLote("");
      return;
    }

    // 2. Validar si la cantidad total supera el límite
    if (existingQty + totalQty > originalTotalQty) {
      toast({
        variant: "destructive",
        title: "Cantidad Excedida",
        description: "El lote ya se encuentra agregado en esta guía o no tiene cantidades pendientes por despachar"
      });
      return;
    }

    // 3. Validar límites por tipo de prenda individual
    for (const g of foundLotResult.breakdown) {
      const typeUpper = g.type.toUpperCase();
      const alreadyDispatched = itemsToDispatch
        .filter((it: any) => getVisibleLotName(it) === foundLotResult.lotNumber)
        .flatMap((it: any) => it.prendas || [])
        .filter((p: any) => (p.garmentType || p.tipo || "").toUpperCase() === typeUpper)
        .reduce((sum: number, p: any) => sum + (Number(p.quantityToDispatch || p.cantidad || p.quantity || 0)), 0);

      if (alreadyDispatched + Number(g.toDispatch) > g.original) {
        toast({
          variant: "destructive",
          title: "Cantidad Excedida",
          description: `La cantidad de ${g.type} supera el límite disponible en el lote.`
        });
        return;
      }
    }

    const newItem = {
      entryLotNumber: foundLotResult.lotNumber,
      lotNumber: foundLotResult.lotNumber,
      parentIngresoMaestro: foundLotResult.entryId,
      parentIngresoNumber: foundLotResult.entryNumber,
      clientName: foundLotResult.clientName,
      garmentType: foundLotResult.breakdown[0]?.type || "VARIOS",
      processType: foundLotResult.process || "S/D",
      process: foundLotResult.process || "S/D",
      quantityToDispatch: totalQty || 0,
      reportarFaltante: foundLotResult.reportarFaltante || false,
      prendas: foundLotResult.breakdown.map((g: any) => ({
        garmentType: g.type || "VARIOS",
        quantityToDispatch: g.toDispatch || 0,
        originalEntryQuantity: g.original || 0
      }))
    };

    const existingIndex = itemsToDispatch.findIndex((it: any) => getVisibleLotName(it) === foundLotResult.lotNumber);

    if (existingIndex > -1) {
      // Consolidar (Merge) para evitar filas duplicadas
      const updatedItems = [...itemsToDispatch];
      const existingItem = {
        ...updatedItems[existingIndex],
        reportarFaltante: updatedItems[existingIndex].reportarFaltante || foundLotResult.reportarFaltante,
        prendas: updatedItems[existingIndex].prendas.map((p: any) => ({ ...p }))
      };
      
      existingItem.quantityToDispatch = (Number(existingItem.quantityToDispatch) || 0) + totalQty;
      
      existingItem.prendas = existingItem.prendas.map((p: any) => {
        const typeUpper = (p.garmentType || p.tipo || "").toUpperCase();
        const incoming = foundLotResult.breakdown.find((g: any) => g.type.toUpperCase() === typeUpper);
        if (incoming) {
          return {
            ...p,
            quantityToDispatch: (Number(p.quantityToDispatch) || 0) + incoming.toDispatch
          };
        }
        return p;
      });

      // Asegurar nuevas prendas en caso atípico
      foundLotResult.breakdown.forEach((g: any) => {
        const typeUpper = g.type.toUpperCase();
        const exists = existingItem.prendas.some((p: any) => (p.garmentType || p.tipo || "").toUpperCase() === typeUpper);
        if (!exists) {
          existingItem.prendas.push({
            garmentType: g.type,
            quantityToDispatch: g.toDispatch,
            originalEntryQuantity: g.original
          });
        }
      });

      updatedItems[existingIndex] = existingItem;
      setItemsToDispatch(updatedItems);
    } else {
      setItemsToDispatch([...itemsToDispatch, newItem]);
    }

    setIsQtyModalOpen(false);
    setFoundLotResult(null);
    setSearchLote("");
  };

  const handleAddManualLot = () => {
    if (isReadOnly) return;
    const { lotNumber, entryNumber, clientId, garmentType, process, quantity } = manualLotForm;
    
    if (!lotNumber.trim()) {
      toast({ variant: "destructive", title: "Campos requeridos", description: "Por favor, ingrese el Número de Lote." });
      return;
    }
    if (!entryNumber.trim()) {
      toast({ variant: "destructive", title: "Campos requeridos", description: "Por favor, ingrese el Número de Ingreso." });
      return;
    }
    if (!clientId) {
      toast({ variant: "destructive", title: "Campos requeridos", description: "Por favor, seleccione un Socio Industrial." });
      return;
    }
    if (!garmentType.trim()) {
      toast({ variant: "destructive", title: "Campos requeridos", description: "Por favor, ingrese el Tipo de Prenda." });
      return;
    }
    if (!process.trim()) {
      toast({ variant: "destructive", title: "Campos requeridos", description: "Por favor, ingrese el Proceso." });
      return;
    }
    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast({ variant: "destructive", title: "Cantidad inválida", description: "La cantidad debe ser un número mayor a 0." });
      return;
    }

    const selectedClient = clients.find(c => c.id === clientId);
    const clientName = selectedClient ? (selectedClient.name || selectedClient.nombre || "SOCIO").toUpperCase() : "SOCIO";

    if (itemsToDispatch.length > 0) {
      const currentClient = itemsToDispatch[0].clientName;
      if (currentClient && clientName !== currentClient) {
        toast({
          variant: "destructive",
          title: "Cliente Incompatible",
          description: "El lote pertenece a otro cliente. Una guía solo puede contener lotes del mismo cliente."
        });
        return;
      }
    }

    // Requisito 3: Identificador visual concatenando asteriscos en la fila impresa
    const pureLotName = lotNumber.trim().toUpperCase();
    const manualProcessName = `"${process.trim().toUpperCase()}"`;

    const newItem = {
      entryLotNumber: pureLotName,
      lotNumber: pureLotName,
      parentIngresoMaestro: `manual-${Date.now()}`,
      parentIngresoNumber: entryNumber.trim().toUpperCase(),
      clientName: clientName || "SOCIO",
      garmentType: garmentType.trim().toUpperCase() || "VARIOS",
      processType: manualProcessName,
      process: manualProcessName,
      quantityToDispatch: qtyNum || 0,
      reportarFaltante: false,
      isManual: true,
      prendas: [
        {
          garmentType: garmentType.trim().toUpperCase() || "VARIOS",
          quantityToDispatch: qtyNum || 0,
          originalEntryQuantity: qtyNum || 0
        }
      ]
    };

    const existingIndex = itemsToDispatch.findIndex((it: any) => getVisibleLotName(it) === pureLotName);

    if (existingIndex > -1) {
      const updatedItems = [...itemsToDispatch];
      const existingItem = {
        ...updatedItems[existingIndex],
        prendas: updatedItems[existingIndex].prendas.map((p: any) => ({ ...p }))
      };

      existingItem.quantityToDispatch = (Number(existingItem.quantityToDispatch) || 0) + qtyNum;
      
      const pIdx = existingItem.prendas.findIndex((p: any) => (p.garmentType || "").toUpperCase() === garmentType.trim().toUpperCase());
      if (pIdx > -1) {
        existingItem.prendas[pIdx].quantityToDispatch = (Number(existingItem.prendas[pIdx].quantityToDispatch) || 0) + qtyNum;
      } else {
        existingItem.prendas.push({
          garmentType: garmentType.trim().toUpperCase(),
          quantityToDispatch: qtyNum,
          originalEntryQuantity: qtyNum
        });
      }

      updatedItems[existingIndex] = existingItem;
      setItemsToDispatch(updatedItems);
    } else {
      setItemsToDispatch([...itemsToDispatch, newItem]);
    }

    // Resetear formulario
    setManualLotForm({
      lotNumber: "",
      entryNumber: "",
      clientId: "",
      garmentType: "",
      process: "",
      quantity: ""
    });

    toast({ title: "Lote Manual Agregado", description: `El lote manual ${pureLotName} ha sido agregado con éxito.` });
  };

  const handleSaveOutput = async () => {
    if (isReadOnly) return;
    const term = guideInfo.numeroSalida.trim().toUpperCase();
    if (!term || itemsToDispatch.length === 0) return;

    setIsSaving(true);
    try {
      const clientNames = Array.from(new Set(itemsToDispatch.map(it => it.clientName)));
      const now = serverTimestamp();
      
      const payload = { 
        ...guideInfo, 
        numeroSalida: term, 
        date: guideInfo.fecha ? Timestamp.fromDate(new Date(guideInfo.fecha + "T12:00:00")) : serverTimestamp(), 
        itemsDispatched: itemsToDispatch, 
        containedClientNames: clientNames,
        status: "completed", 
        numeroMuestras: Number(numeroMuestrasTemp), 
        updatedAt: now,
        createdAt: editingDoc?.createdAt || now
      };
      
      const batch = writeBatch(db);
      
      if (editingDoc && (editingDoc.id !== term || editingDoc.collection !== 'outputs')) {
        batch.delete(doc(db, editingDoc.collection, editingDoc.id));
      }
      
      batch.set(doc(db, "outputs", term), payload, { merge: true });

      // Gestión de Faltantes
      itemsToDispatch.forEach(it => {
        if (it.reportarFaltante) {
          const totalOriginal = it.prendas?.reduce((sum: number, p: any) => sum + Number(p.originalEntryQuantity || 0), 0) || 0;
          const totalDispatched = it.prendas?.reduce((sum: number, p: any) => sum + Number(p.quantityToDispatch || 0), 0) || Number(it.quantityToDispatch || 0);
          const faltante = totalOriginal - totalDispatched;
          
          if (faltante > 0) {
            const faltanteDocRef = doc(collection(db, "faltantes"));
            batch.set(faltanteDocRef, {
              loteId: it.lotNumber || "S/L",
              clientName: it.clientName || "Socio",
              faltanteOriginal: faltante || 0,
              cantidadDespachada: totalDispatched || 0,
              cantidadOriginal: totalOriginal || 0,
              estado: "PENDIENTE",
              fechaReporte: now,
              salidaReferencia: term,
              createdAt: now
            });
          }
        }
      });

      // Sincronización Inversa (resolver faltantes si se despachan después)
      const faltantesQuery = query(collection(db, "faltantes"), where("estado", "==", "PENDIENTE"));
      const faltantesSnap = await getDocs(faltantesQuery);
      
      faltantesSnap.forEach(fDoc => {
        const fdata = fDoc.data();
        const dispatchedItem = itemsToDispatch.find(it => getVisibleLotName(it) === fdata.loteId);
        
        if (dispatchedItem && !dispatchedItem.reportarFaltante) { 
          // Si estamos despachando un lote que tenía faltante (y no se está marcando como nuevo faltante aquí)
          batch.update(fDoc.ref, {
            estado: "RESUELTO",
            fechaResolucion: now,
            salidaResolucion: term
          });
        }
      });

      await batch.commit();
      toast({ title: "Salida Guardada" });
      handleResetForm();
      loadHistory(); // Recargar tras guardar
    } catch (e: any) { 
      console.error("Error al guardar salida:", e);
      toast({ variant: "destructive", title: "Error al guardar", description: e.message || "Revisa la consola para más detalles." });
    } finally { 
      setIsSaving(false); 
      setIsSampleModalOpen(false); 
    }
  };

  const handleEditOutput = (out: any) => {
    if (isReadOnly) return;
    const raw = out.raw;
    
    setEditingDoc({ 
      id: out.id, 
      collection: out.origenColeccion,
      createdAt: raw.createdAt || null
    });

    setGuideInfo({
      numeroSalida: raw.numeroSalida || raw.id || "",
      fecha: toDateSafe(raw.date || raw.fechaSalida || raw.createdAt)?.toISOString().split('T')[0] || "",
      responsiblePerson: raw.responsiblePerson || "",
      notes: raw.notes || "",
      isSample: !!raw.isSample
    });

    setItemsToDispatch(raw.itemsDispatched || []);
    setNumeroMuestrasTemp(raw.numeroMuestras || 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: "Modo Edición Activado" });
  };

  const handleResetForm = () => { 
    setGuideInfo({ numeroSalida: "", fecha: new Date().toISOString().split('T')[0], responsiblePerson: "", notes: "", isSample: false }); 
    setItemsToDispatch([]); 
    setFoundLotResult(null); 
    setSearchLote(""); 
    setNumeroMuestrasTemp(0);
    setEditingDoc(null);
  };

  const removeItem = (idx: number) => {
    setItemsToDispatch(itemsToDispatch.filter((_, i) => i !== idx));
  };

  const handleSampleToggle = (checked: boolean) => {
    const currentVal = guideInfo.numeroSalida || "";
    const onlyNums = currentVal.replace(/[^0-9]/g, '');
    setGuideInfo({
      ...guideInfo,
      isSample: checked,
      numeroSalida: checked ? `S-MUES-${onlyNums}` : onlyNums
    });
  };

  const handleOutputNumberChange = (value: string) => {
    const safeVal = value || "";
    if (guideInfo.isSample) {
      const onlyNums = safeVal.replace(/[^0-9]/g, '');
      setGuideInfo({ ...guideInfo, numeroSalida: `S-MUES-${onlyNums}` });
    } else {
      setGuideInfo({ ...guideInfo, numeroSalida: safeVal.toUpperCase() });
    }
  };

  const dateFromObj = dateFrom ? parseISO(dateFrom) : undefined;
  const dateToObj = dateTo ? parseISO(dateTo) : undefined;
  const fechaObj = guideInfo.fecha ? parseISO(guideInfo.fecha) : undefined;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Salidas Industriales</h1>
        <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">Gestión de Despachos LDDEC 1.1</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {!isReadOnly && (
          <div className="lg:col-span-4 space-y-6">
            <Card className={cn("rounded-2xl border shadow-sm overflow-hidden bg-card", editingDoc ? "border-amber-500 shadow-amber-500/10" : "border-border")}>
              <CardHeader className={cn("border-b p-5 py-4", editingDoc ? "bg-amber-500/10" : "bg-primary/5")}>
                <CardTitle className="text-xs font-black uppercase flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" /> 
                    {editingDoc ? "Editando Salida" : "Nueva Salida"}
                  </div>
                  {editingDoc && <button onClick={handleResetForm} className="text-amber-600 hover:text-amber-700 transition-colors"><X className="h-4 w-4"/></button>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-[10px] font-black uppercase">N° Salida</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={guideInfo.isSample} 
                        onCheckedChange={(c) => handleSampleToggle(!!c)} 
                        className="h-3.5 w-3.5 border-muted-foreground/30 data-[state=checked]:bg-primary"
                        id="isSampleToggle"
                      />
                      <label htmlFor="isSampleToggle" className="text-[9px] font-bold uppercase cursor-pointer text-muted-foreground hover:text-foreground transition-colors">Es Muestra</label>
                    </div>
                  </div>
                  <div className="relative group">
                    {guideInfo.isSample && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        <span className="text-xs font-black text-primary/60 uppercase tracking-tighter">S-MUES-</span>
                      </div>
                    )}
                    <Input 
                      value={guideInfo.isSample ? guideInfo.numeroSalida.replace('S-MUES-', '') : guideInfo.numeroSalida} 
                      onChange={e => handleOutputNumberChange(e.target.value)} 
                      className={cn("erp-input h-10 font-bold text-base text-primary transition-all", guideInfo.isSample && "pl-[68px]")} 
                      placeholder={guideInfo.isSample ? "Número" : "Ej: 7421"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1">Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-10 erp-input bg-background justify-start text-left font-bold text-xs rounded-xl">
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                          {fechaObj && isValid(fechaObj) ? format(fechaObj, "dd/MM/yyyy") : "Fecha..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={fechaObj}
                          onSelect={(d) => setGuideInfo({...guideInfo, fecha: d ? format(d, "yyyy-MM-dd") : ""})}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Resp. / Chofer</Label><Input value={guideInfo.responsiblePerson} onChange={e => setGuideInfo({...guideInfo, responsiblePerson: e.target.value.toUpperCase()})} className="erp-input h-10 text-xs" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border shadow-sm p-5 space-y-4 bg-card">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase ml-1">Añadir Lote a Guía</Label>
                <div className="flex gap-2">
                  <Input placeholder="ID Lote..." value={searchLote} onChange={e => setSearchLote(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchLote())} className="erp-input h-10 text-sm font-bold" />
                  <Button onClick={handleSearchLote} disabled={searching} className="h-10 w-10 bg-primary rounded-xl shrink-0">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Agregar Lote Manual (Contingencia) */}
            <Card className="rounded-2xl border border-border shadow-sm overflow-hidden bg-card transition-all">
              <button 
                type="button"
                onClick={() => setIsManualFormOpen(!isManualFormOpen)} 
                className="w-full p-5 py-4 flex items-center justify-between text-left hover:bg-muted/5 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <Plus className={cn("h-4 w-4 text-primary transition-transform duration-200", isManualFormOpen && "rotate-45")} />
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary">Agregar Lote Manual</h4>
                </div>
                <div className="text-muted-foreground flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase">{isManualFormOpen ? "Ocultar" : "Mostrar"}</span>
                  <span className="text-xs font-bold">{isManualFormOpen ? "[-]" : "[+]"}</span>
                </div>
              </button>
              
              {isManualFormOpen && (
                <div className="p-5 pt-0 space-y-4 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase ml-1">N° Lote</Label>
                      <Input placeholder="LOTE..." value={manualLotForm.lotNumber} onChange={e => setManualLotForm({...manualLotForm, lotNumber: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase ml-1">N° Ingreso</Label>
                      <Input placeholder="INGRESO..." value={manualLotForm.entryNumber} onChange={e => setManualLotForm({...manualLotForm, entryNumber: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1">Socio Industrial</Label>
                    <Select value={manualLotForm.clientId} onValueChange={v => setManualLotForm({...manualLotForm, clientId: v})}>
                      <SelectTrigger className="erp-input h-9 text-xs font-bold"><SelectValue placeholder="Seleccionar Socio..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs uppercase font-bold">{(c.name || c.nombre || "").toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase ml-1">Tipo de Prenda</Label>
                      <Input placeholder="PRENDA..." value={manualLotForm.garmentType} onChange={e => setManualLotForm({...manualLotForm, garmentType: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase ml-1">Proceso</Label>
                      <Input placeholder="PROCESO..." value={manualLotForm.process} onChange={e => setManualLotForm({...manualLotForm, process: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-bold" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase ml-1">Cantidad</Label>
                    <Input type="number" min="1" placeholder="CANTIDAD..." value={manualLotForm.quantity} onChange={e => setManualLotForm({...manualLotForm, quantity: e.target.value})} className="erp-input h-9 text-xs font-bold text-primary" />
                  </div>

                  <Button onClick={handleAddManualLot} className="w-full h-9 bg-primary hover:bg-primary/90 text-white font-black uppercase text-[9px] tracking-widest rounded-xl transition-all active:scale-95">
                    Añadir Lote Manual
                  </Button>
                </div>
              )}
            </Card>

            <Button onClick={() => setIsSampleModalOpen(true)} disabled={isSaving || itemsToDispatch.length === 0} className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg transition-all active:scale-95">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingDoc ? "ACTUALIZAR SALIDA" : "GUARDAR Y CERRAR SALIDA")}
            </Button>
          </div>
        )}

        <div className={cn("lg:col-span-8", isReadOnly && "lg:col-span-12")}>
          <Card className="rounded-2xl border border-border shadow-sm overflow-hidden min-h-[400px] bg-card">
            <div className="p-5 py-4 border-b border-border flex items-center justify-between bg-muted/10">
              <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Lotes en Guía Actual</h3>
              {itemsToDispatch.length > 0 && (
                <Badge className="bg-primary text-white border-none font-black text-[10px] px-3 h-6 rounded-lg">{itemsToDispatch.length} Lotes</Badge>
              )}
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="py-3 pl-5 text-[10px]">Lote / Ingreso</TableHead>
                  <TableHead className="text-[10px]">Prenda</TableHead>
                  <TableHead className="text-[10px]">Proceso</TableHead>
                  <TableHead className="text-right text-[10px]">Cant.</TableHead>
                  {!isReadOnly && <TableHead className="text-right pr-5 text-[10px]">Acción</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsToDispatch.map((item, idx) => (
                  <TableRow key={idx} className="border-b border-border hover:bg-muted/5 transition-colors">
                    <TableCell className="py-3 pl-5">
                      <div className="flex flex-col">
                        <span className="font-black text-xs text-primary flex items-center gap-1.5">
                          {getVisibleLotName(item)}
                          {(item.isManual || String(getVisibleLotName(item)).endsWith(" (Manual)")) && (
                            <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                              Manual
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">ING: {item.parentIngresoNumber || item.numeroIngreso || "S/I"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-[11px] uppercase">{item.garmentType}</TableCell>
                    <TableCell className="text-[9px] font-black uppercase text-primary/80">{item.processType || item.process || "S/D"}</TableCell>
                    <TableCell className="text-right font-black text-base">{item.quantityToDispatch || item.cantidad || item.quantity || 0}</TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right pr-5">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-7 w-7 text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {itemsToDispatch.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center opacity-20">
                      <Package className="h-10 w-10 mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">No hay lotes en esta guía</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-border">
        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm flex flex-col lg:flex-row items-center gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Buscador Guía / Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-10 erp-input h-11" value={tableSearch} onChange={e => setTableSearch(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Desde</Label>
              <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {dateFromObj && isValid(dateFromObj) ? format(dateFromObj, "dd/MM/yyyy") : "Desde..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFromObj}
                    onSelect={(d) => { setDateFrom(d ? format(d, "yyyy-MM-dd") : ""); setIsFromOpen(false); }}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Hasta</Label>
              <Popover open={isToOpen} onOpenChange={setIsToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {dateToObj && isValid(dateToObj) ? format(dateToObj, "dd/MM/yyyy") : "Hasta..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={dateToObj}
                    onSelect={(d) => { setDateTo(d ? format(d, "yyyy-MM-dd") : ""); setIsToOpen(false); }}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="lg:col-span-2 flex items-end">
              <Button 
                onClick={loadHistory} 
                disabled={loadingHistory}
                className="h-11 px-8 bg-muted hover:bg-muted/80 text-foreground font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl border border-border w-full lg:w-auto"
              >
                {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                Consultar Historial
              </Button>
            </div>
          </div>
        </div>
        
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm min-h-[300px]">
          {loadingHistory ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consultando Firestore...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50"><TableRow><TableHead className="py-4 pl-5 text-[10px]">N° SALIDA</TableHead><TableHead className="text-[10px]">FECHA</TableHead><TableHead className="text-[10px]">SOCIO INDUSTRIAL</TableHead><TableHead className="text-center text-[10px]">PRENDAS</TableHead><TableHead className="text-right pr-5 text-[10px]">ACCIÓN</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredHistory.map((out) => (
                  <TableRow key={out.id} className="border-b border-border hover:bg-muted/10 transition-colors group">
                    <TableCell className="py-3 pl-5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary/5 text-primary flex items-center justify-center"><Truck className="h-3.5 w-3.5" /></div>
                        <span className="font-black text-xs uppercase">{out.numeroSalida}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] font-medium text-muted-foreground">{out.fecha ? out.fecha.toLocaleDateString('es-EC') : 'S/F'}</TableCell>
                    <TableCell className="text-[11px] font-bold uppercase truncate max-w-[200px]">{out.socioIndustrial}</TableCell>
                    <TableCell className="text-center font-black text-primary text-base">{out.prendas}</TableCell>
                    <TableCell className="text-right pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setViewingOutput(out.raw); setIsViewOpen(true); }} className="h-8 w-8 rounded-full hover:text-primary"><Eye className="h-4 w-4" /></Button>
                        {!isReadOnly && <Button variant="ghost" size="icon" onClick={() => handleEditOutput(out)} className="h-8 w-8 rounded-full hover:text-amber-600"><Edit3 className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => { setViewingOutput(out.raw); setIsViewOpen(true); }} className="h-8 w-8 rounded-full hover:text-emerald-600"><Printer className="h-4 w-4"/></Button>
                        {!isReadOnly && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-red-600"><Trash2 className="h-4 w-4"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl p-6 bg-card border-none shadow-xl max-w-sm">
                              <AlertDialogHeader className="items-center text-center">
                                <AlertTriangle className="h-10 w-10 text-red-600 mb-2" />
                                <AlertDialogTitle className="text-lg font-black uppercase">Anular Guía</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs font-medium">¿Estás seguro de anular la guía <strong>{out.numeroSalida}</strong>?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-6 gap-2">
                                <AlertDialogCancel className="flex-1 rounded-xl h-10 text-xs font-bold uppercase">No</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={async () => { 
                                    try { await deleteDoc(doc(db, out.origenColeccion, out.id)); toast({ title: "Registro Anulado" }); loadHistory(); } catch(e){} 
                                  }} 
                                  className="flex-1 bg-red-600 text-white rounded-xl h-10 text-xs font-bold uppercase"
                                >
                                  Si, Anular
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center opacity-20">
                      <Truck className="h-10 w-10 mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Sin registros en el periodo seleccionado</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* MODAL: CANTIDADES DE LOTE */}
      <Dialog open={isQtyModalOpen} onOpenChange={setIsQtyModalOpen}>
        <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden border-none shadow-xl bg-card">
          <div className={cn("p-5 text-white flex items-center justify-between transition-colors duration-300", foundLotResult?.isReviewed ? "bg-emerald-600" : "bg-primary")}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                {foundLotResult?.isReviewed ? <ShieldCheck className="h-5 w-5 text-white animate-pulse" /> : <Shirt className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">
                  {foundLotResult?.isReviewed ? "Lote Auditado y Confirmado" : "Confirmar Cantidad"}
                </DialogTitle>
                <p className="text-[9px] font-bold uppercase opacity-80 mt-0.5">LOTE: {foundLotResult?.lotNumber}</p>
              </div>
            </div>
            {foundLotResult?.isReviewed && (
              <Badge className="bg-white text-emerald-700 hover:bg-white border-none font-bold uppercase text-[9px] px-2.5 py-1">
                Auditoría OK
              </Badge>
            )}
          </div>
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-border overflow-hidden bg-background">
              <Table>
                <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[9px] font-black uppercase py-3 pl-4">Prenda</TableHead><TableHead className="text-[9px] font-black uppercase text-center">Físico</TableHead><TableHead className="text-[9px] font-black uppercase text-right pr-4">A Despachar</TableHead></TableRow></TableHeader>
                <TableBody>
                  {foundLotResult?.breakdown.map((g: any, i: number) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="pl-4 py-3 font-bold text-xs uppercase">{g.type}</TableCell>
                      <TableCell className="text-center font-black">
                        <span className="text-sm">{g.confirmed}</span>
                        {g.confirmed !== g.original && (
                          <span className="text-[9px] text-muted-foreground block font-bold mt-0.5">
                            REG: {g.original}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Input type="number" className="h-9 w-20 ml-auto text-center font-black text-primary border-primary/20 bg-primary/5 rounded-lg" value={g.toDispatch} onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const newBreakdown = [...foundLotResult.breakdown];
                          newBreakdown[i].toDispatch = val;
                          setFoundLotResult({...foundLotResult, breakdown: newBreakdown});
                        }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center space-x-2 px-2 mt-2">
              <Checkbox 
                id="reportarFaltante" 
                checked={foundLotResult?.reportarFaltante || false}
                onCheckedChange={(c) => setFoundLotResult({...foundLotResult, reportarFaltante: !!c})}
                className="border-primary/50 data-[state=checked]:bg-primary"
              />
              <label htmlFor="reportarFaltante" className="text-xs font-bold uppercase cursor-pointer select-none">
                Reportar Faltante
              </label>
            </div>
            <DialogFooter className="flex gap-3 mt-4">
              <Button variant="ghost" onClick={() => setIsQtyModalOpen(false)} className="flex-1 rounded-xl h-11 font-bold text-xs uppercase">Cancelar</Button>
              <Button onClick={handleConfirmLotAddition} className="flex-1 bg-primary text-white rounded-xl h-11 font-black text-xs uppercase">Autorizar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: MUESTRAS ADICIONALES */}
      <Dialog open={isSampleModalOpen} onOpenChange={setIsSampleModalOpen}>
        <DialogContent className="max-w-xs p-0 rounded-2xl overflow-hidden border-none shadow-xl bg-card">
          <div className="p-4 bg-muted/20 border-b border-border"><DialogTitle className="text-base font-black uppercase text-center">Finalizar Guía</DialogTitle></div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex justify-center">Muestras Físicas</Label>
              <Input type="number" value={numeroMuestrasTemp} onChange={e => setNumeroMuestrasTemp(parseInt(e.target.value) || 0)} className="erp-input h-14 text-3xl font-black text-center text-primary" />
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleSaveOutput} disabled={isSaving} className="h-12 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-lg">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "CONFIRMAR Y GUARDAR"}
              </Button>
              <Button variant="ghost" onClick={() => setIsSampleModalOpen(false)} className="h-10 font-bold uppercase text-[9px]">Volver</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl p-0 rounded-2xl overflow-hidden bg-card border-none shadow-2xl" hideCloseButton>
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle Guía</DialogTitle>
            <DialogDescription>Visualización compacta de despacho</DialogDescription>
          </DialogHeader>
          {viewingOutput && <OutputDetail output={viewingOutput} onClose={() => setIsViewOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

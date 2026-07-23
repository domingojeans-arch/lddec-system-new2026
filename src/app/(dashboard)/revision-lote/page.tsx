"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, ClipboardCheck, Check, Loader2, AlertTriangle, Info, Zap, Layers, MousePointer2, Plus, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { LaundryProcess } from "@/types/process";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  orderBy,
  getDoc,
  limit,
  setDoc
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface GarmentReview {
  id: string;
  garmentType: string;
  originalQuantity: number;
  confirmedQuantity: number;
  hasIssue: boolean;
  selectedProcesses: LaundryProcess[];
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

function getEntryVisible(item: any, id?: string): string {
  if (!item) return id || "INGRESO S/N";
  const candidates = [
    item.numeroIngreso, 
    item.entryNumber, 
    item.numeroIngresoMaestro, 
    item.numero,
    item.entryID
  ];
  for (const val of candidates) {
    const v = String(val ?? "").trim();
    if (v && v.length < 18 && v !== "undefined" && v !== "[object Object]") return v.toUpperCase();
  }
  return id || "INGRESO S/N";
}

const getProcessColor = (name: string, isSelected: boolean) => {
  if (isSelected) {
    return {
      button: "bg-primary border-primary text-white shadow-md",
      circle: "border-white bg-white"
    };
  }

  const firstChar = (name || "").trim().toUpperCase().charAt(0);
  const code = firstChar.charCodeAt(0) || 65;

  const palettes = [
    // 0. Azul
    {
      button: "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-700",
      circle: "border-blue-300 dark:border-blue-800/50"
    },
    // 1. Esmeralda
    {
      button: "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400 dark:hover:border-emerald-700",
      circle: "border-emerald-300 dark:border-emerald-800/50"
    },
    // 2. Violeta
    {
      button: "bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/30 text-violet-700 dark:text-violet-300 hover:border-violet-400 dark:hover:border-violet-700",
      circle: "border-violet-300 dark:border-violet-800/50"
    },
    // 3. Ámbar
    {
      button: "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/30 text-amber-700 dark:text-amber-300 hover:border-amber-400 dark:hover:border-amber-700",
      circle: "border-amber-300 dark:border-amber-800/50"
    },
    // 4. Rosa
    {
      button: "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/30 text-rose-700 dark:text-rose-300 hover:border-rose-400 dark:hover:border-rose-700",
      circle: "border-rose-300 dark:border-rose-800/50"
    },
    // 5. Cian
    {
      button: "bg-cyan-50/60 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:border-cyan-400 dark:hover:border-cyan-700",
      circle: "border-cyan-300 dark:border-cyan-800/50"
    },
    // 6. Naranja
    {
      button: "bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/30 text-orange-700 dark:text-orange-300 hover:border-orange-400 dark:hover:border-orange-700",
      circle: "border-orange-300 dark:border-orange-800/50"
    },
    // 7. Fucsia
    {
      button: "bg-fuchsia-50/60 dark:bg-fuchsia-950/20 border-fuchsia-200/60 dark:border-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 hover:border-fuchsia-400 dark:hover:border-fuchsia-700",
      circle: "border-fuchsia-300 dark:border-fuchsia-800/50"
    },
    // 8. Indigo
    {
      button: "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 dark:hover:border-indigo-700",
      circle: "border-indigo-300 dark:border-indigo-800/50"
    },
    // 9. Lime
    {
      button: "bg-lime-50/60 dark:bg-lime-950/20 border-lime-200/60 dark:border-lime-900/30 text-lime-700 dark:text-lime-300 hover:border-lime-400 dark:hover:border-lime-700",
      circle: "border-lime-300 dark:border-lime-800/50"
    },
    // 10. Slate
    {
      button: "bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700",
      circle: "border-slate-300 dark:border-slate-700"
    }
  ];

  if (code < 65 || code > 90) {
    return palettes[10];
  }

  const index = (code - 65) % 10;
  return palettes[index];
};

export default function RevisionLotePage() {
  const [searchQuery, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [parentEntry, setParentEntry] = useState<any | null>(null);
  const [garmentReviews, setGarmentReviews] = useState<GarmentReview[]>([]);
  const [activeSubLotId, setActiveSubLotId] = useState<string>("all");
  const [hasSample, setHasSample] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [processCatalog, setProcessCatalog] = useState<LaundryProcess[]>([]);

  // Estados para el nuevo proceso rápido
  const [isNewProcessDialogOpen, setIsNewProcessDialogOpen] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [isCreatingProcess, setIsCreatingProcess] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "socio";

  useEffect(() => {
    setMounted(true);
    if (!db) return;

    // MOTOR DE CARGA DUAL (TRANSICIÓN SEGURA 2026)
    const qTech = query(collection(db, "procesos_tecnicos"), where("active", "==", true), orderBy("name", "asc"));
    const unsub = onSnapshot(qTech, async (snap) => {
      if (!snap.empty) {
        setProcessCatalog(snap.docs.map(d => ({
          id: d.id,
          name: d.data().name
        })));
      } else {
        // Fallback a configuración antigua
        const legacyRef = doc(db, "configuracion", "procesos");
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          const lista = legacySnap.data().lista || [];
          setProcessCatalog(lista.map((name: string) => ({ id: name, name })));
        }
      }
    });

    return () => unsub();
  }, []);

  const handleSearch = async () => {
    const term = searchQuery.trim().toUpperCase();
    if (!term) return;

    if (processCatalog.length === 0) {
      toast({ variant: "destructive", title: "Cargando Catálogo", description: "Espere a que el catálogo de procesos se inicialice." });
      return;
    }

    setLoading(true);
    setSelectedLot(null);
    setParentEntry(null);
    setGarmentReviews([]);
    setActiveSubLotId("all");
    setHasSample(false);

    try {
      const entriesRef = collection(db, "entries");
      let entryDoc: any = null;

      // MOTOR DE BÚSQUEDA HÍBRIDA 1.2
      // 1. Intentar por loteIdList (Nuevo estándar indexado)
      const q1 = query(entriesRef, where("loteIdList", "array-contains", term), limit(1));
      const snap1 = await getDocs(q1);
      
      if (!snap1.empty) {
        entryDoc = snap1.docs[0];
      } else {
        // 2. Intentar por ID de documento (Referencia directa o legado)
        const dRef = doc(db, "entries", term);
        const dSnap = await getDoc(dRef);
        if (dSnap.exists()) {
          entryDoc = dSnap;
        } else {
          // 3. Intentar por numeroIngreso (Texto plano histórico)
          const q2 = query(entriesRef, where("numeroIngreso", "==", term), limit(1));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) entryDoc = snap2.docs[0];
        }
      }

      if (!entryDoc) {
        toast({ variant: "destructive", title: "No hallado", description: "Lote o Ingreso no encontrado." });
      } else {
        const entryData = entryDoc.data();
        const rawLots = entryData.lotes || entryData.lots || [];
        
        // Resolución robusta del lote específico
        const lot = rawLots.find((l: any) => 
          getVisibleLotName(l) === term || 
          String(l.id || "").toUpperCase() === term ||
          String(l.lotNumber || "").toUpperCase() === term
        );

        if (lot) {
          setParentEntry({ 
            id: entryDoc.id, 
            ...entryData,
            visibleEntryNumber: getEntryVisible(entryData, entryDoc.id)
          });
          setSelectedLot(lot);
          
          const sourceGarments = lot.garments || lot.prendas || [];
          const savedSubLotProcesses = lot.processesByGarment || {};

          if (sourceGarments.length === 0) {
            sourceGarments.push({
              id: "legacy-garment",
              garmentType: lot.garmentType || "Varios",
              quantity: Number(lot.quantity || lot.cantidad || 0),
              cantidadConfirmada: lot.cantidadConfirmada !== undefined ? lot.cantidadConfirmada : undefined
            });
          }

          // RECONSTRUCCIÓN CON COMPATIBILIDAD TEXTO/OBJETO
          const initialReviews = sourceGarments.map((g: any) => {
            const gid = g.id || Math.random().toString(36).substr(2, 9);
            const savedSubLotProcesses = lot.processesByGarment || {};
            const savedProcessesString = savedSubLotProcesses[gid] || lot.process || "";
            const processParts = savedProcessesString.split(" + ").map((p: string) => p.trim().toLowerCase()).filter(Boolean);
            
            const reconstructedSelected = processParts
              .map((name: string) => processCatalog.find(cat => cat.name.toLowerCase() === name))
              .filter((p: any) => !!p) as LaundryProcess[];

            return {
              id: gid,
              garmentType: g.garmentType || g.tipo || "Varios",
              originalQuantity: Number(g.quantity || g.cantidad || 0),
              confirmedQuantity: Number(g.cantidadConfirmada !== undefined ? g.cantidadConfirmada : (lot.cantidadConfirmada !== undefined ? lot.cantidadConfirmada : (g.quantity || g.cantidad || 0))),
              hasIssue: !!lot.hasNovelty,
              selectedProcesses: reconstructedSelected
            };
          });
          
          setGarmentReviews(initialReviews);
          setHasSample(lot.vinoConMuestra || false);
        } else {
          toast({ variant: "destructive", title: "Lote Ausente", description: `El ingreso ${term} fue hallado pero no contiene el lote solicitado.` });
        }
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error en búsqueda" });
    } finally {
      setLoading(false);
    }
  };

  const updateGarmentReview = (id: string, updates: Partial<GarmentReview>) => {
    if (isReadOnly) return;
    setGarmentReviews(prev => prev.map(gr => gr.id === id ? { ...gr, ...updates } : gr));
  };

  const toggleProcess = (process: LaundryProcess) => {
    if (isReadOnly) return;
    if (activeSubLotId === "all") {
      const allHaveIt = garmentReviews.every(gr => gr.selectedProcesses.some(p => p.id === process.id));
      setGarmentReviews(prev => prev.map(gr => {
        const hasIt = gr.selectedProcesses.some(p => p.id === process.id);
        if (allHaveIt) {
          return { ...gr, selectedProcesses: gr.selectedProcesses.filter(p => p.id !== process.id) };
        } else if (!hasIt) {
          return { ...gr, selectedProcesses: [...gr.selectedProcesses, process] };
        }
        return gr;
      }));
    } else {
      setGarmentReviews(prev => prev.map(gr => {
        if (gr.id === activeSubLotId) {
          const hasIt = gr.selectedProcesses.some(p => p.id === process.id);
          return {
            ...gr,
            selectedProcesses: hasIt ? gr.selectedProcesses.filter(p => p.id !== process.id) : [...gr.selectedProcesses, process]
          };
        }
        return gr;
      }));
    }
  };

  const isProcessSelected = (processId: string) => {
    if (activeSubLotId === "all") {
      return garmentReviews.length > 0 && garmentReviews.every(gr => gr.selectedProcesses.some(p => p.id === processId));
    }
    return !!garmentReviews.find(gr => gr.id === activeSubLotId)?.selectedProcesses.some(p => p.id === processId);
  };

  const handleAddNewProcess = async () => {
    if (isReadOnly || isCreatingProcess) return;
    const name = newProcessName.trim().toUpperCase();
    if (!name) return;

    // Validar duplicados en catálogo local para feedback rápido
    const exists = processCatalog.some(p => p.name.toUpperCase() === name);
    if (exists) {
      toast({ variant: "destructive", title: "Proceso duplicado", description: "Este proceso ya existe en el catálogo maestro." });
      return;
    }

    setIsCreatingProcess(true);
    const id = name.replace(/\//g, '-');
    const newProcessObj: LaundryProcess = { id, name };

    try {
      // 1. Guardar en catálogo maestro de forma persistente
      await setDoc(doc(db, "procesos_tecnicos", id), {
        name,
        active: true,
        createdAt: serverTimestamp()
      });

      // 2. Seleccionar automáticamente para el sub-lote activo
      toggleProcess(newProcessObj);
      
      toast({ title: "Proceso registrado y aplicado" });
      setNewProcessName("");
      setIsNewProcessDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al registrar proceso" });
    } finally {
      setIsCreatingProcess(false);
    }
  };

  const totals = useMemo(() => {
    return garmentReviews.reduce((acc, curr) => ({
      original: acc.original + curr.originalQuantity,
      confirmed: acc.confirmed + (Number(curr.confirmedQuantity) || 0)
    }), { original: 0, confirmed: 0 });
  }, [garmentReviews]);

  const globalSummary = useMemo(() => {
    if (garmentReviews.length === 0) return "";
    return garmentReviews
      .map(gr => {
        const processes = gr.selectedProcesses.map(p => p.name.toUpperCase()).join(" + ");
        return `${gr.garmentType.toUpperCase()}: ${processes || 'S/D'}`;
      })
      .join(" | ");
  }, [garmentReviews]);

  // RESUMEN TÉCNICO EN TIEMPO REAL (LDDEC 1.2)
  const currentSummaryData = useMemo(() => {
    if (!selectedLot || !parentEntry) return null;

    let qty = 0;
    let processesStr = "";

    if (activeSubLotId === "all") {
      qty = garmentReviews.reduce((acc, gr) => acc + (Number(gr.confirmedQuantity) || 0), 0);
      // Coleccionar procesos únicos de todos los sub-lotes manteniendo el orden de selección detectado
      const allProcsSet = new Set<string>();
      garmentReviews.forEach(gr => {
        gr.selectedProcesses.forEach(p => allProcsSet.add(p.name.toUpperCase()));
      });
      processesStr = Array.from(allProcsSet).join(" + ");
    } else {
      const active = garmentReviews.find(gr => gr.id === activeSubLotId);
      qty = Number(active?.confirmedQuantity) || 0;
      processesStr = active?.selectedProcesses.map(p => p.name.toUpperCase()).join(" + ") || "";
    }

    return {
      lot: getVisibleLotName(selectedLot),
      qty,
      processes: processesStr || "S/D",
      entry: parentEntry.visibleEntryNumber
    };
  }, [selectedLot, parentEntry, garmentReviews, activeSubLotId]);

  const handleSave = async () => {
    if (isReadOnly || !parentEntry || !selectedLot || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const processesByGarment: Record<string, string> = {};
      garmentReviews.forEach(gr => {
        processesByGarment[gr.id] = gr.selectedProcesses.map(p => p.name.toLowerCase()).join(" + ");
      });

      const lotVisibleName = getVisibleLotName(selectedLot);
      const updatedLotes = (parentEntry.lotes || parentEntry.lots || []).map((l: any) => {
        if (getVisibleLotName(l) === lotVisibleName) {
          const subLotKey = l.garments ? "garments" : (l.prendas ? "prendas" : "garments");
          const currentGarments = l[subLotKey] || [];
          let updatedGarments = currentGarments.map((g: any) => {
            const review = garmentReviews.find(r => r.id === g.id || r.garmentType.toUpperCase() === (g.garmentType || g.tipo || "").toUpperCase());
            if (review) {
              return {
                ...g,
                cantidadConfirmada: review.confirmedQuantity
              };
            }
            return g;
          });

          if (updatedGarments.length === 0) {
            updatedGarments = garmentReviews.map(r => ({
              id: r.id,
              garmentType: r.garmentType,
              quantity: r.originalQuantity,
              cantidadConfirmada: r.confirmedQuantity
            }));
          }

          return {
            ...l,
            productionStatus: "reviewed",
            status: "reviewed",
            cantidadConfirmada: totals.confirmed,
            [subLotKey]: updatedGarments,
            fechaRevision: now,
            revisadoPor: user?.displayName || "Sistema",
            process: globalSummary,
            processesByGarment,
            vinoConMuestra: hasSample,
            hasNovelty: (totals.original - totals.confirmed) !== 0 || garmentReviews.some(r => r.hasIssue)
          };
        }
        return l;
      });

      await updateDoc(doc(db, "entries", parentEntry.id), { 
        lotes: updatedLotes,
        updatedAt: serverTimestamp() 
      });

      toast({ title: "Revisión Finalizada" });
      setSelectedLot(null);
      setParentEntry(null);
      setSearchTerm("");
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const activeSubLot = activeSubLotId === "all" ? null : garmentReviews.find(g => g.id === activeSubLotId);
  const activeSubLotName = activeSubLotId === "all" ? "Todos los Sub-lotes" : `${activeSubLot?.garmentType} (${activeSubLot?.confirmedQuantity})`;

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-20 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">Revisión Técnica de Lote</h1>
        <p className="text-muted-foreground text-sm font-medium">Control de calidad y auditoría física post-lavandería.</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
      </div>

      <Card className="bg-card p-8 rounded-[2rem] border border-border shadow-sm">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Número de lote post-lavado..." 
              className="pl-12 erp-input h-14 text-lg rounded-2xl"
              value={searchQuery}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button onClick={handleSearch} disabled={loading} className="bg-primary hover:bg-primary/90 text-white font-bold h-14 px-10 rounded-2xl shadow-lg shadow-primary/20 flex items-center gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            Consultar
          </button>
        </div>
      </Card>

      {!selectedLot ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[3rem] bg-muted/10 opacity-40">
          <ClipboardCheck className="h-16 w-16 mb-4" />
          <p className="text-xs font-black uppercase tracking-[0.3em]">Esperando escaneo de lote procesado...</p>
        </div>
      ) : (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card rounded-[3rem] border border-border overflow-hidden shadow-2xl">
            <div className="bg-muted/30 p-10 border-b border-border flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary text-white border-none px-4 h-7 font-black uppercase text-[10px] tracking-widest">Auditando</Badge>
                  <h2 className="text-3xl font-black tracking-tight">{getVisibleLotName(selectedLot)}</h2>
                </div>
                <div className="flex gap-8">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Socio Industrial</p>
                    <p className="font-bold text-sm uppercase truncate">{parentEntry?.clientName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Ingreso Maestro</p>
                    <p className="font-mono text-sm font-bold text-primary">{parentEntry?.visibleEntryNumber}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-background px-6 py-4 rounded-2xl border border-border text-center min-w-[120px]">
                  <span className="text-[9px] font-black text-muted-foreground uppercase block mb-1">Original</span>
                  <span className="text-2xl font-black">{totals.original}</span>
                </div>
                <div className="bg-background px-6 py-4 rounded-2xl border border-primary/20 text-center min-w-[120px]">
                  <span className="text-[9px] font-black text-primary uppercase block mb-1">Físico</span>
                  <span className="text-2xl font-black text-primary">{totals.confirmed}</span>
                </div>
              </div>
            </div>

            <div className="p-10 space-y-12">
              <div className="space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="h-4 w-4" /> 1. Verificación Física</h4>
                <div className="rounded-2xl border border-border overflow-hidden bg-background">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-[10px] font-black uppercase py-4 pl-8">Tipo de Prenda</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center">Registrada</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center w-[180px]">Confirmada</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center">Diferencia</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right pr-10">¿Novedad?</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {garmentReviews.map((gr) => (
                        <TableRow key={gr.id} className="border-b border-border last:border-0 hover:bg-muted/5 transition-colors">
                          <TableCell className="font-bold py-5 pl-8 uppercase text-xs">{gr.garmentType}</TableCell>
                          <TableCell className="text-center font-black text-muted-foreground">{gr.originalQuantity}</TableCell>
                          <TableCell className="text-center">
                            <Input 
                              type="number"
                              readOnly={isReadOnly}
                              className="h-10 text-center font-black text-primary bg-muted/20 border-border rounded-xl"
                              value={gr.confirmedQuantity}
                              onChange={e => updateGarmentReview(gr.id, { confirmedQuantity: parseInt(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {gr.originalQuantity - gr.confirmedQuantity !== 0 ? (
                              <span className="text-xs font-black text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full">{gr.confirmedQuantity - gr.originalQuantity}</span>
                            ) : <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">OK</span>}
                          </TableCell>
                          <TableCell className="text-right pr-10">
                            <Checkbox disabled={isReadOnly} checked={gr.hasIssue} onCheckedChange={(val) => updateGarmentReview(gr.id, { hasIssue: !!val })} className="h-6 w-6 border-border data-[state=checked]:bg-destructive rounded-lg" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">2. Aplicar procesos técnicos a:</h4>
                <div className="flex flex-wrap gap-3 p-3 bg-muted/20 rounded-[1.5rem] border border-border">
                  <button onClick={() => setActiveSubLotId("all")} className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeSubLotId === "all" ? "bg-primary text-white shadow-lg" : "bg-card text-muted-foreground hover:bg-muted")}>Todos los Sub-lotes</button>
                  {garmentReviews.map(gr => (
                    <button key={gr.id} onClick={() => setActiveSubLotId(gr.id)} className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2", activeSubLotId === gr.id ? "bg-primary text-white shadow-lg" : "bg-card text-muted-foreground hover:bg-muted")}>
                      <div className={cn("h-2 w-2 rounded-full", activeSubLotId === gr.id ? "bg-white" : "bg-primary/40")} /> {gr.garmentType} ({gr.confirmedQuantity})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> 3. Asignando procesos a: <span className="underline">{activeSubLotName.toUpperCase()}</span>
                  </div>
                  {!isReadOnly && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsNewProcessDialogOpen(true)}
                      className="h-7 px-2 text-primary hover:bg-primary/10 rounded-lg gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Nuevo Proceso</span>
                    </Button>
                  )}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
                  {processCatalog.map((process) => {
                    const isSelected = isProcessSelected(process.id);
                    const colorStyles = getProcessColor(process.name, isSelected);
                    
                    return (
                      <button 
                        key={process.id} 
                        onClick={() => toggleProcess(process)} 
                        className={cn(
                          "flex items-center gap-2 h-10 px-3 rounded-xl border text-left transition-all group shrink-0", 
                          colorStyles.button
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full border flex items-center justify-center shrink-0", 
                          colorStyles.circle
                        )}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary" />}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{process.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <Checkbox id="has-sample" disabled={isReadOnly} checked={hasSample} onCheckedChange={(checked) => setHasSample(!!checked)} className="h-6 w-6 border-border data-[state=checked]:bg-primary rounded-lg" />
                <label htmlFor="has-sample" className="text-sm font-bold text-foreground cursor-pointer uppercase tracking-widest">¿Vino con muestra física aprobada?</label>
              </div>

              {/* RESUMEN TÉCNICO EN TIEMPO REAL (LDDEC 1.2) */}
              {currentSummaryData && (
                <div className="bg-primary/5 border border-primary/20 p-8 rounded-[2rem] space-y-4 animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Resumen Técnico del Contexto Activo</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm font-bold text-foreground">
                    <div className="bg-background px-4 py-2 rounded-xl border border-border flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      Lote {currentSummaryData.lot}
                    </div>
                    <span className="text-muted-foreground/30 hidden md:block">|</span>
                    <div className="text-primary flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Cantidad: {currentSummaryData.qty}
                    </div>
                    <span className="text-muted-foreground/30 hidden md:block">|</span>
                    <div className="flex-1 min-w-[300px]">
                      Procesos: <span className="text-primary font-black uppercase">{currentSummaryData.processes}</span>
                    </div>
                    <span className="text-muted-foreground/30 hidden md:block">|</span>
                    <div className="bg-background px-4 py-2 rounded-xl border border-border font-mono text-xs text-muted-foreground">
                      Ingreso: {currentSummaryData.entry}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-muted/20 p-10 border-t border-border flex justify-between items-center">
              <Button variant="outline" className="bg-background border-border text-muted-foreground font-bold h-12 px-10 rounded-2xl" onClick={() => setSelectedLot(null)} disabled={saving}>Cancelar Auditoría</Button>
              {!isReadOnly && (
                <Button className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest h-12 px-14 rounded-2xl shadow-xl transition-all active:scale-95" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />} Finalizar Revisión</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVO PROCESO RÁPIDAMENTE */}
      <Dialog open={isNewProcessDialogOpen} onOpenChange={setIsNewProcessDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <div className="p-8 border-b border-border bg-primary/5">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Nuevo Proceso Maestro</DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">
              Registro persistente en el catálogo técnico
            </DialogDescription>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre del Proceso</Label>
              <Input 
                autoFocus
                placeholder="EJ: STONE WASH PREMIUM"
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value.toUpperCase())}
                className="erp-input h-14 text-lg font-black"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewProcess()}
              />
              <p className="text-[9px] font-medium text-muted-foreground uppercase italic px-1">
                El proceso será añadido al catálogo y se aplicará al lote actual automáticamente.
              </p>
            </div>

            <DialogFooter className="gap-3 pt-4 border-t border-border/50">
              <Button 
                variant="ghost" 
                onClick={() => setIsNewProcessDialogOpen(false)} 
                className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px]"
                disabled={isCreatingProcess}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAddNewProcess} 
                disabled={isCreatingProcess || !newProcessName.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl h-12 font-black uppercase text-[10px] shadow-lg shadow-primary/20"
              >
                {isCreatingProcess ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Guardar y Aplicar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

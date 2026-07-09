"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  AlertTriangle, 
  Plus, 
  Loader2, 
  ClipboardList, 
  Truck, 
  CheckCircle2, 
  X,
  Edit3,
  Building2,
  Layers,
  Printer,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
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
  onSnapshot, 
  doc, 
  updateDoc,
  writeBatch, 
  Timestamp, 
  serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD VISIBLE (LOTE)
 * Prioridad expandida para todas las generaciones de datos
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

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD PARA INGRESOS (LDDEC 1.1)
 * Prioridad: numeroIngreso (Físico Real) > entryNumber > numeroIngresoMaestro > numero
 */
function getEntryVisible(item: any, id?: string): string {
  if (!item) return id || "S/I";
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
  return id || "S/I";
}

export default function FaltantesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processing, setProcessing] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [resForm, setResForm] = useState({
    tipoResolucion: "despacho", // "despacho" | "falla"
    numeroGuia: "",
    cantidad: 0,
    observacionesFalla: ""
  });

  const isReadOnly = user?.role === "socio";

  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const YEARS = [2025, 2026, 2027];

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const fromDate = new Date(selectedYear, selectedMonth, 1);
    const toDateObj = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    const tsFrom = Timestamp.fromDate(fromDate);
    const tsTo = Timestamp.fromDate(toDateObj);

    const unsubEntries = onSnapshot(
      query(collection(db, "entries"), where("date", ">=", tsFrom), where("date", "<=", tsTo)),
      (snap) => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubOutputs = onSnapshot(
      query(collection(db, "outputs"), where("date", ">=", tsFrom)),
      (snap) => {
        setOutputs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    return () => {
      unsubEntries();
      unsubOutputs();
    };
  }, [selectedMonth, selectedYear]);
  const faltantesData = useMemo(() => {
    const results: any[] = [];

    entries.forEach(entry => {
      (entry.lotes || []).forEach((lote: any) => {
        // Excluir si ya está marcado como resuelto de novedad o si es falla de lavado
        if (lote.isNoveltyResolved || lote.fallaLavado) {
          return;
        }

        const internalId = (lote.loteId || lote.id || lote.lotNumber || lote.numeroLote || "").toString().toUpperCase();
        const visibleLotName = getVisibleLotName(lote);
        
        const garmentsArr = Array.isArray(lote.originalPrendas) ? lote.originalPrendas : 
                           Array.isArray(lote.prendas) ? lote.prendas : 
                           Array.isArray(lote.garments) ? lote.garments : [];

        const qtyFromArr = garmentsArr.reduce((sum: number, p: any) => sum + (Number(p.quantity || p.cantidad || 0)), 0);
        const originalQuantity = qtyFromArr > 0 ? qtyFromArr : Number(lote.cantidadConfirmada || lote.quantity || lote.cantidad || 0);

        let salidaReferencia = "S/D";

        const totalDispatched = outputs.reduce((sum, out) => {
          const items = out.itemsDispatched || [];
          const itemMatch = items.find((it: any) => {
            const itInternal = (it.entryLotNumber || it.lotNumber || it.loteId || "").toString().toUpperCase();
            const itVisible = getVisibleLotName(it);
            return itInternal === internalId || itVisible === visibleLotName;
          });
          
          if (itemMatch) {
            if (itemMatch.reportarFaltante) {
               salidaReferencia = out.numeroSalida || "S/D";
            } else if (salidaReferencia === "S/D") {
               salidaReferencia = out.numeroSalida || "S/D";
            }
            return sum + (Number(itemMatch.quantityToDispatch || 0));
          }
          return sum;
        }, 0);

        // 1. Definición estricta de variables de negocio y cálculo de saldo pendiente
        const itemObj = {
          cantidadRecibida: originalQuantity,
          cantidadEnviada: totalDispatched
        };
        const cantidadFaltante = Number(itemObj.cantidadRecibida || 0) - Number(itemObj.cantidadEnviada || 0);

        // 2. Filtro estricto con doble candado: ya tuvo envío inicial (> 0) y mantiene saldo pendiente
        if (itemObj.cantidadEnviada > 0 && cantidadFaltante > 0) {
          const prenda = lote.garmentType || lote.prendas?.[0]?.tipo || lote.garments?.[0]?.garmentType || "Varios";

          results.push({
            id: `${entry.id}-${internalId}`, 
            loteId: visibleLotName,
            internalId,
            parentIngresoId: entry.id,
            visibleIngresoNumber: getEntryVisible(entry, entry.id),
            clientName: entry.clientName || entry.clienteNombre || "Socio",
            prenda,
            cantidadRecibida: originalQuantity,
            cantidadEnviada: totalDispatched,
            originalQuantity,
            totalDispatched,
            faltante: cantidadFaltante,
            salidaReferencia,
            productionStatus: lote.productionStatus,
            entryDateMs: entry.date?.toMillis ? entry.date.toMillis() : (entry.date?.seconds ? entry.date.seconds * 1000 : new Date(entry.entryDate || entry.date || 0).getTime()),
            entryDate: entry.entryDate || (entry.date?.toDate ? entry.date.toDate().toLocaleDateString('es-EC') : 'S/F'),
            loteRaw: lote,
            parentEntry: entry
          });
        }
      });
    });

    return results.filter(f => 
      f.loteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.visibleIngresoNumber.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.entryDateMs - a.entryDateMs);
  }, [entries, outputs, searchTerm]);

  const resolvedFaltantesData = useMemo(() => {
    const results: any[] = [];

    entries.forEach(entry => {
      (entry.lotes || []).forEach((lote: any) => {
        if (!(lote.isNoveltyResolved || lote.fallaLavado)) {
          return;
        }

        const internalId = (lote.loteId || lote.id || lote.lotNumber || lote.numeroLote || "").toString().toUpperCase();
        const visibleLotName = getVisibleLotName(lote);
        
        const garmentsArr = Array.isArray(lote.originalPrendas) ? lote.originalPrendas : 
                           Array.isArray(lote.prendas) ? lote.prendas : 
                           Array.isArray(lote.garments) ? lote.garments : [];

        const qtyFromArr = garmentsArr.reduce((sum: number, p: any) => sum + (Number(p.quantity || p.cantidad || 0)), 0);
        const originalQuantity = qtyFromArr > 0 ? qtyFromArr : Number(lote.cantidadConfirmada || lote.quantity || lote.cantidad || 0);

        let salidaReferencia = "S/D";

        const totalDispatched = outputs.reduce((sum, out) => {
          const items = out.itemsDispatched || [];
          const itemMatch = items.find((it: any) => {
            const itInternal = (it.entryLotNumber || it.lotNumber || it.loteId || "").toString().toUpperCase();
            const itVisible = getVisibleLotName(it);
            return itInternal === internalId || itVisible === visibleLotName;
          });
          
          if (itemMatch) {
            if (itemMatch.reportarFaltante) {
               salidaReferencia = out.numeroSalida || "S/D";
            } else if (salidaReferencia === "S/D") {
               salidaReferencia = out.numeroSalida || "S/D";
            }
            return sum + (Number(itemMatch.quantityToDispatch || 0));
          }
          return sum;
        }, 0);

        const prenda = lote.garmentType || lote.prendas?.[0]?.tipo || lote.garments?.[0]?.garmentType || "Varios";
        const cantidadFaltante = Number(originalQuantity || 0) - Number(totalDispatched || 0);

        results.push({
          id: `${entry.id}-${internalId}`, 
          loteId: visibleLotName,
          internalId,
          parentIngresoId: entry.id,
          parentEntry: entry,
          entryDateMs: entry.date?.toMillis ? entry.date.toMillis() : (entry.date?.seconds ? entry.date.seconds * 1000 : new Date(entry.entryDate || entry.date || 0).getTime()),
          entryDate: entry.entryDate || (entry.date?.toDate ? entry.date.toDate().toLocaleDateString('es-EC') : 'S/F'),
          visibleIngresoNumber: getEntryVisible(entry, entry.id),
          clientName: (entry.clientName || entry.clienteNombre || "Socio").toUpperCase(),
          prenda,
          originalQuantity,
          totalDispatched,
          faltante: cantidadFaltante,
          salidaReferencia,
          tipoResolucion: lote.fallaLavado ? "Falla Lavado" : "Despachado",
          fechaResolucion: lote.fechaResolucion ? new Date(lote.fechaResolucion).toLocaleDateString('es-EC') : '---',
          resueltoPor: lote.resueltoPor || "S/D"
        });
      });
    });

    return results.filter(f => 
      f.loteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.visibleIngresoNumber.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.entryDateMs - a.entryDateMs);
  }, [entries, outputs, searchTerm]);

  const handleUndoResolution = async (item: any) => {
    if (isReadOnly) return;
    if (!window.confirm(`¿Está seguro de revertir la resolución del lote ${item.loteId}? Volverá a aparecer como Faltante.`)) {
      return;
    }
    
    setProcessing(true);
    try {
      const entryRef = doc(db, "entries", item.parentIngresoId);
      const updatedLotes = item.parentEntry.lotes.map((l: any) => {
        const lid = getVisibleLotName(l);
        if (lid === item.loteId) {
          // Revertir todos los campos de resolución
          const { isNoveltyResolved, productionStatus, fallaLavado, observacionesFalla, resueltoPor, fechaResolucion, ...rest } = l;
          return {
            ...rest,
            productionStatus: "In Progress"
          };
        }
        return l;
      });
      
      await updateDoc(entryRef, { lotes: updatedLotes, updatedAt: serverTimestamp() });
      toast({ 
        title: "Resolución Revertida", 
        description: `El lote ${item.loteId} ha sido devuelto a la lista de faltantes.` 
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al revertir resolución" });
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenResolution = (item: any) => {
    if (isReadOnly) return;
    setSelectedItem(item);
    setResForm({
      tipoResolucion: "despacho",
      numeroGuia: "",
      cantidad: item.faltante,
      observacionesFalla: ""
    });
    setIsModalOpen(true);
  };

  const handleProcessResolution = async () => {
    if (isReadOnly) return;
    if (resForm.tipoResolucion === "despacho" && !resForm.numeroGuia) {
      toast({ variant: "destructive", title: "Falta número de guía de salida" });
      return;
    }
    if (resForm.cantidad <= 0) {
      toast({ variant: "destructive", title: "La cantidad a regularizar debe ser mayor a 0" });
      return;
    }

    setProcessing(true);
    try {
      const batch = writeBatch(db);

      if (resForm.tipoResolucion === "despacho") {
        const outputRef = doc(collection(db, "outputs"));
        const outputPayload = {
          numeroSalida: resForm.numeroGuia.toUpperCase(),
          date: serverTimestamp(),
          itemsDispatched: [{
            entryLotNumber: selectedItem.loteId,
            parentIngresoMaestro: selectedItem.parentIngresoId,
            parentIngresoNumber: selectedItem.visibleIngresoNumber,
            clientName: selectedItem.clientName,
            quantityToDispatch: resForm.cantidad,
            isMissingResolution: true
          }],
          status: "completed",
          notes: `Resolución de faltante para lote ${selectedItem.loteId}`,
          createdAt: serverTimestamp(),
          createdBy: user?.email || "system"
        };
        batch.set(outputRef, outputPayload);
      }

      const entryRef = doc(db, "entries", selectedItem.parentIngresoId);
      const updatedLotes = selectedItem.parentEntry.lotes.map((l: any) => {
        const lid = getVisibleLotName(l);
        if (lid === selectedItem.loteId) {
          return {
            ...l,
            isNoveltyResolved: true,
            productionStatus: "Completed",
            fallaLavado: resForm.tipoResolucion === "falla",
            observacionesFalla: resForm.tipoResolucion === "falla" ? resForm.observacionesFalla : "",
            resueltoPor: user?.email || "system",
            fechaResolucion: new Date().toISOString()
          };
        }
        return l;
      });
      batch.update(entryRef, { lotes: updatedLotes, updatedAt: serverTimestamp() });

      await batch.commit();
      toast({ 
        title: "Faltante Resuelto", 
        description: resForm.tipoResolucion === "falla" 
          ? "Lote marcado como falla de lavado y regularizado." 
          : "Guía de salida generada y lote regularizado." 
      });
      setIsModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al procesar" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
        <div className="space-y-1">
          <h1 className="text-5xl font-black tracking-tighter uppercase">Gestión de Faltantes</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Control de Novedades y Despachos Pendientes</p>
          {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2">
            <Printer className="h-4 w-4" /> Imprimir Auditoría
          </Button>
          <div className="bg-card px-8 py-2 rounded-2xl border border-border flex items-center gap-6 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Discrepancias</span>
              <span className="text-3xl font-black text-red-500">{loading ? "..." : faltantesData.length}</span>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500/40" />
          </div>
        </div>
      </div>

      <div className="hidden print:block text-center mb-10 space-y-2">
        <img 
          src="/logo-lddec.png" 
          alt="Logo" 
          style={{ width: '2.5cm', height: '2.5cm', objectFit: 'contain', margin: '0 auto 10px auto', display: 'block' }} 
        />
        <h1 className="text-2xl font-black uppercase text-black">LAVANDERÍA DE DECORACIONES (LDDEC)</h1>
        <h2 className="text-lg font-bold uppercase text-black">AUDITORÍA DE PRENDAS FALTANTES</h2>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest print:text-black">
          Periodo: {MONTHS[selectedMonth]} {selectedYear}
        </p>
      </div>

      <div className="bg-card p-4 rounded-2xl border border-border flex flex-col lg:flex-row items-center gap-4 shadow-sm print:hidden">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por Lote, Cliente o Ingreso..." 
            className="pl-12 erp-input h-12" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* FILTRO DE FECHAS (MES Y AÑO) */}
        <div className="flex gap-2 w-full lg:w-auto">
          <Select 
            value={selectedMonth.toString()} 
            onValueChange={(val) => setSelectedMonth(parseInt(val))}
          >
            <SelectTrigger className="w-[150px] erp-input h-12 rounded-xl font-bold text-xs uppercase bg-muted/10 border-border">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, idx) => (
                <SelectItem key={idx} value={idx.toString()} className="font-bold text-xs uppercase">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedYear.toString()} 
            onValueChange={(val) => setSelectedYear(parseInt(val))}
          >
            <SelectTrigger className="w-[110px] erp-input h-12 rounded-xl font-bold text-xs bg-muted/10 border-border">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y.toString()} className="font-bold text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />
        <div className="bg-muted/30 px-6 py-2 rounded-full border border-border text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          Auditoría de Faltantes ({MONTHS[selectedMonth]} {selectedYear})
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-border bg-card overflow-hidden shadow-premium min-h-[400px] print:border-black print:rounded-none">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Analizando trazabilidad...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow className="border-border print:border-black">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-5 pl-8 print:text-black">Fecha Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">N° Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">N° Lote</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">N° Salida</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">Cliente</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">Prenda</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center print:text-black">Cant. Orig.</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center print:text-black">Despachado</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right print:text-black">Faltante</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right pr-8 print:hidden">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faltantesData.length > 0 ? (
                faltantesData.map((item) => (
                  <TableRow key={item.id} className="border-border hover:bg-muted/10 transition-colors group print:border-black">
                    <TableCell className="pl-8 py-4">
                      <span className="text-xs font-medium text-muted-foreground print:text-black">{item.entryDate}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-primary print:text-black">{item.visibleIngresoNumber}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-black print:text-black">{item.loteId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-bold text-amber-600 print:text-black">{item.salidaReferencia}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-bold uppercase truncate block max-w-[150px] print:text-black">{item.clientName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-medium uppercase text-muted-foreground truncate block max-w-[120px] print:text-black">{item.prenda}</span>
                    </TableCell>
                    <TableCell className="text-center font-bold print:text-black">{item.originalQuantity}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-emerald-600 print:text-black">{item.totalDispatched}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-500 font-semibold tracking-tighter print:text-black">-{item.faltante}</span>
                    </TableCell>
                    <TableCell className="text-right pr-8 print:hidden">
                      {!isReadOnly && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenResolution(item)}
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <ClipboardList className="h-16 w-16 mb-4" />
                      <p className="text-sm font-black uppercase tracking-[0.3em]">Sin faltantes pendientes de resolución</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-4 pt-6 print:hidden">
        <div className="bg-muted/30 px-6 py-2 rounded-full border border-border text-[10px] font-black uppercase text-muted-foreground tracking-widest w-fit">
          Historial de Faltantes Resueltos ({MONTHS[selectedMonth]} {selectedYear})
        </div>
        
        <div className="rounded-[2.5rem] border border-border bg-card overflow-hidden shadow-premium min-h-[150px]">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-5 pl-8">Fecha Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">N° Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">N° Lote</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Resolución</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Faltante</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Fecha Res.</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Usuario</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right pr-8">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolvedFaltantesData.length > 0 ? (
                resolvedFaltantesData.map((item) => (
                  <TableRow key={item.id} className="border-border hover:bg-muted/10 transition-colors group opacity-85">
                    <TableCell className="pl-8 py-4">
                      <span className="text-xs font-medium text-muted-foreground">{item.entryDate}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-primary">{item.visibleIngresoNumber}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-black">{item.loteId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-bold uppercase truncate block max-w-[150px]">{item.clientName}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        item.tipoResolucion === "Falla Lavado" 
                          ? "bg-rose-50 text-rose-700 border-rose-100" 
                          : "bg-emerald-50 text-emerald-700 border-emerald-100"
                      )}>
                        {item.tipoResolucion}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-bold text-muted-foreground">
                      {item.faltante}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {item.fechaResolucion}
                    </TableCell>
                    <TableCell className="text-[10px] font-medium text-muted-foreground truncate max-w-[100px]">
                      {item.resueltoPor}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      {!isReadOnly && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUndoResolution(item)}
                          className="h-9 w-9 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
                          title="Deshacer resolución y devolver a faltantes"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <ClipboardList className="h-8 w-8 mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin faltantes resueltos en este periodo</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
          <div className="p-8 border-b border-border bg-primary/5">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Resolver Faltante</DialogTitle>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">Generar Guía de Salida Complementaria</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="bg-muted/30 p-5 rounded-2xl border border-border space-y-3">
              <div className="flex justify-between text-[10px] font-black uppercase">
                <span className="text-muted-foreground">Lote:</span>
                <span className="text-foreground">{selectedItem?.loteId}</span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase">
                <span className="text-muted-foreground">Socio:</span>
                <span className="text-foreground truncate max-w-[150px]">{selectedItem?.clientName}</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-[10px] font-black uppercase">
                <span className="text-red-500">Saldo Faltante:</span>
                <span className="text-red-500 font-bold">{selectedItem?.faltante} prendas</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Tipo de Resolución</Label>
                <Select 
                  value={resForm.tipoResolucion} 
                  onValueChange={(val) => setResForm({...resForm, tipoResolucion: val})}
                >
                  <SelectTrigger className="erp-input h-12 rounded-xl font-bold text-xs uppercase bg-muted/10 border-border">
                    <SelectValue placeholder="Seleccione tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despacho" className="font-bold text-xs uppercase">Registrar Despacho (Guía)</SelectItem>
                    <SelectItem value="falla" className="font-bold text-xs uppercase">Falla de Lavado (Lote Dañado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {resForm.tipoResolucion === "despacho" ? (
                <div className="space-y-1.5 animate-in fade-in duration-300">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">N° Guía de Salida</Label>
                  <Input 
                    value={resForm.numeroGuia} 
                    onChange={e => setResForm({...resForm, numeroGuia: e.target.value.toUpperCase()})}
                    placeholder="Ej: SAL-RESOL-001" 
                    className="erp-input h-12 font-bold" 
                  />
                </div>
              ) : (
                <div className="space-y-1.5 animate-in fade-in duration-300">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Detalle / Observaciones de Falla</Label>
                  <Input 
                    value={resForm.observacionesFalla} 
                    onChange={e => setResForm({...resForm, observacionesFalla: e.target.value})}
                    placeholder="Ej: Prenda rota en proceso de centrifugado / encogimiento excesivo" 
                    className="erp-input h-12 font-semibold text-xs" 
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Cantidad a Regularizar</Label>
                <Input 
                  type="number" 
                  value={resForm.cantidad} 
                  onChange={e => setResForm({...resForm, cantidad: parseInt(e.target.value) || 0})}
                  max={selectedItem?.faltante}
                  className="erp-input h-16 text-4xl font-black text-center text-primary" 
                />
              </div>
            </div>

            <DialogFooter className="pt-4 gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-12 px-6 rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
              <Button 
                onClick={handleProcessResolution} 
                disabled={processing}
                className="h-12 flex-1 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar Resolución
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

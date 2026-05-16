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
  Printer
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
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [resForm, setResForm] = useState({
    numeroGuia: "",
    cantidad: 0
  });

  const isReadOnly = user?.role === "socio";

  useEffect(() => {
    if (!db) return;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const tsLimit = Timestamp.fromDate(sixMonthsAgo);

    const unsubEntries = onSnapshot(
      query(collection(db, "entries"), where("date", ">=", tsLimit)),
      (snap) => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubOutputs = onSnapshot(
      query(collection(db, "outputs"), where("date", ">=", tsLimit)),
      (snap) => {
        setOutputs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    return () => {
      unsubEntries();
      unsubOutputs();
    };
  }, []);

  const faltantesData = useMemo(() => {
    const results: any[] = [];

    entries.forEach(entry => {
      (entry.lotes || []).forEach((lote: any) => {
        const internalId = (lote.loteId || lote.id || lote.lotNumber || lote.numeroLote || "").toString().toUpperCase();
        const visibleLotName = getVisibleLotName(lote);
        
        const garmentsArr = Array.isArray(lote.originalPrendas) ? lote.originalPrendas : 
                           Array.isArray(lote.prendas) ? lote.prendas : 
                           Array.isArray(lote.garments) ? lote.garments : [];

        const qtyFromArr = garmentsArr.reduce((sum: number, p: any) => sum + (Number(p.quantity || p.cantidad || 0)), 0);
        const originalQuantity = qtyFromArr > 0 ? qtyFromArr : Number(lote.cantidadConfirmada || lote.quantity || lote.cantidad || 0);

        const totalDispatched = outputs.reduce((sum, out) => {
          const items = out.itemsDispatched || [];
          const itemMatch = items.find((it: any) => {
            const itInternal = (it.entryLotNumber || it.lotNumber || it.loteId || "").toString().toUpperCase();
            const itVisible = getVisibleLotName(it);
            return itInternal === internalId || itVisible === visibleLotName;
          });
          return sum + (itemMatch ? Number(itemMatch.quantityToDispatch || 0) : 0);
        }, 0);

        const faltante = originalQuantity - totalDispatched;
        const isUnresolved = lote.isNoveltyResolved === false || lote.isNoveltyResolved === undefined;

        if (isUnresolved && faltante > 0 && (lote.productionStatus === "Missing" || totalDispatched > 0)) {
          const prenda = lote.garmentType || lote.prendas?.[0]?.tipo || lote.garments?.[0]?.garmentType || "Varios";

          results.push({
            id: `${entry.id}-${internalId}`, 
            loteId: visibleLotName,
            internalId,
            parentIngresoId: entry.id,
            visibleIngresoNumber: getEntryVisible(entry, entry.id),
            clientName: entry.clientName || entry.clienteNombre || "Socio",
            prenda,
            originalQuantity,
            totalDispatched,
            faltante,
            productionStatus: lote.productionStatus,
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
    ).sort((a, b) => b.faltante - a.faltante);
  }, [entries, outputs, searchTerm]);

  const handleOpenResolution = (item: any) => {
    if (isReadOnly) return;
    setSelectedItem(item);
    setResForm({
      numeroGuia: "",
      cantidad: item.faltante
    });
    setIsModalOpen(true);
  };

  const handleProcessResolution = async () => {
    if (isReadOnly) return;
    if (!resForm.numeroGuia || resForm.cantidad <= 0) {
      toast({ variant: "destructive", title: "Datos incompletos" });
      return;
    }

    setProcessing(true);
    try {
      const batch = writeBatch(db);

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

      const entryRef = doc(db, "entries", selectedItem.parentIngresoId);
      const updatedLotes = selectedItem.parentEntry.lotes.map((l: any) => {
        const lid = getVisibleLotName(l);
        if (lid === selectedItem.loteId) {
          return {
            ...l,
            isNoveltyResolved: true,
            productionStatus: "Completed",
            resueltoPor: user?.email || "system",
            fechaResolucion: new Date().toISOString()
          };
        }
        return l;
      });
      batch.update(entryRef, { lotes: updatedLotes, updatedAt: serverTimestamp() });

      await batch.commit();
      toast({ title: "Faltante Resuelto", description: "Guía de salida generada y lote regularizado." });
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
        <div className="flex-1" />
        <div className="bg-muted/30 px-6 py-2 rounded-full border border-border text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          Auditoría en Tiempo Real (Últimos 6 meses)
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
                  <TableCell colSpan={9} className="h-64 text-center">
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
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">N° Guía de Salida</Label>
                <Input 
                  value={resForm.numeroGuia} 
                  onChange={e => setResForm({...resForm, numeroGuia: e.target.value.toUpperCase()})}
                  placeholder="Ej: SAL-RESOL-001" 
                  className="erp-input h-12 font-bold" 
                />
              </div>
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

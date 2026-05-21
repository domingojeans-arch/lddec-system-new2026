"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowUpCircle,
  Calendar,
  Building2,
  Shirt,
  Truck,
  CheckCircle2,
  Layers,
  Zap,
  Printer,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderToStaticMarkup } from 'react-dom/server';
import { printHtml } from '@/lib/printHtml';
import { SalidaPrintContent } from './SalidaPrintContent';
import { cn } from "@/lib/utils";

interface OutputDetailProps {
  output: any;
  onClose: () => void;
}

function getGuiaVisible(item: any): string {
  const candidates = [item?.numeroSalida, item?.numeroGuia, item?.outputNumber, item?.id];
  for (const val of candidates) {
    if (val && String(val).trim() && String(val).length < 18) {
      return String(val).trim().toUpperCase();
    }
  }
  return "GUÍA S/N";
}

function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [
    lote.entryLotNumber,
    lote.lotNumber,
    lote.numeroLote,
    lote.loteId,
    lote.id
  ];

  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]") {
      return s.toUpperCase();
    }
  }
  return "S/L";
}

export function OutputDetail({ output, onClose }: OutputDetailProps) {
  const [startLine, setStartLine] = useState("1");
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [colorImpresion, setColorImpresion] = useState<"negro" | "azul">("negro");

  const getFecha = (raw: any) => {
    if (!raw) return "---";
    let d: Date;
    if (typeof raw.toDate === "function") d = raw.toDate();
    else d = new Date(raw);
    if (isNaN(d.getTime())) return "---";
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const items = Array.isArray(output?.itemsDispatched) ? output.itemsDispatched : [];

  const toggleIndex = (idx: number) => {
    setSelectedIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const totalDespachado = items.reduce((acc: number, it: any) => acc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);
  const totalMuestras = Number(output?.numeroMuestras || 0);
  const totalGeneral = totalDespachado + totalMuestras;

  const clientName = (output?.containedClientNames?.[0] || output?.clienteNombre || output?.clientName || "SOCIO INDUSTRIAL").toString().toUpperCase();

  const handlePrint = () => {
    if (!output) return;
    const itemsToPrint = selectedIndices.length > 0
      ? items.filter((_: any, idx: number) => selectedIndices.includes(idx))
      : items;

    const outputToPrint = { ...output, itemsDispatched: itemsToPrint };
    const html = renderToStaticMarkup(
      <SalidaPrintContent 
        salida={outputToPrint} 
        startAtLine={parseInt(startLine)} 
        colorImpresion={colorImpresion} 
      />
    );
    printHtml(html);
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
      {/* SECTION 1: MASTER DATA COMPACT */}
      <div className="flex-none bg-muted/10 p-6 rounded-t-2xl border-b border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Truck className="h-20 w-20" /></div>
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          {/* INFORMACIÓN IZQUIERDA */}
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white"><ArrowUpCircle className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                  {getGuiaVisible(output)}
                </h2>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-none px-2 h-5 mt-0.5 font-bold uppercase text-[8px] tracking-widest">
                  Guardado
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Socio</p>
                <p className="font-bold text-xs uppercase truncate max-w-[150px]">{clientName}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Fecha</p>
                <p className="font-bold text-xs">{getFecha(output.date || output.fechaSalida || output.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* TOTAL CENTRAL */}
          <div className="flex-1 flex justify-center">
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 min-w-[140px] text-center shadow-sm">
              <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-0.5">Total Prendas</p>
              <p className="text-3xl font-black text-primary tracking-tighter">{totalGeneral}</p>
            </div>
          </div>

          {/* BALANCEADOR DERECHO CON BOTÓN CERRAR MANUAL */}
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: ITEMS LIST COMPACT */}
      <div className="flex-1 flex flex-col min-h-0 px-4 mt-6">
        <h3 className="flex-none text-sm font-black uppercase tracking-tight flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-primary" /> Lotes
        </h3>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-2">
            {items.map((line: any, idx: number) => {
              const isSelected = selectedIndices.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleIndex(idx)}
                  className={cn(
                    "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                    isSelected ? "bg-primary/5 border-primary shadow-sm" : "bg-card border-border hover:bg-muted/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleIndex(idx)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase">{getVisibleLotName(line)}</span>
                        <span className="text-[9px] font-bold text-muted-foreground">ING: {line.parentIngresoNumber || "S/I"}</span>
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">{line.garmentType || "Prendas"} • {line.process || "S/D"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary text-xl">{line.quantityToDispatch || line.quantity || 0}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* SECTION 3: PRINT CONTROL COMPACT */}
      <div className="p-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/5 mt-4 rounded-b-2xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Renglón Inicial</p>
            <Select value={startLine} onValueChange={setStartLine}>
              <SelectTrigger className="w-24 h-8 text-[10px] font-bold bg-background rounded-lg border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-48 rounded-xl shadow-xl">{Array.from({ length: 21 }, (_, i) => (<SelectItem key={i + 1} value={(i + 1).toString()} className="text-[10px] font-bold">Línea {i + 1}</SelectItem>))}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Color de Impresión</p>
            <div className="flex bg-background border border-border rounded-lg p-0.5 h-8">
              <button
                type="button"
                onClick={() => setColorImpresion("negro")}
                className={cn(
                  "px-3 text-[9px] font-bold uppercase rounded-md transition-all",
                  colorImpresion === "negro"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Negro
              </button>
              <button
                type="button"
                onClick={() => setColorImpresion("azul")}
                className={cn(
                  "px-3 text-[9px] font-bold uppercase rounded-md transition-all",
                  colorImpresion === "azul"
                    ? "bg-[#0f172a] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Azul
              </button>
            </div>
          </div>

          {selectedIndices.length > 0 && <p className="text-[9px] font-black text-primary uppercase">Parcial ({selectedIndices.length} lotes)</p>}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={onClose} variant="ghost" className="flex-1 sm:flex-none h-10 px-4 text-[10px] font-bold uppercase">Cerrar</Button>
          <Button onClick={handlePrint} className="flex-1 sm:flex-none h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] tracking-widest gap-2 shadow-lg"><Printer className="h-3.5 w-3.5" /> Imprimir</Button>
        </div>
      </div>
    </div>
  );
}
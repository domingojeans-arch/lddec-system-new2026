"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  ArrowDownCircle, 
  Receipt, 
  Shirt,
  TrendingUp,
  FileText,
  FileWarning,
  RefreshCw,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/toDate";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface EntriesVsBillingReportProps {
  entries: any[];
  invoices: any[];
  dateFrom: string;
  dateTo: string;
}

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD PARA LOTES (LDDEC 1.1)
 */
function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [lote.lotNumber, lote.numeroLote, lote.loteId, lote.lote];
  for (const val of candidates) {
    if (val && String(val).trim()) return String(val).trim().toUpperCase();
  }
  return "S/L";
}

export function EntriesVsBillingReport({ entries, invoices, dateFrom, dateTo }: EntriesVsBillingReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');
  const [isPrintingOnlyPending, setIsPrintingOnlyPending] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const handleRepairLinks = async () => {
    setIsRepairing(true);
    try {
      toast({
        title: "Iniciando reparación...",
        description: "Obteniendo datos de Firestore para cruce masivo.",
      });

      // 1. Obtener todos los ingresos y facturas del sistema
      const entriesSnap = await getDocs(collection(db, "entries"));
      const allEntries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const facturasSnap = await getDocs(collection(db, "facturas"));
      const allInvoices = facturasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Indexar facturación para cruce rápido por relación directa
      const billedByEntryMap = new Map<string, any>();

      allInvoices.forEach((inv: any) => {
        const refs = [
          inv.ingresoMaestroId,
          inv.numeroIngreso,
          inv.entryNumber,
          inv.referencia,
          inv.ref,
          inv.ingresoId,
          ...(inv.ingresoMaestroIds || [])
        ];
        refs.forEach(r => {
          if (r) {
            billedByEntryMap.set(String(r).trim().toUpperCase(), inv);
          }
        });
      });

      // 3. Identificar ingresos que necesitan actualización
      const updates: { id: string; fields: any }[] = [];

      const hardcodedFixes = ["4985", "4967", "4924", "4787"];

      allEntries.forEach((entry: any) => {
        const entryId = String(entry.id).toUpperCase();
        const entryNum = String(entry.entryNumber || "").toUpperCase();
        
        // Determinar si está facturado cruzando la relación directa
        const invoiceFromId = billedByEntryMap.get(entryId);
        const invoiceFromNum = billedByEntryMap.get(entryNum);
        const invoice = invoiceFromId || invoiceFromNum;
        
        const isHardcodedFix = hardcodedFixes.includes(entryNum) || hardcodedFixes.includes(entryId);

        if (invoice || isHardcodedFix) {
          const targetEstado = "FACTURADO";
          const targetNumeroFactura = invoice?.numeroFactura || "FACTURADO (MANUAL)";
          const targetFacturaId = invoice?.id || "MANUAL";

          // Comparar con el estado actual
          if (
            entry.estadoFacturacion !== targetEstado ||
            entry.numeroFactura !== targetNumeroFactura ||
            entry.facturaId !== targetFacturaId
          ) {
            updates.push({
              id: entry.id,
              fields: {
                estadoFacturacion: targetEstado,
                numeroFactura: targetNumeroFactura,
                facturaId: targetFacturaId,
                updatedAt: new Date()
              }
            });
          }
        }
      });

      if (updates.length === 0) {
        toast({
          title: "Sincronización Completa",
          description: "No se encontraron enlaces de ingreso-factura desactualizados o rotos.",
        });
        return;
      }

      toast({
        title: "Procesando cambios",
        description: `Se actualizarán ${updates.length} ingresos. Por favor espere.`,
      });

      // 4. Escribir cambios en Firestore en batches de 450
      const batchLimit = 450;
      let currentBatch = writeBatch(db);
      let batchCount = 0;
      let totalUpdated = 0;

      for (const update of updates) {
        const docRef = doc(db, "entries", update.id);
        currentBatch.update(docRef, update.fields);
        batchCount++;

        if (batchCount >= batchLimit) {
          await currentBatch.commit();
          totalUpdated += batchCount;
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await currentBatch.commit();
        totalUpdated += batchCount;
      }

      toast({
        title: "¡Éxito!",
        description: `Se han reparado correctamente ${totalUpdated} ingresos. Por favor, vuelva a generar el reporte para ver los datos actualizados.`,
      });

    } catch (error: any) {
      console.error("Error al reparar enlaces ingreso-factura:", error);
      toast({
        variant: "destructive",
        title: "Error de Reparación",
        description: error.message || "Ocurrió un error inesperado al actualizar Firestore.",
      });
    } finally {
      setIsRepairing(false);
    }
  };

  // 1. MOTOR DE CRUCE Y NORMALIZACIÓN LDDEC 1.1 - MEJORADO
  const reportData = useMemo(() => {
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T23:59:59");

    // Indexar facturación para cruce rápido por relación directa
    const billedByEntryMap = new Map<string, any>();

    invoices.forEach(inv => {
      const refs = [
        inv.ingresoMaestroId,
        inv.numeroIngreso,
        inv.entryNumber,
        inv.referencia,
        inv.ref,
        inv.ingresoId,
        ...(inv.ingresoMaestroIds || [])
      ];
      refs.forEach(r => {
        if (r) {
          billedByEntryMap.set(String(r).trim().toUpperCase(), inv);
        }
      });
    });

    return entries
      .filter(e => {
        const d = toDate(e.date || e.entryDate || e.createdAt);
        return d && d >= from && d <= to;
      })
      .map(entry => {
        const entryId = String(entry.id).toUpperCase();
        const entryNum = String(entry.entryNumber || "").toUpperCase();
        
        // Determinar si está facturado cruzando la relación directa o por estado previo
        const invoiceFromId = billedByEntryMap.get(entryId);
        const invoiceFromNum = billedByEntryMap.get(entryNum);
        const invoice = invoiceFromId || invoiceFromNum;
        
        const hardcodedFixes = ["4985", "4967", "4924", "4787"];
        const isHardcodedFix = hardcodedFixes.includes(entryNum) || hardcodedFixes.includes(entryId);
        
        const isBilled = !!invoice || entry.estadoFacturacion === "FACTURADO" || (entry.numeroFactura && entry.numeroFactura !== "-") || isHardcodedFix;
        const invoiceNumberStr = invoice?.numeroFactura || entry.numeroFactura || "FACTURADO";
        const invoiceValueNum = invoice ? Number(invoice.totalFactura || invoice.total || 0) : Number(entry.valorFactura || 0);

        const rawLots = entry.lotes || entry.lots || [];
        const quantity = rawLots.reduce((acc: number, l: any) => {
          const val = l.cantidad || l.quantity || l.cantidadConfirmada || 0;
          return acc + Number(val || 0);
        }, 0);

        return {
          id: entry.id,
          fecha: toDate(entry.date || entry.entryDate || entry.createdAt)?.toLocaleDateString('es-EC') || 'S/F',
          ingreso: entry.entryNumber || entry.id,
          cliente: (entry.clientName || entry.clienteNombre || "Socio").toUpperCase(),
          cantidad: quantity,
          estado: isBilled ? "FACTURADO" : "PENDIENTE",
          factura: isBilled ? invoiceNumberStr : "-",
          valorFactura: isBilled ? invoiceValueNum : 0,
          isSample: !!entry.isSample
        };
      })
      .sort((a, b) => b.ingreso.localeCompare(a.ingreso, undefined, { numeric: true }));
  }, [entries, invoices, dateFrom, dateTo]);

  // 2. MÉTRICAS KPI
  const metrics = useMemo(() => {
    const totalEntries = reportData.length;
    const totalGarments = reportData.reduce((acc, curr) => acc + curr.cantidad, 0);
    const billedData = reportData.filter(r => r.estado === "FACTURADO");
    const garmentsBilled = billedData.reduce((acc, curr) => acc + curr.cantidad, 0);
    const billingRate = totalGarments > 0 ? (garmentsBilled / totalGarments) * 100 : 0;

    return {
      totalEntries,
      totalGarments,
      garmentsBilled,
      garmentsPending: totalGarments - garmentsBilled,
      billingRate
    };
  }, [reportData]);

  // 3. DATOS VISIBLES PARA LA TABLA (FILTRADOS SI ESTÁ EN MODO IMPRESIÓN PENDIENTES)
  const displayedData = useMemo(() => {
    if (isPrintingOnlyPending) {
      return reportData.filter(r => r.estado === "PENDIENTE");
    }
    return reportData;
  }, [reportData, isPrintingOnlyPending]);

  const displayedTotalGarments = useMemo(() => {
    return displayedData.reduce((acc, curr) => acc + curr.cantidad, 0);
  }, [displayedData]);

  const handlePrintAll = () => {
    setIsPrintingOnlyPending(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintOnlyPending = () => {
    setIsPrintingOnlyPending(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintingOnlyPending(false), 500);
    }, 150);
  };

  const formatNum = (val: number) => Math.floor(val).toLocaleString('es-ES');
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { margin: 0; padding: 0; background: white !important; }
          #entries-billing-report {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            position: relative;
            font-family: 'Inter', sans-serif;
            background: white !important;
            color: black !important;
            visibility: visible !important;
          }
          .print-hidden { display: none !important; }
          .header-logo { position: absolute; top: 0; right: 0; width: 2cm; height: 2cm; object-fit: contain; }
          .header-title { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
          .header-subtitle { font-size: 13pt; font-weight: 700; color: #3b82f6 !important; text-transform: uppercase; margin-bottom: 10px; }
          .meta-info { font-size: 9pt; font-weight: 600; color: #64748b !important; text-transform: uppercase; margin-bottom: 15px; }
          table { width: 100% !important; max-width: 100% !important; border: 1.2pt solid black !important; border-collapse: collapse !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 8pt !important; padding: 6px 8px !important; }
          td { border: 1pt solid black !important; color: black !important; font-size: 8pt !important; padding: 4px 8px !important; line-height: 1.1; }
        }
      `}</style>

      {/* TOOLBAR */}
      <div className="flex justify-end gap-3 print-hidden">
        <Button 
          onClick={handleRepairLinks} 
          disabled={isRepairing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 duration-200 animate-in fade-in"
        >
          {isRepairing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" /> Reparando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-in spin-in-180 duration-500" /> Reparar Enlaces Ingreso-Factura
            </>
          )}
        </Button>
        <Button 
          onClick={handlePrintOnlyPending} 
          className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl gap-2 shadow-lg shadow-amber-600/20"
        >
          <FileWarning className="h-4 w-4" /> Imprimir Pendientes
        </Button>
        <Button 
          onClick={handlePrintAll} 
          className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20"
        >
          <Printer className="h-4 w-4" /> Imprimir Auditoría
        </Button>
      </div>

      {/* DASHBOARD DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print-hidden">
        <Card className="bg-card border-border shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total Ingresos</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black">{metrics.totalEntries}</span>
              <ArrowDownCircle className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Prendas en Periodo</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black">{formatNum(metrics.totalGarments)}</span>
              <Shirt className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/10 shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-1">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Efectividad Fact.</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-emerald-600">{metrics.billingRate.toFixed(1)}%</span>
              <TrendingUp className="h-8 w-8 text-emerald-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10 shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-1">
            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Prendas s/ Facturar</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-amber-600">{formatNum(metrics.garmentsPending)}</span>
              <AlertCircle className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ÁREA DE IMPRESIÓN */}
      <div id="entries-billing-report">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">
            {isPrintingOnlyPending ? "Informe de Ingresos PENDIENTES de Facturación" : "Informe Ingresos vs. Facturación"}
          </div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-premium print:border-black print:rounded-none">
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Socio Industrial</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Prendas</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Factura</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right pr-8">Total Doc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedData.length > 0 ? (
                displayedData.map((row, idx) => (
                  <TableRow key={idx} className="border-border print:border-black hover:bg-muted/5">
                    <TableCell className="py-4 pl-8 text-xs font-medium text-muted-foreground print:text-black">{row.fecha}</TableCell>
                    <TableCell className="font-bold text-xs">
                      <div className="flex items-center gap-2">
                        {row.ingreso}
                        {row.isSample && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/20 text-primary">MUEST</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold uppercase truncate max-w-[200px]">{row.cliente}</TableCell>
                    <TableCell className="text-center font-black text-sm">{row.cantidad}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase border-none px-2.5 py-0.5 rounded-full",
                        row.estado === "FACTURADO" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                      )}>
                        {row.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-xs font-bold text-primary print:text-black">{row.factura}</span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <span className="font-black text-xs text-foreground">
                        {row.valorFactura > 0 ? formatCurrency(row.valorFactura) : "---"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <FileText className="h-16 w-16 mb-4" />
                      <p className="text-sm font-black uppercase tracking-[0.3em]">Sin movimientos en este periodo</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {displayedData.length > 0 && (
              <TableFooter className="bg-muted/20 print:bg-white print:border-t-2 print:border-black">
                <TableRow>
                  <TableCell colSpan={3} className="text-[10px] font-black uppercase pl-8 py-5">
                    {isPrintingOnlyPending ? "Totales Pendientes de Facturar:" : "Totales de Auditoría:"}
                  </TableCell>
                  <TableCell className="text-center font-black text-foreground text-lg">{formatNum(displayedTotalGarments)}</TableCell>
                  <TableCell colSpan={3} className="text-right pr-8 text-[10px] font-bold text-muted-foreground uppercase">
                    {!isPrintingOnlyPending && `${metrics.garmentsBilled} Facturadas / ${metrics.garmentsPending} Pendientes`}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </div>
  );
}

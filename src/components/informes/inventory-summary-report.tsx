"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryMetrics } from "@/lib/inventoryEngine";

interface InventorySummaryReportProps {
  metrics: InventoryMetrics;
  dateFrom: string;
  dateTo: string;
  allEntries?: any[];
  allOutputs?: any[];
  allInvoices?: any[];
}

export function InventorySummaryReport({ 
  metrics, 
  dateFrom, 
  dateTo,
  allEntries = [],
  allOutputs = [],
  allInvoices = []
}: InventorySummaryReportProps) {
  
  const formatNum = (val: number) => {
    return Math.floor(val).toLocaleString('es-ES');
  };

  const handlePrint = () => {
    const params = new URLSearchParams({
      si: metrics.stockInicial.toString(),
      in: metrics.ingresosPeriodo.toString(),
      out: metrics.despachosPeriodo.toString(),
      df: metrics.despachadasFacturadas.toString(),
      dsf: metrics.despachadasSinFacturar.toString(),
      sf: metrics.stockFinal.toString(),
      from: dateFrom,
      to: dateTo
    });
    
    window.open(`/print/informes/resumen?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-8 print:hidden">
      <Card className="max-w-4xl mx-auto border-border shadow-sm rounded-3xl overflow-hidden bg-card">
        <div className="p-8 border-b border-border flex items-center justify-between bg-muted/10">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-black uppercase tracking-tight">Resumen de Inventario</h2>
          </div>
          <Button 
            onClick={handlePrint}
            className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20"
          >
            <Printer className="h-4 w-4" />
            Imprimir Reporte Gerencial
          </Button>
        </div>

        <CardContent className="p-10">
          <div className="border border-border rounded-2xl overflow-hidden bg-background shadow-inner">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-14 font-black uppercase tracking-widest pl-8 text-xs">
                    Métrica Operativa
                  </TableHead>
                  <TableHead className="h-14 font-black uppercase tracking-widest text-right pr-8 text-xs">
                    Cantidad (Prendas)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableCell className="h-14 pl-8 font-medium text-foreground text-sm">
                    Stock Inicial (Prendas en Bodega al inicio del periodo)
                  </TableCell>
                  <TableCell className="h-14 pr-8 text-right font-bold text-base tabular-nums">
                    {formatNum(metrics.stockInicial)}
                  </TableCell>
                </TableRow>

                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableCell className="h-14 pl-8 font-semibold text-emerald-600 border-r-0 uppercase tracking-tight text-sm">
                    (+) Total Prendas Ingresadas en Periodo
                  </TableCell>
                  <TableCell className="h-14 pr-8 text-right font-black text-emerald-600 text-lg tabular-nums">
                    {formatNum(metrics.ingresosPeriodo)}
                  </TableCell>
                </TableRow>

                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableCell className="h-14 pl-8 font-semibold text-red-600 border-r-0 uppercase tracking-tight text-sm">
                    (-) Total Prendas Despachadas en Periodo
                  </TableCell>
                  <TableCell className="h-14 pr-8 text-right font-black text-red-600 text-lg tabular-nums">
                    {formatNum(metrics.despachosPeriodo)}
                  </TableCell>
                </TableRow>

                <TableRow className="border-b border-border/20 hover:bg-transparent bg-muted/5">
                  <TableCell className="h-10 pl-14 text-muted-foreground font-medium text-xs italic">
                    • de las cuales, despachadas Y facturadas
                  </TableCell>
                  <TableCell className="h-10 pr-8 text-right text-muted-foreground font-bold text-xs tabular-nums">
                    {formatNum(metrics.despachadasFacturadas)}
                  </TableCell>
                </TableRow>
                <TableRow className="border-b border-border/50 hover:bg-transparent bg-muted/5">
                  <TableCell className="h-10 pl-14 text-muted-foreground font-medium text-xs italic">
                    • de las cuales, despachadas SIN facturar
                  </TableCell>
                  <TableCell className="h-10 pr-8 text-right text-muted-foreground font-bold text-xs tabular-nums">
                    {formatNum(metrics.despachadasSinFacturar)}
                  </TableCell>
                </TableRow>

                <TableRow className="bg-muted/20 hover:bg-muted/30">
                  <TableCell className="h-20 pl-8 font-black text-foreground uppercase tracking-widest text-base">
                    STOCK FINAL (PRENDAS QUE QUEDAN EN BODEGA)
                  </TableCell>
                  <TableCell className="h-20 pr-8 text-right">
                    <span className="font-black text-3xl text-foreground tabular-nums tracking-tighter">
                      {formatNum(metrics.stockFinal)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Historial Operativo Mensual del Año Anterior */}
      {(() => {
        const currentYear = new Date().getFullYear();
        const prevYear = currentYear - 1;

        // Motores de parseo de fechas y cantidades
        const getNormalizedQty = (item: any): number => {
          if (!item) return 0;
          const val = item.quantityToDispatch || item.cantidadConfirmada || item.quantity || item.cantidad || item.totalPrendas || item.total || 0;
          const num = Number(val);
          return isNaN(num) || !isFinite(num) ? 0 : num;
        };

        const getNormalizedDate = (doc: any): Date | null => {
          if (!doc) return null;
          const raw = doc.date || doc.fechaSalida || doc.fecha || doc.entryDate || doc.createdAt;
          if (!raw) return null;
          if (raw.toDate) return raw.toDate();
          const d = new Date(raw);
          return isNaN(d.getTime()) ? null : d;
        };

        // Generar 12 meses
        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
          monthName: new Date(prevYear, i, 1).toLocaleDateString('es-ES', { month: 'long' }),
          monthNum: i,
          ingresos: 0,
          despachos: 0,
          facturado: 0
        }));

        // Clasificar ingresos (entries)
        allEntries.forEach(e => {
          const d = getNormalizedDate(e);
          if (d && d.getFullYear() === prevYear) {
            const m = d.getMonth();
            const lotes = e.lotes || e.lots || [];
            lotes.forEach((l: any) => {
              monthlyData[m].ingresos += getNormalizedQty(l);
            });
          }
        });

        // Clasificar despachos (outputs)
        allOutputs.forEach(o => {
          const d = getNormalizedDate(o);
          if (d && d.getFullYear() === prevYear) {
            const m = d.getMonth();
            if (Array.isArray(o.itemsDispatched)) {
              o.itemsDispatched.forEach((it: any) => {
                monthlyData[m].despachos += getNormalizedQty(it);
              });
            } else {
              monthlyData[m].despachos += getNormalizedQty(o);
            }
          }
        });

        // Clasificar facturado (invoices)
        allInvoices.forEach(inv => {
          const d = getNormalizedDate(inv);
          if (d && d.getFullYear() === prevYear) {
            const m = d.getMonth();
            const totalF = Number(inv.totalFactura || inv.total || 0);
            monthlyData[m].facturado += totalF;
          }
        });

        return (
          <Card className="max-w-4xl mx-auto border-border shadow-sm rounded-3xl overflow-hidden bg-card mt-10">
            <div className="p-8 border-b border-border flex items-center gap-3 bg-muted/10">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-black uppercase tracking-tight">Desglose Operativo Mensual (Año Anterior: {prevYear})</h2>
            </div>
            <CardContent className="p-10">
              <div className="border border-border rounded-2xl overflow-hidden bg-background shadow-inner">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-14 font-black uppercase tracking-widest pl-8 text-xs">Mes</TableHead>
                      <TableHead className="h-14 font-black uppercase tracking-widest text-right text-xs">Ingresos (Prendas)</TableHead>
                      <TableHead className="h-14 font-black uppercase tracking-widest text-right text-xs">Despachos (Prendas)</TableHead>
                      <TableHead className="h-14 font-black uppercase tracking-widest text-right pr-8 text-xs">Total Facturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((data, idx) => (
                      <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                        <TableCell className="h-14 pl-8 font-bold text-foreground text-sm uppercase">{data.monthName}</TableCell>
                        <TableCell className="h-14 pr-8 text-right font-semibold text-emerald-600 text-sm tabular-nums">
                          {formatNum(data.ingresos)}
                        </TableCell>
                        <TableCell className="h-14 pr-8 text-right font-semibold text-red-600 text-sm tabular-nums">
                          {formatNum(data.despachos)}
                        </TableCell>
                        <TableCell className="h-14 pr-8 text-right font-black text-primary text-sm tabular-nums">
                          ${data.facturado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

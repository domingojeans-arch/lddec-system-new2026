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
}

export function InventorySummaryReport({ metrics, dateFrom, dateTo }: InventorySummaryReportProps) {
  
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
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Printer, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryMetrics, calculateInventorySummary } from "@/lib/inventoryEngine";
import { format } from "date-fns";

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
  const [activeTab, setActiveTab] = useState<"general" | "mensual">("general");
  
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

  // Divide el rango en meses
  const getMonthsInRange = (startStr: string, endStr: string) => {
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(endStr + "T23:59:59");
    const months = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth();
      
      const mStart = new Date(year, month, 1);
      const mStartStr = format(mStart, "yyyy-MM-dd");
      
      const mEnd = new Date(year, month + 1, 0);
      const mEndStr = format(mEnd, "yyyy-MM-dd");
      
      const actualStartStr = mStartStr < startStr ? startStr : mStartStr;
      const actualEndStr = mEndStr > endStr ? endStr : mEndStr;
      
      months.push({
        label: current.toLocaleDateString("es-ES", { month: "long", year: "numeric" }).toUpperCase(),
        startStr: actualStartStr,
        endStr: actualEndStr
      });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const monthlyItems = getMonthsInRange(dateFrom, dateTo).map(item => {
    const monthMetrics = calculateInventorySummary(allEntries, allOutputs, allInvoices, item.startStr, item.endStr);
    return {
      label: item.label,
      metrics: monthMetrics,
      startStr: item.startStr,
      endStr: item.endStr
    };
  });

  const handlePrintMensual = () => {
    localStorage.setItem("monthly_print_data", JSON.stringify({
      months: monthlyItems.map(item => ({
        label: item.label,
        si: item.metrics.stockInicial,
        in: item.metrics.ingresosPeriodo,
        out: item.metrics.despachosPeriodo,
        df: item.metrics.despachadasFacturadas,
        dsf: item.metrics.despachadasSinFacturar,
        sf: item.metrics.stockFinal,
        from: item.startStr,
        to: item.endStr
      })),
      from: dateFrom,
      to: dateTo
    }));
    window.open(`/print/informes/resumen?mode=mensual`, '_blank');
  };

  return (
    <div className="space-y-8 print:hidden">
      {/* Sub-pestañas Premium */}
      <div className="flex justify-center">
        <div className="bg-muted p-1 rounded-2xl flex gap-1 border border-border shadow-inner">
          <Button
            variant={activeTab === "general" ? "default" : "ghost"}
            onClick={() => setActiveTab("general")}
            className="rounded-xl font-black uppercase text-[10px] tracking-wider px-6 h-10"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Resumen Acumulado
          </Button>
          <Button
            variant={activeTab === "mensual" ? "default" : "ghost"}
            onClick={() => setActiveTab("mensual")}
            className="rounded-xl font-black uppercase text-[10px] tracking-wider px-6 h-10"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Desglose Mensual
          </Button>
        </div>
      </div>

      {activeTab === "general" ? (
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
      ) : (
        <div className="space-y-10">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Desglose Mensual de Operaciones</h3>
            <Button
              onClick={handlePrintMensual}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20"
            >
              <Printer className="h-4 w-4" />
              Imprimir Todo (PDF)
            </Button>
          </div>

          {monthlyItems.map((item, idx) => (
            <Card key={idx} className="max-w-4xl mx-auto border-border shadow-sm rounded-3xl overflow-hidden bg-card">
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/10">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-black uppercase tracking-tight">{item.label}</h2>
                </div>
                <Button 
                  onClick={() => {
                    const params = new URLSearchParams({
                      si: item.metrics.stockInicial.toString(),
                      in: item.metrics.ingresosPeriodo.toString(),
                      out: item.metrics.despachosPeriodo.toString(),
                      df: item.metrics.despachadasFacturadas.toString(),
                      dsf: item.metrics.despachadasSinFacturar.toString(),
                      sf: item.metrics.stockFinal.toString(),
                      from: item.startStr,
                      to: item.endStr
                    });
                    window.open(`/print/informes/resumen?${params.toString()}`, '_blank');
                  }}
                  variant="outline"
                  className="font-bold text-xs h-9 px-4 rounded-lg gap-2"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Mes
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
                          Stock Inicial (Prendas en Bodega al inicio del mes)
                        </TableCell>
                        <TableCell className="h-14 pr-8 text-right font-bold text-base tabular-nums">
                          {formatNum(item.metrics.stockInicial)}
                        </TableCell>
                      </TableRow>

                      <TableRow className="border-b border-border/50 hover:bg-transparent">
                        <TableCell className="h-14 pl-8 font-semibold text-emerald-600 border-r-0 uppercase tracking-tight text-sm">
                          (+) Total Prendas Ingresadas en Mes
                        </TableCell>
                        <TableCell className="h-14 pr-8 text-right font-black text-emerald-600 text-lg tabular-nums">
                          {formatNum(item.metrics.ingresosPeriodo)}
                        </TableCell>
                      </TableRow>

                      <TableRow className="border-b border-border/50 hover:bg-transparent">
                        <TableCell className="h-14 pl-8 font-semibold text-red-600 border-r-0 uppercase tracking-tight text-sm">
                          (-) Total Prendas Despachadas en Mes
                        </TableCell>
                        <TableCell className="h-14 pr-8 text-right font-black text-red-600 text-lg tabular-nums">
                          {formatNum(item.metrics.despachosPeriodo)}
                        </TableCell>
                      </TableRow>

                      <TableRow className="border-b border-border/20 hover:bg-transparent bg-muted/5">
                        <TableCell className="h-10 pl-14 text-muted-foreground font-medium text-xs italic">
                          • de las cuales, despachadas Y facturadas
                        </TableCell>
                        <TableCell className="h-10 pr-8 text-right text-muted-foreground font-bold text-xs tabular-nums">
                          {formatNum(item.metrics.despachadasFacturadas)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-b border-border/50 hover:bg-transparent bg-muted/5">
                        <TableCell className="h-10 pl-14 text-muted-foreground font-medium text-xs italic">
                          • de las cuales, despachadas SIN facturar
                        </TableCell>
                        <TableCell className="h-10 pr-8 text-right text-muted-foreground font-bold text-xs tabular-nums">
                          {formatNum(item.metrics.despachadasSinFacturar)}
                        </TableCell>
                      </TableRow>

                      <TableRow className="bg-muted/20 hover:bg-muted/30">
                        <TableCell className="h-20 pl-8 font-black text-foreground uppercase tracking-widest text-base">
                          STOCK FINAL (PRENDAS AL FIN DEL MES)
                        </TableCell>
                        <TableCell className="h-20 pr-8 text-right">
                          <span className="font-black text-3xl text-foreground tabular-nums tracking-tighter">
                            {formatNum(item.metrics.stockFinal)}
                          </span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

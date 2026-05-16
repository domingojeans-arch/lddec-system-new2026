"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, Beaker, TrendingUp, TrendingDown, Package, FileSpreadsheet, ShieldAlert, AlertTriangle, CheckCircle2, BarChart3, Database } from "lucide-react";
import { format } from "date-fns";
import { toDate } from "@/lib/toDate";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface ChemicalMovementsDetailedReportProps {
  movements: any[];
  chemicals: any[];
  dateFrom: string;
  dateTo: string;
  selectedSubstance: string;
}

const normalizeSustancia = (s: string) => 
  String(s || "").trim().toUpperCase().replace(/\s+/g, " ");

export function ChemicalMovementsDetailedReport({ movements, chemicals, dateFrom, dateTo, selectedSubstance }: ChemicalMovementsDetailedReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  // 1. ORDENAMIENTO POR ORDEN DESCENDENTE (Sincronizado con la UI del Kardex)
  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      const orderA = String(a.order || "");
      const orderB = String(b.order || "");
      // Comparación natural descendente para que el orden más alto vaya primero
      return orderB.localeCompare(orderA, 'en', { numeric: true });
    });
  }, [movements]);

  // 2. MÉTRICAS DEL PERIODO FILTRADO
  const periodMetrics = useMemo(() => {
    let ingresos = 0;
    let consumos = 0; 

    movements.forEach(m => {
      const qty = Number(m.cant || 0);
      const normalizedQty = (m.unit === "gramos" || m.unit === "g") ? qty / 1000 : qty;

      if (m.tipo === "INGRESO") ingresos += normalizedQty;
      else consumos += normalizedQty;
    });

    return { ingresos, consumos, saldo: ingresos - consumos };
  }, [movements]);

  // 3. MÉTRICAS DE CUPO ANUAL Y ARRASTRE
  const quotaMetrics = useMemo(() => {
    if (selectedSubstance === "all" || selectedSubstance === "Todas") return null;
    
    const chemData = chemicals.find(c => normalizeSustancia(c.chemicalName) === normalizeSustancia(selectedSubstance));
    if (!chemData) return null;

    const cupoAnual = Number(chemData.cupoAnual || 0);
    const initialBalance = Number(chemData.initialBalanceKg || 0);
    
    // Total comprado anual (Ingresos en el año actual)
    const totalCompradoAnual = movements
      .filter(m => m.tipo === "INGRESO" && normalizeSustancia(m.quimico) === normalizeSustancia(selectedSubstance))
      .reduce((acc, m) => {
        const qty = Number(m.cant || 0);
        return acc + ((m.unit === "gramos" || m.unit === "g") ? qty / 1000 : qty);
      }, 0);

    const cupoDisponible = Math.max(0, cupoAnual - totalCompradoAnual);
    const pctRemaining = cupoAnual > 0 ? (cupoDisponible / cupoAnual) * 100 : 0;

    let color = "text-emerald-600 bg-emerald-500/10 border-emerald-200";
    let icon = CheckCircle2;
    
    if (pctRemaining <= 0 && cupoAnual > 0) {
      color = "text-red-600 bg-red-500/10 border-red-200";
      icon = ShieldAlert;
    } else if (pctRemaining < 30) {
      color = "text-amber-600 bg-amber-500/10 border-amber-200";
      icon = AlertTriangle;
    }

    return { 
      cupoAnual, 
      totalCompradoAnual, 
      cupoDisponible, 
      pctRemaining, 
      color, 
      icon,
      name: chemData.chemicalName,
      initialBalance
    };
  }, [selectedSubstance, chemicals, movements]);

  const formatNum = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExportExcel = () => {
    const dataForExcel = sortedMovements.map(m => {
      const date = toDate(m.fecha || m.createdAt);
      return {
        "Fecha": date ? format(date, 'dd/MM/yyyy HH:mm') : "---",
        "Sustancia": m.quimico?.toUpperCase(),
        "Tipo": m.tipo,
        "Orden": m.order || "S/O",
        "Lote": m.lote || "S/L",
        "Proceso": m.procesoTecnico || "S/D",
        "Cantidad": m.cant,
        "Unidad": m.unit || "kg",
        "Stock Post": m.stockPost ? m.stockPost.toFixed(2) : "---"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos Químicos");

    const summaryData = [
      { Métrica: "Sustancia Filtrada", Valor: selectedSubstance === 'all' ? 'TODOS LOS INSUMOS' : selectedSubstance.toUpperCase() },
      { Métrica: "Periodo Desde", Valor: dateFrom },
      { Métrica: "Periodo Hasta", Valor: dateTo }
    ];

    if (quotaMetrics) {
      summaryData.push(
        { Métrica: "SALDO INICIAL (ARRASTRE)", Valor: quotaMetrics.initialBalance },
        { Métrica: "TOTAL COMPRADO PERIODO (kg)", Valor: periodMetrics.ingresos },
        { Métrica: "TOTAL CONSUMIDO PERIODO (kg)", Valor: periodMetrics.consumos },
        { Métrica: "CUPO ANUAL AUTORIZADO (kg)", Valor: quotaMetrics.cupoAnual },
        { Métrica: "COMPRADO ACUMULADO AÑO (kg)", Valor: quotaMetrics.totalCompradoAnual },
        { Métrica: "CUPO DISPONIBLE ACTUAL (kg)", Valor: quotaMetrics.cupoDisponible }
      );
    }

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen y Cupos");

    XLSX.writeFile(workbook, `LDDEC_Kardex_Quimicos_${dateFrom}_al_${dateTo}.xlsx`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: portrait; margin: 0; }
          body { margin: 0; padding: 0; background: white !important; }
          #chemical-report-area {
            width: 21cm;
            min-height: 29.7cm;
            padding: 1.5cm;
            position: relative;
            font-family: 'Inter', sans-serif;
            background: white !important;
            color: black !important;
            visibility: visible !important;
          }
          .print-hidden { display: none !important; }
          .header-logo { position: absolute; top: 1.5cm; right: 1.5cm; width: 2.2cm; height: 2.2cm; object-fit: contain; }
          .header-title { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
          .header-subtitle { font-size: 13pt; font-weight: 700; color: #4f46e5 !important; text-transform: uppercase; margin-bottom: 10px; }
          .meta-info { font-size: 9pt; font-weight: 600; color: #64748b !important; text-transform: uppercase; margin-bottom: 15px; }
          table { border: 1.5pt solid black !important; border-collapse: collapse !important; width: 100% !important; }
          th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 8pt !important; padding: 4px 8px !important; }
          td { border: 1pt solid black !important; color: black !important; font-size: 8pt !important; padding: 3px 8px !important; line-height: 1.1; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-border pb-4 print-hidden">
        <h2 className="text-xl font-black uppercase tracking-tight">Movimientos Detallados de Químicos</h2>
        <div className="flex gap-3">
          <Button onClick={handleExportExcel} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold h-11 px-6 rounded-xl gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
          </Button>
          <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg">
            <Printer className="h-4 w-4" /> Imprimir Auditoría
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-hidden">
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Ingresos Periodo (Kg)</p>
            <div className="flex items-end justify-between">
              <span className="text-5xl font-black tracking-tighter text-emerald-600">{formatNum(periodMetrics.ingresos)}</span>
              <TrendingUp className="h-10 w-10 text-emerald-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Consumos Periodo (Kg)</p>
            <div className="flex items-end justify-between">
              <span className="text-5xl font-black tracking-tighter text-amber-600">{formatNum(periodMetrics.consumos)}</span>
              <TrendingDown className="h-10 w-10 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20 shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Balance Neto Periodo (Kg)</p>
            <div className="flex items-end justify-between">
              <span className={cn("text-5xl font-black tracking-tighter", periodMetrics.saldo < 0 ? "text-red-600" : "text-primary")}>
                {formatNum(periodMetrics.saldo)}
              </span>
              <Beaker className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {quotaMetrics && (
        <div className={cn("p-8 rounded-[2rem] border-2 grid grid-cols-1 md:grid-cols-4 gap-8 items-center animate-in slide-in-from-top-4 duration-500", quotaMetrics.color)}>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Insumo Auditado</p>
            <h5 className="text-2xl font-black uppercase truncate">{quotaMetrics.name}</h5>
            <div className="flex gap-2 mt-1">
              <Badge className="bg-white/50 text-current border-none font-black text-[9px] px-3 uppercase tracking-widest">CONTROL CUPO {currentYear}</Badge>
              {quotaMetrics.initialBalance > 0 && <Badge variant="outline" className="border-current/30 text-current font-black text-[9px] px-3 uppercase">TIENE ARRASTRE</Badge>}
            </div>
          </div>
          
          <div className="space-y-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Saldo Inicial (Arrastre)</p>
            <p className="text-3xl font-black">{quotaMetrics.initialBalance.toFixed(2)} <span className="text-sm font-medium">kg</span></p>
          </div>

          <div className="space-y-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Comprado en {currentYear}</p>
            <p className="text-3xl font-black">{quotaMetrics.totalCompradoAnual.toFixed(2)} <span className="text-sm font-medium">kg</span></p>
          </div>

          <div className="text-center space-y-1 bg-white/20 p-6 rounded-3xl border-none">
            <p className="text-[10px] font-black uppercase tracking-widest">Cupo Disponible</p>
            <div className="flex items-center justify-center gap-2">
              <quotaMetrics.icon className="h-5 w-5" />
              <p className="text-3xl font-black">{quotaMetrics.cupoDisponible.toFixed(2)} <span className="text-sm font-medium">kg</span></p>
            </div>
          </div>
        </div>
      )}

      <div id="chemical-report-area">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Informe Detallado de Movimientos Químicos</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Sustancia: {selectedSubstance === 'all' || selectedSubstance === 'Todas' ? 'TODOS LOS INSUMOS' : selectedSubstance.toUpperCase()}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        {quotaMetrics && (
          <div className="hidden print:block mb-6 p-4 border border-black rounded-lg">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="text-[8px] font-bold">SALDO INICIAL</p><p className="text-sm font-black">{quotaMetrics.initialBalance.toFixed(2)} kg</p></div>
              <div><p className="text-[8px] font-bold">CUPO ANUAL {currentYear}</p><p className="text-sm font-black">{quotaMetrics.cupoAnual.toFixed(2)} kg</p></div>
              <div><p className="text-[8px] font-bold">COMPRADO A LA FECHA</p><p className="text-sm font-black">{quotaMetrics.totalCompradoAnual.toFixed(2)} kg</p></div>
              <div><p className="text-[8px] font-bold">CUPO DISPONIBLE</p><p className="text-sm font-black">{quotaMetrics.cupoDisponible.toFixed(2)} kg</p></div>
            </div>
          </div>
        )}

        <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow>
                <TableHead className="text-[9px] font-black uppercase py-5 pl-6">Fecha</TableHead>
                <TableHead className="text-[9px] font-black uppercase">Insumo</TableHead>
                <TableHead className="text-[9px] font-black uppercase">Tipo</TableHead>
                <TableHead className="text-[9px] font-black uppercase">Ref (Orden/Lote)</TableHead>
                <TableHead className="text-[9px] font-black uppercase">Proceso Técnico</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-right">Cant.</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-right pr-6">S. Post</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMovements.map((m, idx) => {
                const date = toDate(m.fecha || m.createdAt);
                const isIngreso = m.tipo === "INGRESO";
                const isAjuste = m.tipo === "AJUSTE";
                
                return (
                  <TableRow key={idx} className="hover:bg-muted/5 transition-colors border-border print:border-black">
                    <TableCell className="py-4 pl-6 text-xs font-medium">{date ? format(date, 'dd/MM/yy HH:mm') : "---"}</TableCell>
                    <TableCell className="font-bold text-xs uppercase">{m.quimico}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black border-none px-2 h-5 rounded-full uppercase",
                        isIngreso ? "bg-emerald-500/10 text-emerald-600" : (isAjuste ? "bg-indigo-500/10 text-indigo-600" : "bg-amber-500/10 text-amber-600")
                      )}>
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-primary uppercase">{m.order || "S/O"}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">LOT: {m.lote || "S/L"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-medium uppercase text-foreground">{m.procesoTecnico || "S/D"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "text-xs font-black",
                        isIngreso ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {isIngreso ? "+" : "-"}{m.cant} {m.unit === 'gramos' ? 'g' : 'kg'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span className="text-xs font-bold text-muted-foreground">{m.stockPost ? `${m.stockPost.toFixed(2)} kg` : "---"}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedMovements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground italic uppercase text-[10px] font-black opacity-30">
                    <Package className="h-10 w-10 mx-auto mb-2" />
                    Sin movimientos registrados en este rango
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-muted/20 print:bg-white print:border-t-2 print:border-black">
              <TableRow>
                <TableCell colSpan={5} className="text-[9px] font-black uppercase pl-6 py-4">Total Consumo Neto Período (Kg)</TableCell>
                <TableCell className="text-right font-black text-amber-600 text-sm">{formatNum(periodMetrics.consumos)} kg</TableCell>
                <TableCell className="pr-6"></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}

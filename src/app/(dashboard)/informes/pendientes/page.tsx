"use client";

import React, { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Printer, 
  Receipt, 
  Shirt,
  FileText,
  Loader2,
  Search,
  Download,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/toDate";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

function PendientesContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [fechaGenerada, setFechaGenerada] = useState('');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPrintingOnlyPendingReport, setIsPrintingOnlyPendingReport] = useState(false);

  const dateFrom = searchParams.get("from") || "";
  const dateTo = searchParams.get("to") || "";
  const clientId = searchParams.get("clientId") || "all";

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  // CARGAR DATOS DESDE FIRESTORE
  useEffect(() => {
    if (!db) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Obtener todos los ingresos
        const entriesSnap = await getDocs(collection(db, "entries"));
        const rawEntries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Obtener todas las facturas
        const facturasSnap = await getDocs(collection(db, "facturas"));
        const rawInvoices = facturasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setEntries(rawEntries);
        setInvoices(rawInvoices);
      } catch (err: any) {
        console.error("Error al cargar datos de pendientes:", err);
        toast({
          variant: "destructive",
          title: "Error de Carga",
          description: "No se pudieron obtener los registros de la base de datos."
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  // MOTOR DE CRUCE Y FILTRADO POR FECHAS Y CLIENTE
  const reportData = useMemo(() => {
    if (loading || entries.length === 0) return [];

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
        if (r) billedByEntryMap.set(String(r).trim().toUpperCase(), inv);
      });
    });

    let filtered = entries;

    // A. Filtrar por cliente si se selecciona uno específico
    if (clientId !== "all") {
      filtered = filtered.filter(e => e.clientId === clientId || e.clienteId === clientId);
    }

    // B. Filtrar por fechas
    filtered = filtered.filter(e => {
      const d = toDate(e.date || e.entryDate || e.createdAt);
      return d && d >= from && d <= to;
    });

    return filtered.map(entry => {
      const entryId = String(entry.id).toUpperCase();
      const entryNum = String(entry.entryNumber || "").toUpperCase();
      
      const invoice = billedByEntryMap.get(entryId) || billedByEntryMap.get(entryNum);
      const hardcodedFixes = ["4985", "4967", "4924", "4787"];
      const isHardcodedFix = hardcodedFixes.includes(entryNum) || hardcodedFixes.includes(entryId);
      
      const isBilled = !!invoice || String(entry.estadoFacturacion || "").toUpperCase() === "FACTURADO" || (entry.numeroFactura && entry.numeroFactura !== "-") || isHardcodedFix;
      const isClosedUnbilled = entry.status === "closed_unbilled" || String(entry.estadoFacturacion || "").toUpperCase() === "CERRADA SIN FACTURAR" || entry.isClosedUnbilled === true;
      const invoiceNumberStr = isClosedUnbilled ? "Cerrada sin facturar" : (invoice?.numeroFactura || entry.numeroFactura || "FACTURADO");
      const invoiceValueNum = isBilled ? (invoice ? Number(invoice.totalFactura || invoice.total || 0) : Number(entry.valorFactura || 0)) : 0;

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
        estado: isClosedUnbilled ? "CERRADA SIN FACTURAR" : isBilled ? "FACTURADO" : "PENDIENTE",
        factura: isBilled ? invoiceNumberStr : (isClosedUnbilled ? "Cierre Admin." : "-"),
        valorFactura: invoiceValueNum,
        isSample: !!entry.isSample || String(entry.tipo_ingreso || entry.tipoIngreso || "").toUpperCase() === "MUEST" || String(entry.entryNumber || "").toUpperCase().startsWith("MUEST"),
        notes: entry.notes || entry.observaciones || ""
      };
    })
    .sort((a, b) => b.ingreso.localeCompare(a.ingreso, undefined, { numeric: true }));
  }, [entries, invoices, dateFrom, dateTo, clientId, loading]);

  // FILTRAR SOLO PENDIENTES
  const totalPendingList = useMemo(() => reportData.filter(r => r.estado === "PENDIENTE"), [reportData]);
  const pendingSamples = useMemo(() => totalPendingList.filter(r => r.isSample), [totalPendingList]);
  const pendingNormal = useMemo(() => totalPendingList.filter(r => !r.isSample), [totalPendingList]);

  // FILTRADO REACTIVO POR BÚSQUEDA
  const searchedSamples = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return pendingSamples;
    return pendingSamples.filter(r => 
      r.cliente.toLowerCase().includes(q) || 
      r.ingreso.toLowerCase().includes(q)
    );
  }, [pendingSamples, searchTerm]);

  const searchedNormal = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return pendingNormal;
    return pendingNormal.filter(r => 
      r.cliente.toLowerCase().includes(q) || 
      r.ingreso.toLowerCase().includes(q)
    );
  }, [pendingNormal, searchTerm]);

  // MÉTRICAS KPI
  const pendingMetrics = useMemo(() => {
    const samplesCount = pendingSamples.length;
    const samplesGarments = pendingSamples.reduce((acc, curr) => acc + curr.cantidad, 0);
    
    const normalCount = pendingNormal.length;
    const normalGarments = pendingNormal.reduce((acc, curr) => acc + curr.cantidad, 0);

    const totalGeneralCount = samplesCount + normalCount;
    const totalGeneralGarments = samplesGarments + normalGarments;

    return {
      samplesCount,
      samplesGarments,
      normalCount,
      normalGarments,
      totalGeneralCount,
      totalGeneralGarments
    };
  }, [pendingSamples, pendingNormal]);

  // EXPORTAR A EXCEL
  const handleExportPendingExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const normalRows = pendingNormal.map(r => ({
      'Fecha': r.fecha,
      'Número de Ingreso': r.ingreso,
      'Cliente': r.cliente,
      'Prendas': r.cantidad,
      'Estado': r.estado,
      'Observaciones': r.notes
    }));
    const wsNormal = XLSX.utils.json_to_sheet(normalRows);
    XLSX.utils.book_append_sheet(wb, wsNormal, "Normales Pendientes");

    const sampleRows = pendingSamples.map(r => ({
      'Fecha': r.fecha,
      'Número de Ingreso': r.ingreso,
      'Cliente': r.cliente,
      'Prendas': r.cantidad,
      'Estado': r.estado,
      'Observaciones': r.notes
    }));
    const wsSamples = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, wsSamples, "Muestras Pendientes");

    XLSX.writeFile(wb, `Control_Facturacion_Pendiente_${dateFrom}_al_${dateTo}.xlsx`);
    toast({
      title: "Excel Exportado",
      description: "El archivo Excel se descargó con éxito."
    });
  };

  // IMPRESIÓN
  const handlePrintPendingReport = () => {
    setIsPrintingOnlyPendingReport(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintingOnlyPendingReport(false), 500);
    }, 150);
  };

  const formatNum = (val: number) => Math.floor(val).toLocaleString('es-ES');

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="ml-3 font-bold uppercase text-xs tracking-widest text-muted-foreground">Cargando registros...</span>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { margin: 0; padding: 0; background: white !important; }
          #main-content-layout { display: none !important; }
          #pending-billing-report {
            display: block !important;
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
          .header-subtitle { font-size: 13pt; font-weight: 700; color: #0284c7 !important; text-transform: uppercase; margin-bottom: 10px; }
          .meta-info { font-size: 9pt; font-weight: 600; color: #64748b !important; text-transform: uppercase; margin-bottom: 15px; }
          table { width: 100% !important; max-width: 100% !important; border: 1.2pt solid black !important; border-collapse: collapse !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 8pt !important; padding: 6px 8px !important; }
          td { border: 1pt solid black !important; color: black !important; font-size: 8pt !important; padding: 4px 8px !important; line-height: 1.1; }
        }
      `}</style>

      {/* VISTA EN PANTALLA */}
      <div id="main-content-layout" className="space-y-8 print:hidden">
        {/* ENCABEZADO Y RETORNO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => window.close()} 
              className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Cerrar Ventana
            </button>
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <Receipt className="h-9 w-9 text-sky-600 animate-pulse" /> Control de Facturación Pendiente
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Rango de Fechas: {dateFrom} al {dateTo}
            </p>
          </div>

          {/* ACCIONES */}
          <div className="flex gap-2">
            <Button
              onClick={handleExportPendingExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Download className="h-4 w-4" /> Exportar a Excel
            </Button>
            <Button
              onClick={handlePrintPendingReport}
              className="bg-primary hover:bg-primary/95 text-white font-black uppercase text-[10px] tracking-widest h-11 px-8 rounded-xl gap-2 shadow-lg shadow-primary/20"
            >
              <Printer className="h-4 w-4" /> Imprimir Reporte
            </Button>
          </div>
        </div>

        {/* MÉTRICAS KPI DEL PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="bg-card border-border shadow-sm rounded-2xl p-6 space-y-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Muestras Pendientes</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-amber-600">{pendingMetrics.samplesCount}</span>
            </div>
          </Card>
          <Card className="bg-card border-border shadow-sm rounded-2xl p-6 space-y-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Prendas Muestras</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-amber-600">{formatNum(pendingMetrics.samplesGarments)}</span>
            </div>
          </Card>
          <Card className="bg-card border-border shadow-sm rounded-2xl p-6 space-y-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Ingresos Normales</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-primary">{pendingMetrics.normalCount}</span>
            </div>
          </Card>
          <Card className="bg-card border-border shadow-sm rounded-2xl p-6 space-y-1">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Prendas Normales</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-primary">{formatNum(pendingMetrics.normalGarments)}</span>
            </div>
          </Card>
          <Card className="bg-sky-500/5 border-sky-500/10 shadow-sm rounded-2xl p-6 space-y-1">
            <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest">Total Prendas Pendientes</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-sky-600">{formatNum(pendingMetrics.totalGeneralGarments)}</span>
            </div>
          </Card>
        </div>

        {/* BUSCADOR */}
        <div className="relative max-w-md bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por socio industrial o número de ingreso..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-11 h-12 border-none bg-transparent text-xs font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* TABS DE RESULTADOS */}
        <Tabs defaultValue="normales" className="w-full">
          <TabsList className="bg-muted/30 p-1.5 rounded-2xl mb-6">
            <TabsTrigger value="normales" className="px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Normales Pendientes ({searchedNormal.length})
            </TabsTrigger>
            <TabsTrigger value="muestras" className="px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Muestras Pendientes ({searchedSamples.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="normales">
            <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-premium">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Ingreso</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Socio Industrial</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Prendas</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase pr-8">Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchedNormal.length > 0 ? (
                    searchedNormal.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/5 border-border">
                        <TableCell className="py-4 pl-8 text-xs font-medium text-muted-foreground">{row.fecha}</TableCell>
                        <TableCell className="font-bold text-xs">{row.ingreso}</TableCell>
                        <TableCell className="text-xs font-bold uppercase truncate max-w-[250px]">{row.cliente}</TableCell>
                        <TableCell className="text-center font-black text-sm">{row.cantidad}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[9px] font-black bg-red-500/10 text-red-600 border-none px-3 py-0.5 rounded-full">
                            {row.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground pr-8 italic max-w-[300px] truncate" title={row.notes}>
                          {row.notes || "Sin observaciones adicionales registradas"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center opacity-25">
                          <FileText className="h-12 w-12 mb-3" />
                          <p className="text-xs font-black uppercase tracking-widest">Sin ingresos normales pendientes</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="muestras">
            <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-premium">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Ingreso</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Socio Industrial</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Prendas</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase pr-8">Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchedSamples.length > 0 ? (
                    searchedSamples.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/5 border-border">
                        <TableCell className="py-4 pl-8 text-xs font-medium text-muted-foreground">{row.fecha}</TableCell>
                        <TableCell className="font-bold text-xs">{row.ingreso}</TableCell>
                        <TableCell className="text-xs font-bold uppercase truncate max-w-[250px]">{row.cliente}</TableCell>
                        <TableCell className="text-center font-black text-sm">{row.cantidad}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[9px] font-black bg-red-500/10 text-red-600 border-none px-3 py-0.5 rounded-full">
                            {row.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground pr-8 italic max-w-[300px] truncate" title={row.notes}>
                          {row.notes || "Sin observaciones adicionales registradas"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center opacity-25">
                          <FileText className="h-12 w-12 mb-3" />
                          <p className="text-xs font-black uppercase tracking-widest">Sin muestras pendientes</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* VISTA EN IMPRESIÓN (OCULTA EN PANTALLA) */}
      <div id="pending-billing-report" className="hidden">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">CONTROL DE FACTURACIÓN PENDIENTE</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        {/* Resumen en Impresión */}
        <div className="mb-6 grid grid-cols-3 gap-4 border border-black p-4 text-[10px] font-bold uppercase print:grid">
          <div>Ingresos Normales: {pendingMetrics.normalCount} ({pendingMetrics.normalGarments} prendas)</div>
          <div>Muestras: {pendingMetrics.samplesCount} ({pendingMetrics.samplesGarments} prendas)</div>
          <div>Total General Prendas: {pendingMetrics.totalGeneralGarments}</div>
        </div>

        {/* Tabla Normales en Impresión */}
        <div className="mb-8">
          <h2 className="text-xs font-black uppercase mb-2 border-b border-black pb-1 text-sky-700">Ingresos Normales Pendientes</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left font-black text-[9px] py-2">Fecha</th>
                <th className="text-left font-black text-[9px]">Ingreso</th>
                <th className="text-left font-black text-[9px]">Cliente</th>
                <th className="text-center font-black text-[9px]">Prendas</th>
                <th className="text-left font-black text-[9px]">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingNormal.length > 0 ? (
                pendingNormal.map((row, idx) => (
                  <tr key={idx} className="border-t border-black">
                    <td className="py-2 text-[9px]">{row.fecha}</td>
                    <td className="font-bold text-[9px]">{row.ingreso}</td>
                    <td className="uppercase text-[9px]">{row.cliente}</td>
                    <td className="text-center font-bold text-[9px]">{row.cantidad}</td>
                    <td className="text-[9px] italic">{row.notes || "---"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[9px]">No hay ingresos normales pendientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tabla Muestras en Impresión */}
        <div>
          <h2 className="text-xs font-black uppercase mb-2 border-b border-black pb-1 text-amber-700">Muestras Pendientes</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left font-black text-[9px] py-2">Fecha</th>
                <th className="text-left font-black text-[9px]">Ingreso</th>
                <th className="text-left font-black text-[9px]">Cliente</th>
                <th className="text-center font-black text-[9px]">Prendas</th>
                <th className="text-left font-black text-[9px]">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingSamples.length > 0 ? (
                pendingSamples.map((row, idx) => (
                  <tr key={idx} className="border-t border-black">
                    <td className="py-2 text-[9px]">{row.fecha}</td>
                    <td className="font-bold text-[9px]">{row.ingreso}</td>
                    <td className="uppercase text-[9px]">{row.cliente}</td>
                    <td className="text-center font-bold text-[9px]">{row.cantidad}</td>
                    <td className="text-[9px] italic">{row.notes || "---"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[9px]">No hay muestras pendientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PendientesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="ml-3 font-bold uppercase text-xs tracking-widest text-muted-foreground">Inicializando...</span>
      </div>
    }>
      <PendientesContent />
    </Suspense>
  );
}

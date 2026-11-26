"use client";

import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowUp, ArrowDown, ChevronsUpDown, Download, Loader2, Users } from "lucide-react";
import { exportReportToPdf } from "@/lib/pdfExport";
import { calculateClientAccountingMetrics } from "@/lib/accounting-motor";
import { toDate } from "@/lib/toDate";
import { formatClientName } from "@/lib/format-name";

interface StatementOfAccountsReportProps {
  clients: any[];
  invoices: any[];
  payments: any[]; 
  dateFrom: string;
  dateTo: string;
}

type SortKey = "name" | "saldoAnterior" | "facturacion" | "nd" | "nc" | "retencion" | "cobro" | "saldoActual";

function isMatchForClient(doc: any, client: any): boolean {
  if (!doc || !client) return false;
  const docCid = String(doc.clientId || doc.clienteId || "").trim();
  if (docCid && docCid === client.id) return true;
  
  const clientNames = [
    client.name,
    client.nombre,
    client.fullName,
    formatClientName(client.name, client.firstName, client.lastName),
    `${client.firstName || ""} ${client.lastName || ""}`.trim(),
    `${client.lastName || ""} ${client.firstName || ""}`.trim()
  ].filter(Boolean).map(s => String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""));

  const docNames = [
    doc.clienteNombre,
    doc.clientName,
    doc.cliente,
    doc.client,
    doc.socio
  ].filter(Boolean).map(s => String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""));

  return clientNames.some(cn => docNames.some(dn => dn && (dn === cn || dn.includes(cn) || cn.includes(dn))));
}

export function StatementOfAccountsReport({ clients, invoices, payments, dateFrom, dateTo }: StatementOfAccountsReportProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportReportToPdf("statement-accounts-report-area", {
        filename: `estado-cuentas-corte-${dateFrom || 'inicio'}-al-${dateTo || 'fin'}.pdf`,
        landscape: true,
      });
    } catch (err) {
      console.error("Error al exportar PDF estado de cuentas corte:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const groups = [
    { id: "nacional", label: "CLIENTE NACIONAL" },
    { id: "socio", label: "SOCIO" },
    { id: "especial", label: "CLIENTE ESPECIAL" },
    { id: "moroso", label: "MOROSOS" },
  ];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const reportData = useMemo(() => {
    return groups.map(group => {
      const groupClients = clients.filter(c => {
        const rawClass = (c.classification || c.clasificacion || "nacional").toString().toLowerCase().trim();
        return rawClass.includes(group.id);
      });
      
      const clientRows = groupClients.map(client => {
        if (!client) return null;
        const clientInvoices = invoices.filter(inv => isMatchForClient(inv, client));
        
        const clientPayments = (payments || []).filter((p: any) => {
          if (!p) return false;
          const isAnulado = Boolean(p.anulado) || p.estado === "anulado" || p.estado === "Anulado" || p.status === "anulado";
          if (isAnulado) return false;
          return isMatchForClient(p, client);
        });

        const metrics = calculateClientAccountingMetrics(
          Number(client.baseDebt || client.saldoInicial || 0),
          dateFrom,
          dateTo,
          clientInvoices,
          clientPayments,
          client
        );
        return {
          id: client.id,
          name: formatClientName(client.name, client.firstName, client.lastName),
          parentClientId: client.parentClientId || "",
          parentClientName: client.parentClientName || "",
          saldoAnterior: metrics.saldoAnterior,
          facturacion: metrics.facturacion,
          nd: metrics.nd,
          nc: metrics.nc,
          retencion: metrics.retencion,
          cobro: metrics.cobro,
          saldoActual: metrics.saldoActual,
          hasMovement: Math.abs(metrics.saldoAnterior) > 0.01 || Math.abs(metrics.facturacion) > 0.01 || Math.abs(metrics.cobro) > 0.01 || Math.abs(metrics.nd) > 0.01 || Math.abs(metrics.nc) > 0.01
        };
      }).filter((r): r is NonNullable<typeof r> => r !== null);

      const visibleClients = clientRows.filter(c => c && (c.hasMovement || Math.abs(c.saldoActual) > 0.01));

      // AGRUPACIÓN FAMILIAR: Unir miembros familiares bajo la misma fila de cuenta familiar
      const processedClientIds = new Set<string>();
      const groupedRows: Array<{
        isFamily: boolean;
        id: string;
        name: string;
        primaryMember: typeof visibleClients[0];
        linkedMembers: typeof visibleClients;
        familyTotals: {
          saldoAnterior: number;
          facturacion: number;
          nd: number;
          nc: number;
          retencion: number;
          cobro: number;
          saldoActual: number;
        };
        saldoAnterior: number;
        facturacion: number;
        nd: number;
        nc: number;
        retencion: number;
        cobro: number;
        saldoActual: number;
      }> = [];

      // Primero ordenamos los visibleClients alfabéticamente para que el primer miembro de la familia que aparezca sea el principal
      const sortedVisible = [...visibleClients].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

      for (const clientRow of sortedVisible) {
        if (processedClientIds.has(clientRow.id)) continue;

        const rawClient = clients.find(c => c.id === clientRow.id);
        const rootId = rawClient?.parentClientId || rawClient?.id;

        // Buscar todos los miembros de este grupo familiar presentes en visibleClients
        const familyMembers = sortedVisible.filter(c => {
          const rawC = clients.find(cl => cl.id === c.id);
          const cRoot = rawC?.parentClientId || rawC?.id;
          return cRoot === rootId || rawC?.id === rootId || rawC?.parentClientId === rootId;
        });

        if (familyMembers.length > 1) {
          // Cuenta familiar con 2 o más miembros
          familyMembers.forEach(m => processedClientIds.add(m.id));

          const primaryMember = familyMembers[0];
          const linkedMembers = familyMembers.slice(1);

          const familyTotals = familyMembers.reduce((acc, m) => ({
            saldoAnterior: acc.saldoAnterior + m.saldoAnterior,
            facturacion: acc.facturacion + m.facturacion,
            nd: acc.nd + m.nd,
            nc: acc.nc + m.nc,
            retencion: acc.retencion + m.retencion,
            cobro: acc.cobro + m.cobro,
            saldoActual: acc.saldoActual + m.saldoActual
          }), { saldoAnterior: 0, facturacion: 0, nd: 0, nc: 0, retencion: 0, cobro: 0, saldoActual: 0 });

          groupedRows.push({
            isFamily: true,
            id: primaryMember.id,
            name: primaryMember.name,
            primaryMember,
            linkedMembers,
            familyTotals,
            saldoAnterior: familyTotals.saldoAnterior,
            facturacion: familyTotals.facturacion,
            nd: familyTotals.nd,
            nc: familyTotals.nc,
            retencion: familyTotals.retencion,
            cobro: familyTotals.cobro,
            saldoActual: familyTotals.saldoActual
          });
        } else {
          // Cliente individual
          processedClientIds.add(clientRow.id);
          groupedRows.push({
            isFamily: false,
            id: clientRow.id,
            name: clientRow.name,
            primaryMember: clientRow,
            linkedMembers: [],
            familyTotals: {
              saldoAnterior: clientRow.saldoAnterior,
              facturacion: clientRow.facturacion,
              nd: clientRow.nd,
              nc: clientRow.nc,
              retencion: clientRow.retencion,
              cobro: clientRow.cobro,
              saldoActual: clientRow.saldoActual
            },
            saldoAnterior: clientRow.saldoAnterior,
            facturacion: clientRow.facturacion,
            nd: clientRow.nd,
            nc: clientRow.nc,
            retencion: clientRow.retencion,
            cobro: clientRow.cobro,
            saldoActual: clientRow.saldoActual
          });
        }
      }

      // Ordenar según columna seleccionada
      const sortedClients = [...groupedRows].sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === 'string' && typeof valB === 'string') return sortDir === "asc" ? valA.localeCompare(valB, 'es') : valB.localeCompare(valA, 'es');
        return sortDir === "asc" ? Number(valA || 0) - Number(valB || 0) : Number(valB || 0) - Number(valA || 0);
      });

      const groupTotals = visibleClients.reduce((acc, curr) => ({
        saldoAnterior: acc.saldoAnterior + (curr?.saldoAnterior || 0),
        facturacion: acc.facturacion + (curr?.facturacion || 0),
        nd: acc.nd + (curr?.nd || 0),
        nc: acc.nc + (curr?.nc || 0),
        retencion: acc.retencion + (curr?.retencion || 0),
        cobro: acc.cobro + (curr?.cobro || 0),
        saldoActual: acc.saldoActual + (curr?.saldoActual || 0),
      }), { saldoAnterior: 0, facturacion: 0, nd: 0, nc: 0, retencion: 0, cobro: 0, saldoActual: 0 });

      return { ...group, clients: sortedClients, totals: groupTotals };
    });
  }, [clients, invoices, payments, dateFrom, dateTo, sortKey, sortDir]);

  // Detección de cuenta familiar activa si el filtro es de un cliente específico o familia
  const familySummary = useMemo(() => {
    // Si tenemos más de 5 clientes cargados (e.g. "Todos los clientes"), no mostramos banner superior
    if (clients.length > 5) return null;

    const allComputedClientRows = reportData.flatMap(g => g.clients);
    const familyRow = allComputedClientRows.find(r => r.isFamily);
    if (!familyRow) return null;

    const allMembers = [familyRow.primaryMember, ...familyRow.linkedMembers];
    const memberNames = allMembers.map(m => m.name).join(" + ");

    return {
      primaryName: familyRow.primaryMember.name,
      memberNames,
      members: allMembers,
      totals: familyRow.familyTotals
    };
  }, [clients, reportData]);

  const formatNum = (val: number) => {
    if (Math.abs(val) < 0.001) return "-";
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = () => {
    const params = new URLSearchParams({
      from: dateFrom,
      to: dateTo
    });
    window.open(`/print/informes/estado-cuentas?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 print:hidden">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={handlePrint} 
          className="hidden md:flex border-border text-muted-foreground hover:bg-muted font-bold h-11 px-6 rounded-xl gap-2 text-[10px] uppercase tracking-widest mr-3"
        >
          <Printer className="h-4 w-4" /> Imprimir (Ventana)
        </Button>
        <Button 
          onClick={handleExportPdf} 
          disabled={isExporting} 
          className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl gap-2 shadow-lg shadow-primary/20"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isExporting ? "Generando PDF..." : "Guardar Reporte en PDF"}
        </Button>
      </div>

      <div id="statement-accounts-report-area" className="space-y-12">
        {/* Banner Consolidado de Cuenta Familiar si se filtra un cliente específico vinculado */}
        {familySummary && (
          <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/20 p-6 space-y-4 shadow-sm print:border-blue-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-200/60 dark:border-blue-800/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      Total Consolidado de la Cuenta Familiar
                    </span>
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] uppercase font-bold tracking-wider">
                      {familySummary.members.length} Cuentas Vinculadas
                    </Badge>
                    {familySummary.totals.nc > 0.01 && (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider">
                        Tiene N/C (${formatNum(familySummary.totals.nc)})
                      </Badge>
                    )}
                    {familySummary.totals.nd > 0.01 && (
                      <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider">
                        Tiene N/D (${formatNum(familySummary.totals.nd)})
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-blue-700/90 dark:text-blue-400 mt-0.5">
                    Miembros: {familySummary.memberNames}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Saldo Actual Total Familiar
                </div>
                <div className="text-2xl font-black text-blue-700 dark:text-blue-400 tracking-tight">
                  ${formatNum(familySummary.totals.saldoActual)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1 text-center">
              <div className="bg-white/80 dark:bg-gray-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">S. Anterior</span>
                <span className="text-xs font-black text-foreground">${formatNum(familySummary.totals.saldoAnterior)}</span>
              </div>
              <div className="bg-white/80 dark:bg-gray-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Facturación</span>
                <span className="text-xs font-black text-foreground">${formatNum(familySummary.totals.facturacion)}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${familySummary.totals.nd > 0.01 ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800' : 'bg-white/80 dark:bg-gray-900/60 border-blue-100 dark:border-blue-900/40'}`}>
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">N/D</span>
                <span className={`text-xs font-black ${familySummary.totals.nd > 0.01 ? 'text-purple-700 dark:text-purple-300' : 'text-foreground'}`}>${formatNum(familySummary.totals.nd)}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${familySummary.totals.nc > 0.01 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800' : 'bg-white/80 dark:bg-gray-900/60 border-blue-100 dark:border-blue-900/40'}`}>
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">N/C</span>
                <span className={`text-xs font-black ${familySummary.totals.nc > 0.01 ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>${formatNum(familySummary.totals.nc)}</span>
              </div>
              <div className="bg-white/80 dark:bg-gray-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Cobros</span>
                <span className="text-xs font-black text-foreground">${formatNum(familySummary.totals.cobro)}</span>
              </div>
              <div className="bg-blue-600/10 dark:bg-blue-950/60 p-2.5 rounded-xl border border-blue-300 dark:border-blue-700/50">
                <span className="text-[9px] font-black text-blue-700 dark:text-blue-300 uppercase block">Saldo Total</span>
                <span className="text-xs font-black text-blue-700 dark:text-blue-400">${formatNum(familySummary.totals.saldoActual)}</span>
              </div>
            </div>
          </div>
        )}

        {reportData.map((group) => (
          group.clients.length > 0 && (
            <div key={group.id} className="space-y-4">
              <div className="bg-gray-100 dark:bg-gray-800 px-6 py-2 border-l-8 border-primary">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-black dark:text-gray-100">{group.label}</h3>
              </div>
              <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                    <TableRow>
                      <TableHead onClick={() => handleSort("name")} className="cursor-pointer text-[9px] font-black uppercase text-black dark:text-gray-200 py-4 pl-6">CLIENTE <SortIcon colKey="name" /></TableHead>
                      <TableHead onClick={() => handleSort("saldoAnterior")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200">S. ANTERIOR <SortIcon colKey="saldoAnterior" /></TableHead>
                      <TableHead onClick={() => handleSort("facturacion")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200">FACTURACIÓN <SortIcon colKey="facturacion" /></TableHead>
                      <TableHead onClick={() => handleSort("nd")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200">N/D <SortIcon colKey="nd" /></TableHead>
                      <TableHead onClick={() => handleSort("nc")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200">N/C <SortIcon colKey="nc" /></TableHead>
                      <TableHead onClick={() => handleSort("retencion")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200">RETENCIÓN <SortIcon colKey="retencion" /></TableHead>
                      <TableHead onClick={() => handleSort("cobro")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200">COBRO <SortIcon colKey="cobro" /></TableHead>
                      <TableHead onClick={() => handleSort("saldoActual")} className="text-right text-[9px] font-black uppercase text-black dark:text-gray-200 pr-6">SALDO ACTUAL <SortIcon colKey="saldoActual" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="tabular-nums">
                    {group.clients.map((row, idx) => {
                      if (!row.isFamily) {
                        return (
                          <TableRow key={idx} className="border-b border-gray-100 dark:border-gray-800">
                            <TableCell className="text-xs font-semibold uppercase pl-6">
                              <div>{row.name}</div>
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatNum(row.saldoAnterior)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatNum(row.facturacion)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatNum(row.nd)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatNum(row.nc)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatNum(row.retencion)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatNum(row.cobro)}</TableCell>
                            <TableCell className="text-xs text-right font-bold text-slate-900 dark:text-white pr-6">{formatNum(row.saldoActual)}</TableCell>
                          </TableRow>
                        );
                      }

                      // FILA CONSOLIDADA DE CUENTA FAMILIAR:
                      // Cliente principal arriba, familiares vinculados más abajo con sus datos, y al final un solo cobro y saldo actual
                      return (
                        <TableRow key={idx} className="border-b-2 border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors">
                          {/* Columna CLIENTE: Principal y Vinculados con indicadores N/D y N/C */}
                          <TableCell className="text-xs uppercase pl-6 py-3.5 align-middle">
                            <div className="space-y-1.5">
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-1.5">
                                <span>{row.primaryMember.name}</span>
                                <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0 border-none">
                                  Cuenta Familiar
                                </Badge>
                                {row.familyTotals.nc > 0.01 && (
                                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60 text-[8px] font-black px-1.5 py-0">
                                    Tiene N/C (${formatNum(row.familyTotals.nc)})
                                  </Badge>
                                )}
                                {row.familyTotals.nd > 0.01 && (
                                  <Badge className="bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700/60 text-[8px] font-black px-1.5 py-0">
                                    Tiene N/D (${formatNum(row.familyTotals.nd)})
                                  </Badge>
                                )}
                                {row.primaryMember.nc > 0.01 && (
                                  <span className="text-[8px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-1 rounded">
                                    (N/C: ${formatNum(row.primaryMember.nc)})
                                  </span>
                                )}
                                {row.primaryMember.nd > 0.01 && (
                                  <span className="text-[8px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 px-1 rounded">
                                    (N/D: ${formatNum(row.primaryMember.nd)})
                                  </span>
                                )}
                              </div>
                              {row.linkedMembers.map((m) => (
                                <div key={m.id} className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 pl-3 flex flex-wrap items-center gap-1.5">
                                  <span className="text-blue-500 font-bold text-sm">↳</span>
                                  <span>{m.name}</span>
                                  <span className="text-[8px] font-normal text-muted-foreground uppercase">(Familiar Vinculado)</span>
                                  {m.nc > 0.01 && (
                                    <span className="text-[8px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-1 rounded">
                                      N/C: ${formatNum(m.nc)}
                                    </span>
                                  )}
                                  {m.nd > 0.01 && (
                                    <span className="text-[8px] font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 px-1 rounded">
                                      N/D: ${formatNum(m.nd)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>

                          {/* S. ANTERIOR: Desglose por miembro y sumatoria */}
                          <TableCell className="text-xs text-right align-middle py-3.5">
                            <div className="space-y-1.5 font-medium">
                              <div>{formatNum(row.primaryMember.saldoAnterior)}</div>
                              {row.linkedMembers.map((m) => (
                                <div key={m.id} className="text-[11px] text-blue-700/80 dark:text-blue-400">
                                  {formatNum(m.saldoAnterior)}
                                </div>
                              ))}
                              {row.linkedMembers.some(m => Math.abs(m.saldoAnterior) > 0.01) && Math.abs(row.primaryMember.saldoAnterior) > 0.01 && (
                                <div className="border-t border-blue-200 dark:border-blue-800 text-[10px] font-black pt-0.5 text-foreground">
                                  ∑ {formatNum(row.familyTotals.saldoAnterior)}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* FACTURACIÓN: Desglose por miembro y sumatoria */}
                          <TableCell className="text-xs text-right align-middle py-3.5">
                            <div className="space-y-1.5 font-medium">
                              <div>{formatNum(row.primaryMember.facturacion)}</div>
                              {row.linkedMembers.map((m) => (
                                <div key={m.id} className="text-[11px] text-blue-700/80 dark:text-blue-400">
                                  {formatNum(m.facturacion)}
                                </div>
                              ))}
                              {row.linkedMembers.some(m => Math.abs(m.facturacion) > 0.01) && Math.abs(row.primaryMember.facturacion) > 0.01 && (
                                <div className="border-t border-blue-200 dark:border-blue-800 text-[10px] font-black pt-0.5 text-foreground">
                                  ∑ {formatNum(row.familyTotals.facturacion)}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* N/D: Desglose por miembro e indicador/total de notas de débito familiares */}
                          <TableCell className="text-xs text-right align-middle py-3.5">
                            <div className="space-y-1.5 font-medium">
                              <div className={row.primaryMember.nd > 0.01 ? "font-bold text-purple-700 dark:text-purple-300" : ""}>
                                {formatNum(row.primaryMember.nd)}
                              </div>
                              {row.linkedMembers.map((m) => (
                                <div key={m.id} className={`text-[11px] ${m.nd > 0.01 ? 'font-bold text-purple-700 dark:text-purple-300' : 'text-blue-700/80 dark:text-blue-400'}`}>
                                  {formatNum(m.nd)}
                                </div>
                              ))}
                              {row.familyTotals.nd > 0.01 && (
                                <div className="border-t border-purple-300 dark:border-purple-800 text-[10px] font-black pt-0.5 text-purple-800 dark:text-purple-300 flex items-center justify-end gap-1">
                                  <span>∑</span>
                                  <span>{formatNum(row.familyTotals.nd)}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* N/C: Desglose por miembro e indicador/total de notas de crédito familiares */}
                          <TableCell className="text-xs text-right align-middle py-3.5">
                            <div className="space-y-1.5 font-medium">
                              <div className={row.primaryMember.nc > 0.01 ? "font-bold text-amber-700 dark:text-amber-400" : ""}>
                                {formatNum(row.primaryMember.nc)}
                              </div>
                              {row.linkedMembers.map((m) => (
                                <div key={m.id} className={`text-[11px] ${m.nc > 0.01 ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-blue-700/80 dark:text-blue-400'}`}>
                                  {formatNum(m.nc)}
                                </div>
                              ))}
                              {row.familyTotals.nc > 0.01 && (
                                <div className="border-t border-amber-300 dark:border-amber-800 text-[10px] font-black pt-0.5 text-amber-800 dark:text-amber-300 flex items-center justify-end gap-1">
                                  <span>∑</span>
                                  <span>{formatNum(row.familyTotals.nc)}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* RETENCIÓN */}
                          <TableCell className="text-xs text-right align-middle py-3.5">
                            <div className="space-y-1.5 font-medium">
                              <div>{formatNum(row.primaryMember.retencion)}</div>
                              {row.linkedMembers.map((m) => (
                                <div key={m.id} className="text-[11px] text-blue-700/80 dark:text-blue-400">
                                  {formatNum(m.retencion)}
                                </div>
                              ))}
                            </div>
                          </TableCell>

                          {/* COBRO: ¡UN SOLO COBRO FAMILIAR! */}
                          <TableCell className="text-xs text-right align-middle py-3.5 font-bold text-slate-900 dark:text-white">
                            <div className="flex flex-col items-end justify-center">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {formatNum(row.familyTotals.cobro)}
                              </span>
                              <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                (Cobro Familiar)
                              </span>
                            </div>
                          </TableCell>

                          {/* SALDO ACTUAL: ¡UN SOLO SALDO ACTUAL FAMILIAR! */}
                          <TableCell className="text-right align-middle py-3.5 pr-6">
                            <div className="flex flex-col items-end justify-center">
                              <span className="text-sm font-black text-blue-700 dark:text-blue-400 tracking-tight">
                                {formatNum(row.familyTotals.saldoActual)}
                              </span>
                              <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                (Saldo Total Familiar)
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter className="bg-gray-100 dark:bg-gray-800 tabular-nums">
                    <TableRow>
                      <TableCell className="text-[10px] font-bold uppercase pl-6 py-4">TOTAL {group.label}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatNum(group.totals.saldoAnterior)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatNum(group.totals.facturacion)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatNum(group.totals.nd)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatNum(group.totals.nc)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatNum(group.totals.retencion)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{formatNum(group.totals.cobro)}</TableCell>
                      <TableCell className="text-xs text-right font-bold pr-6">{formatNum(group.totals.saldoActual)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

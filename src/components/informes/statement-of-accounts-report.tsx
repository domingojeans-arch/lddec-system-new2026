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

      const sortedClients = [...visibleClients].sort((a, b) => {
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

  // Detección y consolidación de cuenta familiar si hay miembros vinculados presentes en el reporte
  const familySummary = useMemo(() => {
    const allComputedClientRows = reportData.flatMap(g => g.clients);
    if (allComputedClientRows.length < 2) return null;

    // Buscar clientes vinculados entre sí
    const linkedClients = clients.filter(c => 
      c.parentClientId || clients.some(other => other.parentClientId === c.id)
    );
    if (linkedClients.length < 2) return null;

    // Identificar el titular principal del grupo
    const titularClient = linkedClients.find(c => !c.parentClientId && clients.some(other => other.parentClientId === c.id)) || linkedClients[0];
    const titularId = titularClient?.id;

    // Filtrar los rows calculados que pertenecen a este grupo familiar
    const familyRows = allComputedClientRows.filter(row => {
      const matchClient = clients.find(c => c.id === row.id);
      if (!matchClient) return false;
      const rootId = matchClient.parentClientId || matchClient.id;
      return rootId === titularId || matchClient.id === titularId || matchClient.parentClientId === titularId;
    });

    if (familyRows.length < 2) return null;

    const totals = familyRows.reduce((acc, r) => ({
      saldoAnterior: acc.saldoAnterior + r.saldoAnterior,
      facturacion: acc.facturacion + r.facturacion,
      nd: acc.nd + r.nd,
      nc: acc.nc + r.nc,
      retencion: acc.retencion + r.retencion,
      cobro: acc.cobro + r.cobro,
      saldoActual: acc.saldoActual + r.saldoActual
    }), { saldoAnterior: 0, facturacion: 0, nd: 0, nc: 0, retencion: 0, cobro: 0, saldoActual: 0 });

    const memberNames = familyRows.map(r => r.name).join(" + ");

    return {
      titularName: titularClient ? formatClientName(titularClient.name, titularClient.firstName, titularClient.lastName) : familyRows[0].name,
      memberNames,
      members: familyRows,
      totals
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
        {/* Banner Consolidado de Cuenta Familiar si aplica */}
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
              <div className="bg-white/80 dark:bg-gray-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">N/D</span>
                <span className="text-xs font-black text-foreground">${formatNum(familySummary.totals.nd)}</span>
              </div>
              <div className="bg-white/80 dark:bg-gray-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">N/C</span>
                <span className="text-xs font-black text-foreground">${formatNum(familySummary.totals.nc)}</span>
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
                    {group.clients.map((client, idx) => (
                      <TableRow key={idx} className="border-b border-gray-100 dark:border-gray-800">
                        <TableCell className="text-xs font-semibold uppercase pl-6">
                          <div>{client.name}</div>
                          {client.parentClientName && (
                            <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 tracking-normal">
                              (familiar de: {client.parentClientName})
                            </div>
                          )}
                          {!client.parentClientName && clients.some(c => c.parentClientId === client.id) && (
                            <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 tracking-normal">
                              (cuenta titular familiar)
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatNum(client.saldoAnterior)}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatNum(client.facturacion)}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatNum(client.nd)}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatNum(client.nc)}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatNum(client.retencion)}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatNum(client.cobro)}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-900 dark:text-white pr-6">{formatNum(client.saldoActual)}</TableCell>
                      </TableRow>
                    ))}

                    {/* Fila consolidada de cuenta familiar en la tabla */}
                    {familySummary && group.clients.some(c => familySummary.members.some(m => m.id === c.id)) && (
                      <TableRow className="bg-blue-50/90 dark:bg-blue-950/50 border-t-2 border-b-2 border-blue-500/50 font-black">
                        <TableCell className="text-xs font-black uppercase text-blue-900 dark:text-blue-200 pl-6 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-blue-600 shrink-0" />
                            <span>TOTAL CUENTA FAMILIAR ({familySummary.members.length} MIEMBROS)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-900 dark:text-blue-200">{formatNum(familySummary.totals.saldoAnterior)}</TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-900 dark:text-blue-200">{formatNum(familySummary.totals.facturacion)}</TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-900 dark:text-blue-200">{formatNum(familySummary.totals.nd)}</TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-900 dark:text-blue-200">{formatNum(familySummary.totals.nc)}</TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-900 dark:text-blue-200">{formatNum(familySummary.totals.retencion)}</TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-900 dark:text-blue-200">{formatNum(familySummary.totals.cobro)}</TableCell>
                        <TableCell className="text-xs text-right font-black text-blue-700 dark:text-blue-400 pr-6 text-sm">{formatNum(familySummary.totals.saldoActual)}</TableCell>
                      </TableRow>
                    )}
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

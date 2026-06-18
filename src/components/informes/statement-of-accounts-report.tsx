"use client";

import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
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

export function StatementOfAccountsReport({ clients, invoices, payments, dateFrom, dateTo }: StatementOfAccountsReportProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDirection] = useState<"asc" | "desc">("asc");

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
        const clientInvoices = invoices.filter(inv => inv && (inv.clientId === client.id || inv.clienteId === client.id || inv.clientName === client.name));
        
        const uniqueMvs = new Map<string, any>();
        
        // 1. Procesar pagos embebidos de las facturas del cliente
        clientInvoices.forEach(inv => {
          const invoiceMovs = Array.isArray(inv.pagosYajustes) 
            ? inv.pagosYajustes 
            : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
          
          invoiceMovs.forEach((m: any) => {
            if (!m || m.anulado) return;
            const pDate = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
            const key = `${m.tipoTransaccion || m.tipo || 'PAGO'}-${Number(m.monto || 0)}-${pDate?.getTime() || 0}`;
            uniqueMvs.set(key, m);
          });
        });

        // 2. Procesar pagos globales filtrando por ID de cliente
        (payments || []).forEach((p: any) => {
          if (!p || p.anulado) return;
          if (p.clienteId === client.id || p.clientId === client.id) {
            const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
            const key = `${p.tipoTransaccion || p.tipo || 'PAGO'}-${Number(p.monto || 0)}-${pDate?.getTime() || 0}`;
            if (!uniqueMvs.has(key)) {
              uniqueMvs.set(key, p);
            }
          }
        });

        const clientPayments = Array.from(uniqueMvs.values());

        const metrics = calculateClientAccountingMetrics(
          Number(client.baseDebt || client.saldoInicial || 0),
          dateFrom,
          dateTo,
          clientInvoices,
          clientPayments,
          client
        );

        return {
          name: formatClientName(client.name || `${client.firstName || ""} ${client.lastName || ""}`),
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
        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl gap-2 shadow-lg shadow-primary/20">
          <Printer className="h-4 w-4" /> Imprimir Reporte Contable
        </Button>
      </div>

      <div className="space-y-12">
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
                  <TableBody>
                    {group.clients.map((client, idx) => (
                      <TableRow key={idx} className="border-b border-gray-100 dark:border-gray-800">
                        <TableCell className="text-[10px] font-bold uppercase pl-6">{client.name}</TableCell>
                        <TableCell className="text-[10px] text-right">{formatNum(client.saldoAnterior)}</TableCell>
                        <TableCell className="text-[10px] text-right">{formatNum(client.facturacion)}</TableCell>
                        <TableCell className="text-[10px] text-right">{formatNum(client.nd)}</TableCell>
                        <TableCell className="text-[10px] text-right">{formatNum(client.nc)}</TableCell>
                        <TableCell className="text-[10px] text-right">{formatNum(client.retencion)}</TableCell>
                        <TableCell className="text-[10px] text-right">{formatNum(client.cobro)}</TableCell>
                        <TableCell className="text-[10px] text-right font-black pr-6">{formatNum(client.saldoActual)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-gray-100 dark:bg-gray-800">
                    <TableRow>
                      <TableCell className="text-[9px] font-black uppercase pl-6 py-4">TOTAL {group.label}</TableCell>
                      <TableCell className="text-[10px] text-right font-black">{formatNum(group.totals.saldoAnterior)}</TableCell>
                      <TableCell className="text-[10px] text-right font-black">{formatNum(group.totals.facturacion)}</TableCell>
                      <TableCell className="text-[10px] text-right font-black">{formatNum(group.totals.nd)}</TableCell>
                      <TableCell className="text-[10px] text-right font-black">{formatNum(group.totals.nc)}</TableCell>
                      <TableCell className="text-[10px] text-right font-black">{formatNum(group.totals.retencion)}</TableCell>
                      <TableCell className="text-[10px] text-right font-black">{formatNum(group.totals.cobro)}</TableCell>
                      <TableCell className="text-[10px] text-right font-black pr-6">{formatNum(group.totals.saldoActual)}</TableCell>
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

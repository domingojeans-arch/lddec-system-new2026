"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { filterPaymentsByDate, calculateClientAccountingMetrics } from "@/lib/accounting-motor";
import { collection, getDocs } from "firebase/firestore";
import { toDate } from "@/lib/toDate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { exportReportToPdf } from "@/lib/pdfExport";
import { formatClientName } from "@/lib/format-name";

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

function PrintContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [fechaGenerada, setFechaGenerada] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const dateFrom = searchParams.get("from") || "";
  const dateTo = searchParams.get("to") || "";

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportReportToPdf("print-area-estado-cuentas", {
        filename: `estado-cuentas-corte-${dateFrom || 'inicio'}-al-${dateTo || 'fin'}.pdf`,
        landscape: true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
    
    async function loadData() {
      if (!db || !dateFrom || !dateTo) return;
      
      try {
        const [clientsSnap, invoicesSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "facturas")),
          getDocs(collection(db, "payments"))
        ]);

        const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        const groups = [
          { id: "nacional", label: "CLIENTE NACIONAL" },
          { id: "socio", label: "SOCIO" },
          { id: "especial", label: "CLIENTE ESPECIAL" },
          { id: "moroso", label: "MOROSOS" },
        ];

        const finalGroups = groups.map(group => {
          const groupClients = clients.filter(c => {
            const rawClass = (c.classification || c.clasificacion || "nacional").toString().toLowerCase().trim();
            return rawClass.includes(group.id);
          });

          const calculatedClients = groupClients.map(client => {
            const clientInvoices = invoices.filter(inv => isMatchForClient(inv, client));
            
            // Merge embedded and global payments
            const uniqueMvs = new Map<string, any>();
            clientInvoices.forEach(inv => {
              const invoiceMovs = Array.isArray(inv.pagosYajustes) 
                ? inv.pagosYajustes 
                : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
              
              invoiceMovs.forEach((m: any) => {
                if (!m) return;
                const isAnulado = Boolean(m.anulado) || m.estado === "anulado" || m.estado === "Anulado" || m.status === "anulado";
                if (isAnulado) return;
                const pDate = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
                const key = `${m.tipoTransaccion || m.tipo || 'PAGO'}-${Number(m.monto || 0)}-${pDate?.getTime() || 0}`;
                uniqueMvs.set(key, m);
              });
            });

            payments.forEach((p: any) => {
              if (!p) return;
              const isAnulado = Boolean(p.anulado) || p.estado === "anulado" || p.estado === "Anulado" || p.status === "anulado";
              if (isAnulado) return;
              if (isMatchForClient(p, client)) {
                const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
                const key = `${p.tipoTransaccion || 'PAGO'}-${Number(p.monto || 0)}-${pDate?.getTime() || 0}`;
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
          }).filter(r => r.hasMovement || Math.abs(r.saldoActual) > 0.01);

          // AGRUPACIÓN FAMILIAR: Unir miembros familiares bajo la misma fila de cuenta familiar
          const processedClientIds = new Set<string>();
          const groupedRows: any[] = [];
          const sortedVisible = [...calculatedClients].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

          for (const clientRow of sortedVisible) {
            if (processedClientIds.has(clientRow.id)) continue;

            const rawClient = clients.find(c => c.id === clientRow.id);
            const rootId = rawClient?.parentClientId || rawClient?.id;

            const familyMembers = sortedVisible.filter(c => {
              const rawC = clients.find(cl => cl.id === c.id);
              const cRoot = rawC?.parentClientId || rawC?.id;
              return cRoot === rootId || rawC?.id === rootId || rawC?.parentClientId === rootId;
            });

            if (familyMembers.length > 1) {
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
              processedClientIds.add(clientRow.id);
              groupedRows.push({
                isFamily: false,
                ...clientRow
              });
            }
          }

          const totals = calculatedClients.reduce((acc, curr) => ({
            saldoAnterior: acc.saldoAnterior + curr.saldoAnterior,
            facturacion: acc.facturacion + curr.facturacion,
            nd: acc.nd + curr.nd,
            nc: acc.nc + curr.nc,
            retencion: acc.retencion + curr.retencion,
            cobro: acc.cobro + curr.cobro,
            saldoActual: acc.saldoActual + curr.saldoActual,
          }), { saldoAnterior: 0, facturacion: 0, nd: 0, nc: 0, retencion: 0, cobro: 0, saldoActual: 0 });

          return { ...group, rows: groupedRows, totals };
        }).filter(g => g.rows.length > 0);

        setReportData(finalGroups);
        setLoading(false);
        
        setTimeout(() => {
          window.print();
        }, 1000);
      } catch (e) {
        console.error(e);
      }
    }

    loadData();
  }, [dateFrom, dateTo]);

  const formatNum = (val: number) => {
    if (Math.abs(val) < 0.001) return "-";
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) return <div className="p-20 text-center font-black uppercase tracking-widest">Generando Estado de Cuentas A4...</div>;

  return (
    <div id="print-area-estado-cuentas" className="print-page reporte-horizontal relative">
      <div className="fixed top-4 right-4 z-50 flex gap-2 print:hidden bg-white/95 backdrop-blur p-2 rounded-xl shadow-lg border border-slate-300">
        <Button onClick={() => window.print()} variant="outline" className="text-xs h-9 gap-1.5 font-bold">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
        <Button onClick={handleExportPdf} disabled={isExporting} className="text-xs h-9 gap-1.5 bg-primary text-white font-bold">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isExporting ? "Generando..." : "Guardar como PDF"}
        </Button>
      </div>
      <style>{`
        @page { 
          size: A4 landscape !important; 
          margin: 15mm !important; 
        }
        .reporte-horizontal {
          width: 100%;
        }
        body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
        .print-page {
          width: 29.7cm;
          min-height: 21cm;
          margin: 0 auto;
          background: white;
          padding: 1.2cm;
          position: relative;
          font-family: 'Inter', sans-serif;
        }
        .header-logo { position: absolute; top: 1.2cm; right: 1.2cm; width: 2.2cm; height: 2.2cm; object-fit: contain; }
        .header-title { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
        .header-subtitle { font-size: 13pt; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 10px; }
        .meta-info { font-size: 9pt; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 20px; }
        table { border: 1.5pt solid black !important; border-collapse: collapse !important; width: 100% !important; margin-bottom: 10px; }
        th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 7.5pt !important; padding: 4px !important; text-transform: uppercase; }
        td { border: 1pt solid black !important; color: black !important; font-size: 7.5pt !important; padding: 4px 6px !important; line-height: 1.2; }
        .group-header { background: #f8fafc !important; border-left: 6px solid #3b82f6 !important; padding: 4px 10px !important; margin: 15px 0 5px 0 !important; font-weight: 900; font-size: 8pt; text-transform: uppercase; }
      `}</style>

      <img src="/logo-lddec.png" alt="Logo" className="header-logo" />
      <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
      <div className="header-subtitle">Estado de Cuentas por Cliente</div>
      <div className="meta-info">
        <p>Periodo: {dateFrom} al {dateTo}</p>
        <p>Generado el: {fechaGenerada}</p>
      </div>

      {reportData.map((group) => (
        <div key={group.id} className="space-y-2">
          <div className="group-header">{group.label}</div>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: '25%' }}>Cliente</th>
                <th style={{ textAlign: 'right' }}>S. Anterior</th>
                <th style={{ textAlign: 'right' }}>Facturación</th>
                <th style={{ textAlign: 'right' }}>N/D</th>
                <th style={{ textAlign: 'right' }}>N/C</th>
                <th style={{ textAlign: 'right' }}>Retención</th>
                <th style={{ textAlign: 'right' }}>Cobro</th>
                <th style={{ textAlign: 'right' }}>Saldo Actual</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row: any, i: number) => {
                if (!row.isFamily) {
                  return (
                    <tr key={i}>
                      <td>{row.name}</td>
                      <td style={{ textAlign: 'right' }}>{formatNum(row.saldoAnterior)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNum(row.facturacion)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNum(row.nd)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNum(row.nc)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNum(row.retencion)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNum(row.cobro)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatNum(row.saldoActual)}</td>
                    </tr>
                  );
                }

                return (
                  <tr key={i} style={{ backgroundColor: '#f0f7ff', borderBottom: '1.5pt solid #3b82f6' }}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>
                        {row.primaryMember.name} (Cuenta Familiar)
                        {row.familyTotals.nc > 0.01 && <span style={{ marginLeft: '4px', fontSize: '6.5pt', color: '#b45309', background: '#fef3c7', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>Tiene N/C (${formatNum(row.familyTotals.nc)})</span>}
                        {row.familyTotals.nd > 0.01 && <span style={{ marginLeft: '4px', fontSize: '6.5pt', color: '#7e22ce', background: '#f3e8ff', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>Tiene N/D (${formatNum(row.familyTotals.nd)})</span>}
                        {row.primaryMember.nc > 0.01 && <span style={{ marginLeft: '4px', fontSize: '6.5pt', color: '#b45309' }}>(N/C: ${formatNum(row.primaryMember.nc)})</span>}
                        {row.primaryMember.nd > 0.01 && <span style={{ marginLeft: '4px', fontSize: '6.5pt', color: '#7e22ce' }}>(N/D: ${formatNum(row.primaryMember.nd)})</span>}
                      </div>
                      {row.linkedMembers.map((m: any) => (
                        <div key={m.id} style={{ paddingLeft: '10px', fontSize: '7pt', color: '#1d4ed8' }}>
                          ↳ {m.name} (Familiar Vinculado)
                          {m.nc > 0.01 && <span style={{ marginLeft: '4px', fontSize: '6.5pt', color: '#b45309', fontWeight: 'bold' }}>(N/C: ${formatNum(m.nc)})</span>}
                          {m.nd > 0.01 && <span style={{ marginLeft: '4px', fontSize: '6.5pt', color: '#7e22ce', fontWeight: 'bold' }}>(N/D: ${formatNum(m.nd)})</span>}
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div>{formatNum(row.primaryMember.saldoAnterior)}</div>
                      {row.linkedMembers.map((m: any) => (
                        <div key={m.id} style={{ fontSize: '7pt', color: '#64748b' }}>{formatNum(m.saldoAnterior)}</div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div>{formatNum(row.primaryMember.facturacion)}</div>
                      {row.linkedMembers.map((m: any) => (
                        <div key={m.id} style={{ fontSize: '7pt', color: '#64748b' }}>{formatNum(m.facturacion)}</div>
                      ))}
                      {row.linkedMembers.some((m: any) => Math.abs(m.facturacion) > 0.01) && Math.abs(row.primaryMember.facturacion) > 0.01 && (
                        <div style={{ borderTop: '0.5pt solid #94a3b8', fontSize: '6.5pt', fontWeight: 'bold' }}>
                          ∑ {formatNum(row.familyTotals.facturacion)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ color: row.primaryMember.nd > 0.01 ? '#7e22ce' : 'inherit', fontWeight: row.primaryMember.nd > 0.01 ? 'bold' : 'normal' }}>{formatNum(row.primaryMember.nd)}</div>
                      {row.linkedMembers.map((m: any) => (
                        <div key={m.id} style={{ fontSize: '7pt', color: m.nd > 0.01 ? '#7e22ce' : '#64748b', fontWeight: m.nd > 0.01 ? 'bold' : 'normal' }}>{formatNum(m.nd)}</div>
                      ))}
                      {row.familyTotals.nd > 0.01 && (
                        <div style={{ borderTop: '0.5pt solid #d8b4fe', fontSize: '6.5pt', fontWeight: 'bold', color: '#7e22ce' }}>
                          ∑ {formatNum(row.familyTotals.nd)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ color: row.primaryMember.nc > 0.01 ? '#b45309' : 'inherit', fontWeight: row.primaryMember.nc > 0.01 ? 'bold' : 'normal' }}>{formatNum(row.primaryMember.nc)}</div>
                      {row.linkedMembers.map((m: any) => (
                        <div key={m.id} style={{ fontSize: '7pt', color: m.nc > 0.01 ? '#b45309' : '#64748b', fontWeight: m.nc > 0.01 ? 'bold' : 'normal' }}>{formatNum(m.nc)}</div>
                      ))}
                      {row.familyTotals.nc > 0.01 && (
                        <div style={{ borderTop: '0.5pt solid #fcd34d', fontSize: '6.5pt', fontWeight: 'bold', color: '#b45309' }}>
                          ∑ {formatNum(row.familyTotals.nc)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div>{formatNum(row.primaryMember.retencion)}</div>
                      {row.linkedMembers.map((m: any) => (
                        <div key={m.id} style={{ fontSize: '7pt', color: '#64748b' }}>{formatNum(m.retencion)}</div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                      {formatNum(row.familyTotals.cobro)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle', color: '#1d4ed8' }}>
                      {formatNum(row.familyTotals.saldoActual)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: '#f8fafc', fontWeight: 'bold' }}>
              <tr>
                <td>TOTAL {group.label}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.saldoAnterior)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.facturacion)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.nd)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.nc)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.retencion)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.cobro)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(group.totals.saldoActual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function PrintEstadoCuentasPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">Cargando motor contable...</div>}>
      <PrintContent />
    </Suspense>
  );
}

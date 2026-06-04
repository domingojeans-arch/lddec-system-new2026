
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { filterPaymentsByDate } from "@/lib/accounting-motor";
import { collection, getDocs } from "firebase/firestore";
import { toDate } from "@/lib/toDate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { formatClientName } from "@/lib/format-name";

function PrintContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [fechaGenerada, setFechaGenerada] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);

  const dateFrom = searchParams.get("from") || "";
  const dateTo = searchParams.get("to") || "";

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
    
    async function loadData() {
      if (!db || !dateFrom || !dateTo) return;
      
      try {
        // Carga paralela de colecciones completas
        const [clientsSnap, invoicesSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "facturas"))
        ]);

        const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

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

          const rows = groupClients.map(client => {
            const cInvoices = invoices.filter(inv => inv.clientId === client.id || inv.clienteId === client.id);
            
            const saldoAnterior = Number(client.baseDebt || client.saldoInicial || 0);
            
            const fromDate = new Date(dateFrom + "T00:00:00");
            const toDateObj = new Date(dateTo + "T23:59:59");

            const invoicesInPeriod = cInvoices.filter(inv => {
              const d = toDate(inv.fechaFactura || inv.date);
              return d && d >= fromDate && d <= toDateObj;
            });

            const totalDebe = invoicesInPeriod.reduce((acc, inv) => acc + Number(inv.totalFactura || inv.total || 0), 0);

            let totalHaber = 0;
            invoicesInPeriod.forEach(inv => {
              const rawMov = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
              const movimientos = filterPaymentsByDate(rawMov, fromDate, toDateObj);
              movimientos.forEach((m: any) => {
                if (m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso') {
                  totalHaber -= Number(m.monto || 0);
                } else {
                  totalHaber += Number(m.monto || 0);
                }
              });
            });

            const saldoActual = (saldoAnterior + totalDebe) - totalHaber;

            const lastInvoice = invoicesInPeriod.sort((a,b) => {
              const dA = toDate(a.fechaFactura || a.date) || new Date(0);
              const dB = toDate(b.fechaFactura || b.date) || new Date(0);
              return dB.getTime() - dA.getTime();
            })[0];
            const lastDate = lastInvoice ? toDate(lastInvoice.fechaFactura || lastInvoice.date) : null;
            const daysDiff = lastDate ? Math.floor((new Date().getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

            let bgClass = "";
            if (saldoActual > 0) {
              if (daysDiff >= 9 && daysDiff <= 14) bgClass = "bg-yellow-50";
              else if (daysDiff >= 15 && daysDiff <= 29) bgClass = "bg-amber-50";
              else if (daysDiff >= 30) bgClass = "bg-rose-50";
            }

            return {
              name: formatClientName(client.name || client.firstName || ""),
              saldoAnterior,
              facturacion: totalDebe,
              nd: 0,
              nc: 0,
              retencion: 0,
              cobro: totalHaber,
              saldoActual,
              bgClass
            };
          }).filter(r => Math.abs(r.saldoAnterior) > 0.01 || Math.abs(r.facturacion) > 0.01 || Math.abs(r.cobro) > 0.01 || Math.abs(r.saldoActual) > 0.01);

          /**
           * MOTOR DE ORDENAMIENTO LDDEC 1.4 (ALFABÉTICO DIRECTO)
           */
          rows.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

          const totals = rows.reduce((acc, curr) => ({
            saldoAnterior: acc.saldoAnterior + curr.saldoAnterior,
            facturacion: acc.facturacion + curr.facturacion,
            nd: acc.nd + curr.nd,
            nc: acc.nc + curr.nc,
            retencion: acc.retencion + curr.retencion,
            cobro: acc.cobro + curr.cobro,
            saldoActual: acc.saldoActual + curr.saldoActual,
          }), { saldoAnterior: 0, facturacion: 0, nd: 0, nc: 0, retencion: 0, cobro: 0, saldoActual: 0 });

          return { ...group, rows, totals };
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
    <div className="print-page reporte-horizontal">
      <style>{`
        @page { 
          size: A4 landscape; 
          margin: 15mm; 
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
        td { border: 1pt solid black !important; color: black !important; font-size: 7.5pt !important; padding: 3px 6px !important; line-height: 1.1; }
        .group-header { background: #f8fafc !important; border-left: 6px solid #3b82f6 !important; padding: 4px 10px !important; margin: 15px 0 5px 0 !important; font-weight: 900; font-size: 8pt; text-transform: uppercase; }
        .bg-red-100 { background-color: #fee2e2 !important; }
        .bg-orange-50 { background-color: #fff7ed !important; }
        .bg-amber-50 { background-color: #fffbeb !important; }
        .bg-yellow-50 { background-color: #fef9c3 !important; }
        .bg-rose-50 { background-color: #fff1f2 !important; }
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
              {group.rows.map((row: any, i: number) => (
                <tr key={i} className={row.bgClass}>
                  <td>{row.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(row.saldoAnterior)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(row.facturacion)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(row.nd)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(row.nc)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(row.retencion)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(row.cobro)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatNum(row.saldoActual)}</td>
                </tr>
              ))}
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

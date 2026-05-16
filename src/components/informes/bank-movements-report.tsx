
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Building, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface BankMovementsReportProps {
  accounts: any[];
  transactions: any[];
  dateFrom: string;
  dateTo: string;
}

export function BankMovementsReport({ accounts, transactions, dateFrom, dateTo }: BankMovementsReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const reportData = useMemo(() => {
    const fromDate = new Date(dateFrom + "T00:00:00");
    const toDate = new Date(dateTo + "T23:59:59");

    return accounts.map(account => {
      const prevTxs = transactions.filter(t => {
        const d = t.fecha?.toDate ? t.fecha.toDate() : new Date(t.fecha);
        return t.accountId === account.id && d < fromDate;
      });
      
      const saldoAnterior = prevTxs.reduce((acc, t) => {
        return t.tipo === 'Deposito' ? acc + t.monto : acc - t.monto;
      }, Number(account.saldoInicial || 0));

      const periodTxs = transactions
        .filter(t => {
          const d = t.fecha?.toDate ? t.fecha.toDate() : new Date(t.fecha);
          return t.accountId === account.id && d >= fromDate && d <= toDate;
        })
        .sort((a, b) => {
          const dA = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha).getTime();
          const dB = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha).getTime();
          return dA - dB;
        });

      let currentRunningBalance = saldoAnterior;
      const history = periodTxs.map(tx => {
        const debe = tx.tipo === 'Deposito' ? tx.monto : 0;
        const haber = tx.tipo === 'Retiro' ? tx.monto : 0;
        currentRunningBalance = currentRunningBalance + debe - haber;
        
        return {
          ...tx,
          dateStr: tx.fecha?.toDate ? tx.fecha.toDate().toLocaleDateString('es-EC') : new Date(tx.fecha).toLocaleDateString('es-EC'),
          debe,
          haber,
          saldo: currentRunningBalance
        };
      });

      const totalDebe = history.reduce((acc, h) => acc + h.debe, 0);
      const totalHaber = history.reduce((acc, h) => acc + h.haber, 0);

      return {
        ...account,
        saldoAnterior,
        history,
        totalDebe,
        totalHaber,
        saldoFinal: currentRunningBalance
      };
    }).filter(acc => acc.history.length > 0 || Math.abs(acc.saldoAnterior) > 0.01);
  }, [accounts, transactions, dateFrom, dateTo]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    reportData.forEach(acc => {
      const dataRows = [];
      
      // Saldo anterior
      dataRows.push({
        "Fecha": "--",
        "Concepto / Referencia": "SALDO ANTERIOR",
        "Debe (+)": 0,
        "Haber (-)": 0,
        "Saldo": acc.saldoAnterior
      });

      // Movimientos
      acc.history.forEach((tx: any) => {
        dataRows.push({
          "Fecha": tx.dateStr,
          "Concepto / Referencia": tx.concepto.toUpperCase(),
          "Debe (+)": tx.debe,
          "Haber (-)": tx.haber,
          "Saldo": tx.saldo
        });
      });

      // Totales
      dataRows.push({
        "Fecha": "TOTAL",
        "Concepto / Referencia": (acc.nombre || acc.accountName).toUpperCase(),
        "Debe (+)": acc.totalDebe,
        "Haber (-)": acc.totalHaber,
        "Saldo": acc.saldoFinal
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      
      // Ajustar anchos de columna básicos
      ws['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 40 }, // Concepto
        { wch: 15 }, // Debe
        { wch: 15 }, // Haber
        { wch: 15 }  // Saldo
      ];

      XLSX.utils.book_append_sheet(wb, ws, (acc.nombre || acc.accountName).substring(0, 31));
    });

    const fileName = `Reporte_Bancario_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: portrait; margin: 0; }
          body { margin: 0; padding: 0; background: white !important; }
          #bank-report-area {
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
          .header-subtitle { font-size: 13pt; font-weight: 700; color: #3b82f6 !important; text-transform: uppercase; margin-bottom: 10px; }
          .meta-info { font-size: 9pt; font-weight: 600; color: #64748b !important; text-transform: uppercase; margin-bottom: 15px; }
          table { border: 1.5pt solid black !important; border-collapse: collapse !important; width: 100% !important; margin-bottom: 20px; }
          th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 8pt !important; padding: 4px 8px !important; }
          td { border: 1pt solid black !important; color: black !important; font-size: 8pt !important; padding: 3px 8px !important; line-height: 1.1; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-border pb-4 print-hidden">
        <h2 className="text-xl font-black uppercase tracking-tight">Movimientos de Bancos y Cajas</h2>
        <div className="flex gap-3">
          <Button onClick={handleExportExcel} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold h-11 px-6 rounded-xl gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
          </Button>
          <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg">
            <Printer className="h-4 w-4" /> Imprimir Reporte Bancario
          </Button>
        </div>
      </div>

      <div id="bank-report-area">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Movimientos de Bancos y Cajas</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        {reportData.map((acc) => (
          <div key={acc.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight">{acc.nombre || acc.accountName}</h3>
              <p className="text-lg font-black text-emerald-600">{formatCurrency(acc.saldoFinal)}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead>Concepto / Referencia</TableHead>
                  <TableHead className="text-right">Debe (+)</TableHead>
                  <TableHead className="text-right">Haber (-)</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/20 font-bold">
                  <TableCell>--</TableCell>
                  <TableCell>SALDO ANTERIOR</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="text-right">{formatCurrency(acc.saldoAnterior)}</TableCell>
                </TableRow>
                {acc.history.map((tx: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{tx.dateStr}</TableCell>
                    <TableCell className="uppercase">{tx.concepto}</TableCell>
                    <TableCell className="text-right text-emerald-600">{tx.debe > 0 ? formatCurrency(tx.debe) : ""}</TableCell>
                    <TableCell className="text-right text-red-500">{tx.haber > 0 ? formatCurrency(tx.haber) : ""}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(tx.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-muted/20">
                <TableRow>
                  <TableCell colSpan={2} className="font-black uppercase">Resumen Cuenta</TableCell>
                  <TableCell className="text-right font-black text-emerald-600">{formatCurrency(acc.totalDebe)}</TableCell>
                  <TableCell className="text-right font-black text-red-500">{formatCurrency(acc.totalHaber)}</TableCell>
                  <TableCell className="text-right font-black text-lg">{formatCurrency(acc.saldoFinal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}

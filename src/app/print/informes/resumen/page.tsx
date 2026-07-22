"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PrintContent() {
  const searchParams = useSearchParams();
  const [fechaGenerada, setFechaGenerada] = useState('');
  const [monthlyData, setMonthlyData] = useState<any>(null);

  const mode = searchParams.get("mode");

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
    
    if (mode === "mensual") {
      const stored = localStorage.getItem("monthly_print_data");
      if (stored) {
        try {
          setMonthlyData(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Retraso mínimo para asegurar que las fuentes y estilos carguen antes del diálogo
    const timer = setTimeout(() => {
      window.print();
    }, 1200);
    return () => clearTimeout(timer);
  }, [mode]);

  const data = {
    si: searchParams.get("si") || "0",
    in: searchParams.get("in") || "0",
    out: searchParams.get("out") || "0",
    df: searchParams.get("df") || "0",
    dsf: searchParams.get("dsf") || "0",
    sf: searchParams.get("sf") || "0",
    from: searchParams.get("from") || "---",
    to: searchParams.get("to") || "---"
  };

  const formatNum = (val: any) => {
    return Number(val || 0).toLocaleString('es-ES');
  };

  if (mode === "mensual" && monthlyData) {
    return (
      <div className="print-container-mensual">
        <style>{`
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body {
            margin: 0;
            padding: 0;
            background: #f0f0f0;
            -webkit-print-color-adjust: exact;
          }
          .print-container-mensual {
            width: 21cm;
            margin: 0 auto;
            background: white;
            padding: 1.5cm;
            font-family: 'Inter', sans-serif;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            box-sizing: border-box;
          }
          @media print {
            body { background: white; }
            .print-container-mensual { 
              box-shadow: none; 
              margin: 0;
              width: 100%;
              padding: 0;
            }
          }
          .monthly-report-card {
            border: 1.5pt solid black;
            padding: 20px;
            margin-bottom: 25px;
            background: white;
            page-break-inside: avoid;
            position: relative;
          }
          .card-header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            border-bottom: 1pt solid #e2e8f0;
            padding-bottom: 10px;
          }
          .card-title-area {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .card-title-main {
            font-size: 11pt;
            font-weight: 900;
            text-transform: uppercase;
            color: black;
          }
          .card-title-sub {
            font-size: 9pt;
            font-weight: 700;
            color: #3b82f6;
            text-transform: uppercase;
          }
          .card-meta-text {
            font-size: 8pt;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            text-align: right;
          }
          .monthly-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5pt solid black;
            margin-bottom: 8px;
          }
          .monthly-table th {
            background: #f1f5f9;
            border: 1.5pt solid black;
            padding: 6px 10px;
            text-align: left;
            font-size: 8pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .monthly-table td {
            border: 1pt solid #e2e8f0;
            padding: 5px 10px;
            font-size: 8.5pt;
            vertical-align: middle;
            line-height: 1.1;
          }
          .col-label { width: 75%; }
          .col-value { width: 25%; text-align: right; font-family: monospace; font-weight: 700; }
          .row-in { color: #059669; font-weight: 800; }
          .row-out { color: #dc2626; font-weight: 800; }
          .row-sub { color: #64748b; font-style: italic; font-size: 8pt; }
          .row-final { 
            background: #f8fafc;
            border-top: 2pt solid black !important;
          }
          .final-label { font-weight: 900; text-transform: uppercase; font-size: 9.5pt; }
          .final-value { font-size: 12pt; font-weight: 900; }
          .card-footer-note {
            font-size: 7.5pt;
            color: #94a3b8;
            font-weight: 500;
            text-align: center;
          }
        `}</style>

        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">LABORATORIO DEL DENIM ECUADOR</h1>
            <h2 className="text-sm font-bold uppercase text-primary">Desglose Operativo Mensual de Inventario</h2>
            <p className="text-[10px] font-black uppercase text-muted-foreground mt-1">Periodo: {monthlyData.from} al {monthlyData.to}</p>
          </div>
          <img src="/logo-lddec.png" alt="Logo" className="w-16 h-16 object-contain" />
        </div>

        {monthlyData.months.map((month: any, index: number) => (
          <div key={index} className="monthly-report-card">
            <div className="card-header-row">
              <div className="card-title-area">
                <span className="card-title-main">LDDEC - Resumen de Movimientos</span>
                <span className="card-title-sub">{month.label}</span>
              </div>
              <div className="card-meta-text">
                <p>Mes: {index + 1} / {monthlyData.months.length}</p>
                <p style={{ marginTop: '2px' }}>Rango: {month.from} al {month.to}</p>
              </div>
            </div>

            <table className="monthly-table">
              <thead>
                <tr>
                  <th className="col-label">Métrica de Inventario</th>
                  <th className="col-value">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="col-label">Stock Inicial (Balance al inicio del mes)</td>
                  <td className="col-value">{formatNum(month.si)}</td>
                </tr>
                <tr className="row-in">
                  <td className="col-label">(+) Total Prendas Ingresadas en Planta</td>
                  <td className="col-value">{formatNum(month.in)}</td>
                </tr>
                <tr className="row-out">
                  <td className="col-label">(-) Total Prendas Despachadas (Salidas)</td>
                  <td className="col-value">{formatNum(month.out)}</td>
                </tr>
                <tr className="row-sub">
                  <td className="col-label" style={{ paddingLeft: '0.8cm' }}>• de las cuales facturadas</td>
                  <td className="col-value">{formatNum(month.df)}</td>
                </tr>
                <tr className="row-sub">
                  <td className="col-label" style={{ paddingLeft: '0.8cm' }}>• de las cuales sin facturar</td>
                  <td className="col-value">{formatNum(month.dsf)}</td>
                </tr>
                <tr className="row-final">
                  <td className="col-label final-label">Saldo Final en Bodega (Fin del mes)</td>
                  <td className="col-value final-value">{formatNum(month.sf)}</td>
                </tr>
              </tbody>
            </table>
            
            <div className="card-footer-note mt-2">
              Lógica de cálculo: Stock Inicial Base al 01/01/2026 unificado con registros de ingresos y salidas del mes.
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="print-page">
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          background: #f0f0f0;
          -webkit-print-color-adjust: exact;
        }
        .print-page {
          width: 21cm;
          min-height: 29.7cm;
          margin: 0 auto;
          background: white;
          padding: 1.5cm;
          position: relative;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        @media print {
          body { background: white; }
          .print-page { 
            box-shadow: none; 
            margin: 0;
            width: 21cm;
            height: 29.7cm;
          }
        }
        .header-logo {
          position: absolute;
          top: 1.5cm;
          right: 1.5cm;
          width: 2.2cm;
          height: 2.2cm;
          object-fit: contain;
        }
        .header-title {
          position: absolute;
          top: 2.0cm;
          left: 1.5cm;
          font-size: 16pt;
          font-weight: 900;
          color: black;
          letter-spacing: -0.02em;
          text-transform: uppercase;
        }
        .header-subtitle {
          position: absolute;
          top: 2.8cm;
          left: 1.5cm;
          font-size: 13pt;
          font-weight: 700;
          color: #3b82f6;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .meta-info {
          position: absolute;
          top: 4.2cm;
          left: 1.5cm;
          font-size: 10pt;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }
        .main-table {
          position: absolute;
          top: 6.0cm;
          left: 1.5cm;
          width: 18cm;
          border-collapse: collapse;
          border: 1.5pt solid black;
        }
        .main-table th {
          background: #f1f5f9;
          border: 1.5pt solid black;
          padding: 6px 10px;
          text-align: left;
          font-size: 9pt;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .main-table td {
          border: 1pt solid #e2e8f0;
          padding: 4px 10px;
          font-size: 9pt;
          vertical-align: middle;
          line-height: 1.1;
        }
        .col-label { width: 70%; }
        .col-value { width: 30%; text-align: right; font-family: monospace; font-weight: 700; }
        
        .row-in { color: #059669; font-weight: 800; }
        .row-out { color: #dc2626; font-weight: 800; }
        .row-sub { color: #64748b; font-style: italic; font-size: 8pt; }
        .row-final { 
          background: #f8fafc;
          border-top: 2pt solid black !important;
        }
        .final-label { font-weight: 900; text-transform: uppercase; font-size: 10pt; }
        .final-value { font-size: 14pt; font-weight: 900; }

        .footer-note {
          position: absolute;
          bottom: 1.5cm;
          left: 1.5cm;
          right: 1.5cm;
          text-align: center;
          font-size: 8pt;
          color: #94a3b8;
          font-weight: 500;
          border-top: 0.5pt solid #e2e8f0;
          padding-top: 10px;
        }
      `}</style>

      <img src="/logo-lddec.png" alt="Logo" className="header-logo" />
      
      <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
      <div className="header-subtitle">Resumen Operativo de Movimientos</div>
      
      <div className="meta-info">
        <p>Periodo: {data.from} al {data.to}</p>
        <p style={{ marginTop: '2px' }}>Generado el: {fechaGenerada}</p>
      </div>

      <table className="main-table">
        <thead>
          <tr>
            <th className="col-label">Métrica de Inventario</th>
            <th className="col-value">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="col-label">Stock Inicial (Balance al inicio del periodo)</td>
            <td className="col-value">{formatNum(data.si)}</td>
          </tr>
          <tr className="row-in">
            <td className="col-label">(+) Total Prendas Ingresadas en Planta</td>
            <td className="col-value">{formatNum(data.in)}</td>
          </tr>
          <tr className="row-out">
            <td className="col-label">(-) Total Prendas Despachadas (Salidas)</td>
            <td className="col-value">{formatNum(data.out)}</td>
          </tr>
          <tr className="row-sub">
            <td className="col-label" style={{ paddingLeft: '1cm' }}>• de las cuales facturadas</td>
            <td className="col-value">{formatNum(data.df)}</td>
          </tr>
          <tr className="row-sub">
            <td className="col-label" style={{ paddingLeft: '1cm' }}>• de las cuales sin facturar</td>
            <td className="col-value">{formatNum(data.dsf)}</td>
          </tr>
          <tr className="row-final">
            <td className="col-label final-label">Saldo Final en Bodega (Existencia Actual)</td>
            <td className="col-value final-value">{formatNum(data.sf)}</td>
          </tr>
        </tbody>
      </table>

      <div className="footer-note">
        Lógica de cálculo: Stock Inicial Base al 01/01/2026 unificado con registros multicanal (Outputs, Salidas y Muestras).
        <br />
        Este documento es para control interno administrativo de LDDEC.
      </div>
    </div>
  );
}

export default function PrintResumenPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">Cargando formato de impresión...</div>}>
      <PrintContent />
    </Suspense>
  );
}

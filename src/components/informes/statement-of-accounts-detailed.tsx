"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Copy, Check, MessageSquare, Send, User } from "lucide-react";
import { toDate } from "@/lib/toDate";
import { calculateClientAccountingMetrics } from "@/lib/accounting-motor";
import { formatClientName } from "@/lib/format-name";
import { useToast } from "@/hooks/use-toast";

interface StatementOfAccountsDetailedProps {
  client: any;
  clients?: any[];
  invoices: any[];
  payments?: any[];
  dateFrom: string;
  dateTo: string;
  onSelectClient?: (clientId: string) => void;
}

interface StatementMovement {
  id: string;
  date: Date;
  fechaStr: string;
  fullDateStr: string;
  detalle: string;
  factura: string;
  cargo: number;
  abono: number;
  saldo?: number;
  tipo: "CARGO" | "ABONO";
  timestamp: number;
  orderWeight: number;
}

export function StatementOfAccountsDetailed({
  client,
  clients = [],
  invoices = [],
  payments = [],
  dateFrom,
  dateTo,
  onSelectClient
}: StatementOfAccountsDetailedProps) {
  const { toast } = useToast();
  const [fechaGenerada, setFechaGenerada] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }));
  }, []);

  const from = useMemo(() => new Date(dateFrom + "T00:00:00"), [dateFrom]);
  const to = useMemo(() => new Date(dateTo + "T23:59:59"), [dateTo]);

  // Formato de fechas DD/MM y DD/MM/AAAA
  const formatDateDayMonth = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  };

  const formatDateFull = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatNum = (val: number): string => {
    return Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // 1. Filtrar facturas del cliente
  const clientInvoices = useMemo(() => {
    if (!client?.id) return [];
    return (invoices || []).filter(inv => {
      if (!inv) return false;
      return (
        inv.clientId === client.id ||
        inv.clienteId === client.id ||
        (client.name && inv.clientName === client.name) ||
        (client.name && inv.clienteNombre === client.name)
      );
    });
  }, [invoices, client]);

  // 2. Unificar y deduplicar pagos del cliente (tanto embebidos en facturas como en colección global y saldo inicial)
  const clientPayments = useMemo(() => {
    if (!client?.id) return [];
    const uniqueMap = new Map<string, any>();

    // Pagos embebidos en facturas
    clientInvoices.forEach(inv => {
      const movs = Array.isArray(inv.pagosYajustes)
        ? inv.pagosYajustes
        : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
      
      movs.forEach((m: any) => {
        if (!m) return;
        const isAnulado = Boolean(m.anulado) || m.estado === "anulado" || m.estado === "Anulado" || m.status === "anulado";
        if (isAnulado) return;
        const pDate = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
        const key = m.id || `${pDate?.getTime() || 0}_${m.monto}_${m.tipoTransaccion || m.tipo}_${inv.numeroFactura || inv.id}`;
        uniqueMap.set(key, {
          ...m,
          facturaId: inv.id,
          numeroFactura: inv.numeroFactura || ""
        });
      });
    });

    // Pagos globales (excluyendo saldoInicial, ya que se toma exclusivamente de client.pagosSaldoInicial)
    (payments || []).forEach((p: any) => {
      if (!p) return;
      const isAnulado = Boolean(p.anulado) || p.estado === "anulado" || p.estado === "Anulado" || p.status === "anulado";
      if (isAnulado) return;

      const isSI = p.origen === "saldoInicial" || 
                   p.facturaId === "INITIAL_BALANCE_2026" || 
                   p.numeroFactura === "SALDO INICIAL 2026" || 
                   p.tipoTransaccion === "PAGO_INICIAL";
      if (isSI) return;

      if (p.clienteId === client.id || p.clientId === client.id) {
        const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
        const key = p.id || `${pDate?.getTime() || 0}_${p.monto}_${p.tipoTransaccion || p.tipo}_${p.numeroFactura || p.facturaId || ""}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      }
    });

    // Pagos de saldo inicial registrados en el cliente (Única fuente de verdad para Saldo Inicial)
    const pagosSI = Array.isArray(client.pagosSaldoInicial) ? client.pagosSaldoInicial : [];
    pagosSI.forEach((p: any) => {
      if (!p) return;
      const isAnulado = Boolean(p.anulado) || p.estado === "anulado" || p.estado === "Anulado" || p.status === "anulado";
      if (isAnulado) return;
      const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
      const key = p.id || `SI_${pDate?.getTime() || 0}_${p.monto}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          ...p,
          tipoTransaccion: "PAGO_INICIAL",
          numeroFactura: "SALDO INICIAL 2026"
        });
      }
    });

    return Array.from(uniqueMap.values());
  }, [client, clientInvoices, payments]);

  // 3. Cálculo de métricas y Saldo Anterior usando el motor contable LDDEC
  const metrics = useMemo(() => {
    if (!client?.id) {
      return {
        saldoAnterior: 0,
        facturacion: 0,
        nd: 0,
        nc: 0,
        retencion: 0,
        cobro: 0,
        saldoActual: 0
      };
    }
    const baseDebt = Number(client.baseDebt || client.saldoInicial || 0);
    return calculateClientAccountingMetrics(
      baseDebt,
      dateFrom,
      dateTo,
      clientInvoices,
      clientPayments,
      client
    );
  }, [client, dateFrom, dateTo, clientInvoices, clientPayments]);

  const saldoAnterior = metrics.saldoAnterior;

  // 4. Construcción de movimientos cronológicos de la semana/período
  const { movementsWithBalance, totalCargos, totalAbonos, saldoFinal } = useMemo(() => {
    const movs: StatementMovement[] = [];

    // Facturas en el período (Cargos)
    clientInvoices.forEach(inv => {
      const d = toDate(inv.fechaFactura || inv.invoiceDate || inv.date || inv.createdAt);
      if (!d || d < from || d > to) return;

      const monto = Number(inv.totalFactura || inv.total || 0);
      if (monto <= 0) return;

      let detalle = "Lavado / proceso";
      if (inv.concepto && String(inv.concepto).trim()) {
        detalle = String(inv.concepto).trim();
      } else if (inv.observaciones && String(inv.observaciones).trim()) {
        detalle = String(inv.observaciones).trim();
      } else if (inv.tipoServicio && String(inv.tipoServicio).trim()) {
        detalle = String(inv.tipoServicio).trim();
      } else if (inv.totalPrendas && Number(inv.totalPrendas) > 0) {
        detalle = `Lavado / proceso (${inv.totalPrendas} prendas)`;
      } else if (inv.tipoComprobante === "Nota de Venta") {
        detalle = "Nota de Venta / Servicio";
      }

      movs.push({
        id: inv.id || String(Math.random()),
        date: d,
        fechaStr: formatDateDayMonth(d),
        fullDateStr: formatDateFull(d),
        detalle,
        factura: String(inv.numeroFactura || inv.numero || "—"),
        cargo: monto,
        abono: 0,
        tipo: "CARGO",
        timestamp: d.getTime(),
        orderWeight: 1
      });
    });

    // Pagos, abonos y notas en el período
    clientPayments.forEach(p => {
      if (!p) return;
      const isAnulado = Boolean(p.anulado) || p.estado === "anulado" || p.estado === "Anulado" || p.status === "anulado";
      if (isAnulado) return;
      const d = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
      if (!d || d < from || d > to) return;

      const monto = Number(p.monto || 0);
      if (monto <= 0) return;

      const tipo = (p.tipoTransaccion || p.tipo || "Pago").toString();
      const numFac = p.numeroFactura || "—";

      let cargo = 0;
      let abono = 0;
      let detalle = "Pago";

      if (tipo.includes("Reverso")) {
        cargo = monto;
        detalle = `Reverso de Pago ${p.descripcion ? '- ' + p.descripcion : ''}`;
      } else if (tipo.includes("Débito")) {
        cargo = monto;
        detalle = `Nota de Débito ${p.descripcion ? '- ' + p.descripcion : ''}`;
      } else if (tipo.includes("Retención")) {
        abono = monto;
        detalle = `Retención ${p.numeroRetencion ? 'No. ' + p.numeroRetencion : ''}`;
      } else if (tipo.includes("Crédito") || tipo.includes("Descuento")) {
        abono = monto;
        detalle = `Nota de Crédito / Descuento`;
      } else {
        abono = monto;
        const metodo = p.metodoPago || p.formaPago || "";
        const banco = p.banco ? ` - ${p.banco}` : "";
        if (p.descripcion && String(p.descripcion).trim()) {
          detalle = String(p.descripcion).trim();
        } else if (metodo) {
          detalle = `Pago (${metodo}${banco})`;
        } else {
          detalle = "Pago";
        }
      }

      movs.push({
        id: p.id || String(Math.random()),
        date: d,
        fechaStr: formatDateDayMonth(d),
        fullDateStr: formatDateFull(d),
        detalle,
        factura: numFac,
        cargo,
        abono,
        tipo: cargo > 0 ? "CARGO" : "ABONO",
        timestamp: d.getTime(),
        orderWeight: cargo > 0 ? 1 : 2
      });
    });

    // Ordenamiento cronológico: día primero, luego cargos antes de abonos
    movs.sort((a, b) => {
      const timeDiff = a.timestamp - b.timestamp;
      if (timeDiff !== 0) return timeDiff;
      return a.orderWeight - b.orderWeight;
    });

    // Cálculo secuencial del saldo correlativo
    let running = saldoAnterior;
    const withBalance = movs.map(m => {
      running = running + m.cargo - m.abono;
      return {
        ...m,
        saldo: running
      };
    });

    const sumCargos = movs.reduce((acc, m) => acc + m.cargo, 0);
    const sumAbonos = movs.reduce((acc, m) => acc + m.abono, 0);
    const finalBalance = saldoAnterior + sumCargos - sumAbonos;

    return {
      movementsWithBalance: withBalance,
      totalCargos: sumCargos,
      totalAbonos: sumAbonos,
      saldoFinal: finalBalance
    };
  }, [clientInvoices, clientPayments, from, to, saldoAnterior]);

  // Fecha del saldo anterior (día previo al inicio de semana o período)
  const prevDateStr = useMemo(() => {
    const prevDate = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    return formatDateDayMonth(prevDate);
  }, [from]);

  const semanaRangoStr = useMemo(() => {
    return `${formatDateFull(from)} – ${formatDateFull(to)}`;
  }, [from, to]);

  const clientDisplayName = useMemo(() => {
    if (!client) return "SELECCIONE CLIENTE";
    return formatClientName(client.name || client.clienteNombre, client.firstName, client.lastName);
  }, [client]);

  // Generador de texto para compartir por WhatsApp
  const generateWhatsAppMessage = () => {
    let msg = `*ESTADO DE CUENTA SEMANAL*\n`;
    msg += `*Cliente:* ${clientDisplayName}\n`;
    msg += `*Semana:* ${semanaRangoStr}\n`;
    msg += `------------------------------------\n`;
    msg += `*Saldo anterior:* $${formatNum(saldoAnterior)}\n`;
    msg += `*Facturado esta semana:* $${formatNum(totalCargos)}\n`;
    msg += `*Cobrado esta semana:* $${formatNum(totalAbonos)}\n`;
    msg += `*SALDO FINAL:* $${formatNum(saldoFinal)}\n`;
    msg += `------------------------------------\n`;
    msg += `*Detalle de Movimientos:*\n`;
    msg += `• ${prevDateStr} - Saldo anterior: $${formatNum(saldoAnterior)}\n`;

    if (movementsWithBalance.length === 0) {
      msg += `• Sin movimientos registrados en el período.\n`;
    } else {
      movementsWithBalance.forEach(m => {
        if (m.cargo > 0) {
          msg += `• ${m.fechaStr} - ${m.detalle} (Fac: ${m.factura}): Cargo +$${formatNum(m.cargo)} | Saldo: $${formatNum(m.saldo || 0)}\n`;
        } else {
          msg += `• ${m.fechaStr} - ${m.detalle}: Abono -$${formatNum(m.abono)} | Saldo: $${formatNum(m.saldo || 0)}\n`;
        }
      });
    }

    msg += `------------------------------------\n`;
    msg += `*Laboratorio del Denim Ecuador - LDDEC Cía. Ltda.*`;
    return msg;
  };

  const handleCopyWhatsApp = async () => {
    try {
      const text = generateWhatsAppMessage();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "¡Copiado al Portapapeles!",
        description: "El resumen de estado de cuenta está listo para pegarse en WhatsApp."
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al copiar",
        description: "No se pudo acceder al portapapeles."
      });
    }
  };

  const handleSendWhatsApp = () => {
    const rawPhone = client?.phone || client?.telefono || "";
    let cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "593" + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9 && !cleanPhone.startsWith("593")) {
      cleanPhone = "593" + cleanPhone;
    }

    const text = encodeURIComponent(generateWhatsAppMessage());
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    
    window.open(url, "_blank");
  };

  if (!client?.id) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-zinc-200 shadow-md text-center space-y-4">
        <User className="h-12 w-12 text-zinc-400 mx-auto" />
        <h3 className="text-lg font-bold text-zinc-800 uppercase">Seleccione un Socio Industrial</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Para ver el Estado de Cuenta Semanal con formato de hoja de deudas, elija un cliente en el selector.
        </p>
        {clients.length > 0 && onSelectClient && (
          <div className="max-w-xs mx-auto pt-2">
            <Select onValueChange={(val) => onSelectClient(val)}>
              <SelectTrigger className="erp-input h-11 font-bold">
                <SelectValue placeholder="Seleccionar Socio..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c.name || c.nombre || "").toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <style jsx global>{`
        #weekly-statement-print {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          color: #000000 !important;
          background: #ffffff !important;
        }
        #weekly-statement-print table {
          border-collapse: collapse !important;
          width: 100% !important;
          font-variant-numeric: tabular-nums !important;
        }
        #weekly-statement-print th, 
        #weekly-statement-print td {
          font-variant-numeric: tabular-nums !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-hidden, .print\\:hidden {
            display: none !important;
          }
          #weekly-statement-print {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          table {
            border: 1.5pt solid black !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          th {
            border: 1pt solid black !important;
            background: #f4f4f5 !important;
            color: black !important;
            font-weight: 700 !important;
            padding: 5px 6px !important;
            font-size: 8.5pt !important;
          }
          td {
            border: 0.75pt solid black !important;
            color: black !important;
            padding: 5px 6px !important;
            font-size: 8.5pt !important;
          }
        }
      `}</style>

      {/* BARRA DE HERRAMIENTAS Y ACCIONES (OCULTA AL IMPRIMIR) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          {clients.length > 0 && onSelectClient && (
            <div className="w-[260px]">
              <Select value={client.id} onValueChange={(val) => onSelectClient(val)}>
                <SelectTrigger className="h-10 text-xs font-bold bg-zinc-50 border-zinc-300">
                  <SelectValue placeholder="Cambiar Cliente" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs font-bold">
                      {(c.name || c.nombre || "").toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCopyWhatsApp}
            className="h-10 px-4 text-xs font-bold gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "¡Copiado!" : "Copiar para WhatsApp"}
          </Button>

          <Button
            variant="outline"
            onClick={handleSendWhatsApp}
            className="h-10 px-4 text-xs font-bold gap-2 bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-sm"
          >
            <Send className="h-4 w-4" />
            Enviar WhatsApp
          </Button>

          <Button
            onClick={() => window.print()}
            className="h-10 px-5 text-xs font-bold gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-md"
          >
            <Printer className="h-4 w-4" />
            Imprimir Hoja de Cuenta
          </Button>
        </div>
      </div>

      {/* DOCUMENTO PRINCIPAL: ESTADO DE CUENTA SEMANAL (FORMATO HOJA DE DEUDAS) */}
      <div
        id="weekly-statement-print"
        className="bg-white p-6 sm:p-8 rounded-xl border border-zinc-300 shadow-sm print:border-none print:shadow-none print:p-0 text-black tabular-nums"
      >
        {/* ENCABEZADO DE EMPRESA Y TÍTULO */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h1 className="text-base sm:text-lg font-black tracking-tight uppercase leading-tight">
                LABORATORIO DEL DENIM ECUADOR LDDEC CÍA. LTDA.
              </h1>
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-zinc-900">
                ESTADO DE CUENTA SEMANAL
              </h2>
            </div>
            <div className="text-right text-[11px] font-medium text-zinc-700 space-y-0.5">
              <p><span className="font-bold">Fecha Gen:</span> {fechaGenerada}</p>
              <p><span className="font-bold">Página:</span> 1 de 1</p>
            </div>
          </div>

          {/* DATOS DEL CLIENTE Y SEMANA */}
          <div className="mt-4 pt-3 border-t border-zinc-300 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-sm font-black uppercase text-black">
                <span className="text-zinc-600 font-bold">Cliente:</span> {clientDisplayName}
              </p>
              {client.ruc && (
                <p className="text-[11px] text-zinc-700">
                  <span className="font-bold">RUC / C.I.:</span> {client.ruc}
                </p>
              )}
              {client.phone && (
                <p className="text-[11px] text-zinc-700">
                  <span className="font-bold">Teléfono:</span> {client.phone}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm font-black text-black">
                <span className="text-zinc-600 font-bold">Semana:</span> {semanaRangoStr}
              </p>
              <p className="text-[11px] text-zinc-700">
                <span className="font-bold">Zona:</span> {client?.zona || "GENERAL"}
              </p>
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL: FECHA | DETALLE | FACTURA | CARGO | ABONO | SALDO */}
        <div className="border border-black overflow-hidden bg-white mb-6">
          <Table className="border-collapse w-full text-xs">
            <TableHeader>
              <TableRow className="bg-zinc-100 hover:bg-zinc-100 border-b border-black">
                <TableHead className="w-[75px] h-9 text-black font-extrabold text-[11px] uppercase border-r border-black text-center p-2">
                  Fecha
                </TableHead>
                <TableHead className="h-9 text-black font-extrabold text-[11px] uppercase border-r border-black p-2">
                  Detalle
                </TableHead>
                <TableHead className="w-[140px] h-9 text-black font-extrabold text-[11px] uppercase border-r border-black text-center p-2">
                  Factura
                </TableHead>
                <TableHead className="w-[105px] h-9 text-black font-extrabold text-[11px] uppercase border-r border-black text-right p-2">
                  Cargo
                </TableHead>
                <TableHead className="w-[105px] h-9 text-black font-extrabold text-[11px] uppercase border-r border-black text-right p-2">
                  Abono
                </TableHead>
                <TableHead className="w-[115px] h-9 text-black font-extrabold text-[11px] uppercase text-right p-2">
                  Saldo
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* FILA INICIAL: SALDO ANTERIOR */}
              <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70 border-b border-black font-semibold">
                <TableCell className="p-2 border-r border-black text-center text-zinc-800">
                  {prevDateStr}
                </TableCell>
                <TableCell className="p-2 border-r border-black font-bold uppercase text-zinc-900">
                  Saldo anterior
                </TableCell>
                <TableCell className="p-2 border-r border-black text-center text-zinc-400">
                  —
                </TableCell>
                <TableCell className="p-2 border-r border-black text-right text-zinc-400">
                  —
                </TableCell>
                <TableCell className="p-2 border-r border-black text-right text-zinc-400">
                  —
                </TableCell>
                <TableCell className="p-2 text-right font-black text-black">
                  ${formatNum(saldoAnterior)}
                </TableCell>
              </TableRow>

              {/* MOVIMIENTOS CRONOLÓGICOS DE LA SEMANA */}
              {movementsWithBalance.map((m, idx) => (
                <TableRow key={idx} className="hover:bg-zinc-50 border-b border-black last:border-0">
                  <TableCell className="p-2 border-r border-black text-center text-zinc-800 font-medium">
                    {m.fechaStr}
                  </TableCell>
                  <TableCell className="p-2 border-r border-black text-black font-medium">
                    {m.detalle}
                  </TableCell>
                  <TableCell className="p-2 border-r border-black text-center font-mono text-[11px] text-zinc-800">
                    {m.factura}
                  </TableCell>
                  <TableCell className="p-2 border-r border-black text-right font-bold text-zinc-900">
                    {m.cargo > 0 ? `$${formatNum(m.cargo)}` : "—"}
                  </TableCell>
                  <TableCell className="p-2 border-r border-black text-right font-bold text-emerald-800">
                    {m.abono > 0 ? `$${formatNum(m.abono)}` : "—"}
                  </TableCell>
                  <TableCell className="p-2 text-right font-black text-black">
                    ${formatNum(m.saldo || 0)}
                  </TableCell>
                </TableRow>
              ))}

              {/* EN CASO DE NO HABER MOVIMIENTOS */}
              {movementsWithBalance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-xs italic text-zinc-500 bg-white">
                    Sin movimientos registrados en esta semana o período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* RESUMEN DE LA SEMANA (AL FINAL) */}
        <div className="flex justify-end pt-2">
          <div className="w-full sm:w-[360px] border-2 border-black p-4 space-y-2.5 text-xs bg-zinc-50/50">
            <h3 className="font-black text-sm uppercase tracking-wide border-b-2 border-black pb-1.5 text-black">
              RESUMEN DE LA SEMANA
            </h3>
            
            <div className="flex justify-between items-center text-zinc-800 font-medium">
              <span>Saldo anterior:</span>
              <span className="font-bold font-mono text-[13px]">${formatNum(saldoAnterior)}</span>
            </div>

            <div className="flex justify-between items-center text-zinc-800 font-medium">
              <span>Facturado esta semana:</span>
              <span className="font-bold font-mono text-[13px] text-zinc-900">${formatNum(totalCargos)}</span>
            </div>

            <div className="flex justify-between items-center text-zinc-800 font-medium">
              <span>Cobrado esta semana:</span>
              <span className="font-bold font-mono text-[13px] text-emerald-800">${formatNum(totalAbonos)}</span>
            </div>

            <div className="flex justify-between items-center border-t-2 border-black pt-2 text-black">
              <span className="font-black uppercase text-sm">Saldo final:</span>
              <span className="font-black font-mono text-base text-black">
                ${formatNum(saldoFinal)}
              </span>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE FIRMAS PARA IMPRESIÓN FÍSICA */}
        <div className="mt-16 pt-4 grid grid-cols-3 gap-6 text-[10px] font-bold uppercase text-center text-black">
          <div>
            <div className="border-t border-black pt-1 mx-2">Elaborado por</div>
            <p className="text-[9px] font-normal text-zinc-500 mt-0.5">LDDEC Contabilidad</p>
          </div>
          <div>
            <div className="border-t border-black pt-1 mx-2">Revisado por</div>
            <p className="text-[9px] font-normal text-zinc-500 mt-0.5">Administración</p>
          </div>
          <div>
            <div className="border-t border-black pt-1 mx-2">Recibí Conforme</div>
            <p className="text-[9px] font-normal text-zinc-500 mt-0.5">Firma del Cliente</p>
          </div>
        </div>
      </div>
    </div>
  );
}

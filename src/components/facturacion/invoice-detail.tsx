"use client";

import React from "react";
import { Invoice } from "@/types/invoice";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Receipt, 
  Calendar, 
  Building2, 
  Shirt, 
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Info
} from "lucide-react";

interface InvoiceDetailProps {
  invoice: Invoice;
}

// Mapeo unificado con soporte para estadoCobranza (LDDEC 1.1) y status (Legacy)
const statusMap: Record<string, { label: string, icon: any, color: string }> = {
  "Por Cobrar": { label: "Por Cobrar", icon: AlertCircle, color: "text-amber-600 bg-amber-500/10" },
  "Parcialmente Cobrada": { label: "Cobro Parcial", icon: TrendingDown, color: "text-blue-600 bg-blue-500/10" },
  "Pagada": { label: "Pagada", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10" },
  "draft": { label: "Borrador", icon: Clock, color: "text-zinc-500 bg-zinc-500/10" },
  "issued": { label: "Emitida", icon: AlertCircle, color: "text-blue-500 bg-blue-500/10" },
  "paid": { label: "Pagada", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
};

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  // Resolución segura del estado visual
  const statusKey = invoice.estadoCobranza || invoice.status || "draft";
  const statusConfig = statusMap[statusKey] || { 
    label: statusKey, 
    icon: Info, 
    color: "text-zinc-500 bg-zinc-500/10" 
  };
  
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Premium Header Card */}
      <div className="bg-card p-10 rounded-[2.5rem] border border-muted/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
          <Receipt className="h-32 w-32" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-600/30">
                <Receipt className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-foreground">{invoice.numeroFactura || invoice.invoiceNumber}</h2>
                <Badge className={`rounded-full px-4 py-1 mt-2 font-bold text-[10px] uppercase tracking-widest border-none ${statusConfig.color}`}>
                  <StatusIcon className="h-3 w-3 mr-2" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-10">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Socio Estratégico</p>
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  {invoice.clientName || invoice.clienteNombre}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Vencimiento</p>
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  {invoice.dueDate || "N/A"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600/5 p-8 rounded-3xl border border-emerald-600/10 min-w-[250px] text-right">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total a Pagar</p>
            <p className="text-5xl font-black text-emerald-600 tracking-tighter">${(invoice.totalFactura || invoice.total || 0).toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-emerald-600/10 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-widest">Saldo Pend.</span>
              <span className="font-black text-amber-600">${(invoice.saldoPendiente !== undefined ? invoice.saldoPendiente : (invoice.balancePending || 0)).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
{/* Salidas / Guías Asociadas – control visual */}
<div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6 shadow-sm">
  <label className="block text-sm font-black uppercase text-blue-600 mb-2">Salidas / Guías Asociadas</label>
  <textarea
    readOnly
    value={invoice.numeroSalida || "No se registraron guías asociadas a esta factura."}
    placeholder="Registre aquí las guías o salidas vinculadas a esta factura..."
    className="w-full min-h-[80px] p-3 rounded-lg border border-blue-200 focus:outline-none bg-white text-sm font-bold text-slate-700 resize-none"
  />
</div>
      {/* Items Section */}
      <div className="space-y-6 px-4">
        <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
          Resumen de Conceptos
          <span className="text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-1 rounded-full uppercase tracking-widest">
            {invoice.lotesIncluidos?.length || invoice.items?.length || 0} ítems
          </span>
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {invoice.items ? (
            invoice.items.map((item) => (
              <div key={item.id} className="bg-card rounded-2xl p-6 border border-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all group">
                <div className="flex items-center gap-4 min-w-[350px]">
                  <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground group-hover:bg-emerald-600/10 group-hover:text-emerald-600 transition-colors">
                    <Shirt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold">{item.lotNumber}</h4>
                      <Badge variant="outline" className="text-[9px] font-black border-none bg-muted/50 uppercase">Guía: {item.outputNumber}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{item.garmentType} • {item.process}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-12 flex-1 max-w-lg">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Cant. Facturada</p>
                    <p className="font-black text-foreground">{item.quantityToInvoice}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">P. Unitario</p>
                    <p className="font-bold text-foreground/70">${item.unitPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Item</p>
                    <p className="font-black text-emerald-600">${item.lineTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-muted/10 rounded-2xl p-8 border border-dashed border-muted/30 text-center">
              <p className="text-sm font-medium text-muted-foreground">Lotes facturados: {invoice.lotesIncluidos?.join(", ") || "No especificados"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Financial Breakdown */}
      <div className="flex flex-col md:flex-row gap-6 px-4 pb-10">
        <div className="flex-1 bg-accent/5 p-8 rounded-[2rem] border border-accent/10">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notas del Comprobante
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium">
            {invoice.notes || "Sin observaciones adicionales registradas."}
          </p>
        </div>

        <div className="w-full md:w-[350px] space-y-3 p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Subtotal Bruto</span>
            <span className="font-bold">${(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Impuestos (IVA)</span>
            <span className="font-bold">+${(invoice.iva || invoice.tax || 0).toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-black uppercase tracking-widest">Total Final</span>
            <span className="text-2xl font-black text-emerald-600">${(invoice.totalFactura || invoice.total || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

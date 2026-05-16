"use client";

import React from "react";
import { Collection } from "@/types/collection";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Wallet, 
  Calendar, 
  Building2, 
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  User,
  Truck
} from "lucide-react";

interface CollectionDetailProps {
  collection: Collection;
}

const statusMap = {
  draft: { label: "Borrador", icon: Clock, color: "text-zinc-500 bg-zinc-500/10" },
  applied: { label: "Aplicada", icon: AlertCircle, color: "text-blue-500 bg-blue-500/10" },
  partial: { label: "Parcial", icon: TrendingDown, color: "text-amber-500 bg-amber-500/10" },
  completed: { label: "Completada", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
};

export function CollectionDetail({ collection }: CollectionDetailProps) {
  const StatusIcon = statusMap[collection.status].icon;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Info */}
      <div className="bg-card p-10 rounded-[3rem] border border-muted/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
          <Wallet className="h-32 w-32" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-amber-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
                <Wallet className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-foreground">{collection.collectionNumber}</h2>
                <Badge className={`rounded-full px-4 py-1 mt-2 font-bold text-[10px] uppercase tracking-widest ${statusMap[collection.status].color}`}>
                  <StatusIcon className="h-3 w-3 mr-2" />
                  {statusMap[collection.status].label}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Socio</p>
                <div className="flex items-center gap-2 font-bold">
                  <Building2 className="h-4 w-4 text-amber-600" />
                  {collection.clientName}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha</p>
                <div className="flex items-center gap-2 font-bold">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  {collection.collectionDate}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Método Pago</p>
                <div className="flex items-center gap-2 font-bold">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                  {collection.paymentMethod}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Responsable</p>
                <div className="flex items-center gap-2 font-bold">
                  <User className="h-4 w-4 text-amber-600" />
                  {collection.responsible}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600/5 p-8 rounded-[2.5rem] border border-emerald-600/10 min-w-[280px] text-right">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Aplicado</p>
            <p className="text-5xl font-black text-emerald-600 tracking-tighter">${collection.totalApplied.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-emerald-600/10 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-widest">Efectivo Recibido</span>
              <span className="font-black text-foreground">${collection.totalReceived.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Summary */}
      <div className="space-y-6 px-4">
        <h3 className="text-xl font-black tracking-tight">Desglose de Facturas Aplicadas</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {collection.items.map((item) => (
            <div key={item.id} className="bg-card rounded-3xl p-8 border border-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-8 hover:shadow-md transition-all">
              <div className="flex items-center gap-4 min-w-[250px]">
                <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">{item.invoiceNumber}</h4>
                  <p className="text-xs text-muted-foreground font-medium">Facturado: {item.invoiceDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1 max-w-2xl">
                <div className="text-center">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Abonado</p>
                  <p className="font-black text-foreground">${item.amountReceived.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Descuentos</p>
                  <p className="font-bold text-amber-600">${(item.discount + item.promptPaymentDiscount + item.damagedDiscount).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Aplicado</p>
                  <p className="font-black text-emerald-600">${item.totalApplied.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Nuevo Saldo</p>
                  <p className={`font-black ${item.remainingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    ${item.remainingBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Summary Table */}
      <div className="flex flex-col md:flex-row gap-10 px-4 pb-10">
        <div className="flex-1 bg-accent/5 p-10 rounded-[3rem] border border-accent/10">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-6 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Observaciones de Tesorería
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium italic">
            {collection.notes || "Sin observaciones adicionales registradas en este cobro."}
          </p>
        </div>

        <div className="w-full md:w-[400px] space-y-4 p-6 bg-muted/10 rounded-[2.5rem]">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Efectivo Recibido</span>
            <span className="font-bold text-lg">${collection.totalReceived.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Pronto Pago</span>
            <span className="font-bold text-amber-600">${collection.totalPromptPaymentDiscount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Retenciones</span>
            <span className="font-bold text-amber-600">${collection.totalRetention.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Dcto. Prendas Dañadas</span>
            <span className="font-bold text-destructive">${collection.totalDamagedDiscount.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-black uppercase tracking-widest">Total Aplicado</span>
            <span className="text-3xl font-black text-emerald-600">${collection.totalApplied.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-muted/20">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Remanente</span>
            <span className="font-black text-amber-600">${collection.totalRemaining.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

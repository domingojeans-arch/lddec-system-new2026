
"use client";

import React from "react";
import { MetricCard } from "./metric-card";
import { 
  Users, 
  ArrowDownCircle, 
  Shirt, 
  ArrowUpCircle, 
  Receipt, 
  Wallet, 
  Zap, 
  Beaker,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  LayoutDashboard
} from "lucide-react";
import { OperationalMetrics } from "@/types/reports";
import { formatCurrency } from "@/lib/reports-helpers";
import { Button } from "@/components/ui/button";

interface OperationalSummaryProps {
  metrics: OperationalMetrics;
}

export function OperationalSummary({ metrics }: OperationalSummaryProps) {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Dashboard General</h3>
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl gap-2 shadow-lg">
          <Printer className="h-4 w-4" /> Imprimir Dashboard
        </Button>
      </div>

      <div className="hidden print:block text-center mb-10 space-y-2">
        <img 
          src="/logo-lddec.png" 
          alt="Logo" 
          style={{ width: '2.5cm', height: '2.5cm', objectFit: 'contain', margin: '0 auto 10px auto', display: 'block' }} 
        />
        <h1 className="text-2xl font-black uppercase text-black">LAVANDERÍA DE DECORACIONES (LDDEC)</h1>
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN EJECUTIVO DE OPERACIONES</h2>
      </div>

      {/* Principal KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Directorio de Socios" 
          value={metrics.totalClients} 
          subtitle="Entidades Activas" 
          icon={Users} 
          color="text-primary"
        />
        <MetricCard 
          title="Flujo de Ingresos" 
          value={metrics.totalEntries} 
          subtitle={`${metrics.totalGarmentsIn} prendas totales`} 
          icon={ArrowDownCircle} 
          color="text-accent"
        />
        <MetricCard 
          title="Efectividad Despacho" 
          value={`${((metrics.totalGarmentsOut / (metrics.totalGarmentsIn || 1)) * 100).toFixed(1)}%`} 
          subtitle={`${metrics.totalGarmentsOut} prendas enviadas`} 
          icon={ArrowUpCircle} 
          color="text-emerald-600"
        />
        <MetricCard 
          title="Prendas en Planta" 
          value={metrics.totalPendingOut} 
          subtitle="Saldo pendiente de salida" 
          icon={Shirt} 
          color="text-amber-600"
        />
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Volumen Facturado" 
          value={formatCurrency(metrics.totalInvoiced)} 
          subtitle="Ventas registradas" 
          icon={Receipt} 
          className="bg-emerald-500/5 border border-emerald-500/10"
          color="text-emerald-700"
        />
        <MetricCard 
          title="Recaudación Lograda" 
          value={formatCurrency(metrics.totalCollected)} 
          subtitle={`${((metrics.totalCollected / (metrics.totalInvoiced || 1)) * 100).toFixed(1)}% de efectividad`} 
          icon={Wallet} 
          className="bg-primary/5 border border-primary/10"
          color="text-primary"
        />
        <MetricCard 
          title="Cuentas por Cobrar" 
          value={formatCurrency(metrics.totalPendingCollection)} 
          subtitle="Balance de cartera" 
          icon={AlertTriangle} 
          className="bg-amber-500/5 border border-amber-500/10"
          color="text-amber-700"
        />
      </div>

      {/* Production & Costs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Lotes en Proceso" 
          value={metrics.productionLots.inProcess} 
          subtitle="Producción activa" 
          icon={Clock} 
          color="text-blue-600"
        />
        <MetricCard 
          title="Lotes Revisados" 
          value={metrics.productionLots.ready} 
          subtitle="Control de calidad OK" 
          icon={CheckCircle2} 
          color="text-emerald-600"
        />
        <MetricCard 
          title="Costos Especiales" 
          value={formatCurrency(metrics.manualWorks.totalCost)} 
          subtitle={`${metrics.manualWorks.totalJobs} manualidades`} 
          icon={Zap} 
          color="text-accent"
        />
        <MetricCard 
          title="Costo Químico" 
          value={formatCurrency(metrics.chemicals.totalConsumptionCost)} 
          subtitle="Inversión en insumos" 
          icon={Beaker} 
          color="text-indigo-600"
        />
      </div>
    </div>
  );
}


"use client";

import React, { useState, useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Receipt, 
  Wallet, 
  LayoutDashboard, 
  Shirt, 
  Zap, 
  Beaker 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockClients } from "@/data/mock-clients";
import { mockEntries } from "@/data/mock-entries";
import { mockOutputs } from "@/data/mock-outputs";
import { mockInvoices } from "@/data/mock-invoices";
import { mockCollections } from "@/data/mock-collections";
import { mockManualWorks } from "@/data/mock-manual-works";
import { mockChemicals } from "@/data/mock-chemicals";
import { mockChemicalRecipes } from "@/data/mock-chemical-recipes";
import { calculateOperationalMetrics, filterByRange } from "@/lib/reports-helpers";
import { ReportFilters } from "@/types/reports";

import { OperationalSummary } from "@/components/informes/operational-summary";
import { EntriesReport } from "@/components/informes/entries-report";
import { OutputsReport } from "@/components/informes/outputs-report";
import { InvoicesReport } from "@/components/informes/invoices-report";
import { CollectionsReport } from "@/components/informes/collections-report";
import { ProductionReport } from "@/components/informes/production-report";
import { ManualWorksReport } from "@/components/informes/manual-works-report";
import { ChemicalsReport } from "@/components/informes/chemicals-report";
import { ReportsFilters } from "@/components/informes/reports-filters";

export default function ResumenesPage() {
  const [activeTab, setActiveTab] = useState("resumen");
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: "",
    dateTo: "",
    clientId: "",
    status: "all"
  });

  const handleFilterChange = (newFilters: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", clientId: "", status: "all" });
  };

  // Process filtered data
  const filteredData = useMemo(() => {
    const applyCommonFilters = (items: any[]) => {
      let filtered = items;
      if (filters.clientId) {
        filtered = filtered.filter((item: any) => item.clientId === filters.clientId);
      }
      return filterByRange(filtered, filters.dateFrom, filters.dateTo);
    };

    return {
      entries: applyCommonFilters(mockEntries),
      outputs: applyCommonFilters(mockOutputs),
      invoices: applyCommonFilters(mockInvoices),
      collections: applyCommonFilters(mockCollections),
      manualWorks: applyCommonFilters(mockManualWorks),
      chemicals: mockChemicals, // Inventory usually isn't date filtered same way
      recipes: applyCommonFilters(mockChemicalRecipes)
    };
  }, [filters]);

  const metrics = useMemo(() => {
    return calculateOperationalMetrics(
      mockClients,
      filteredData.entries,
      filteredData.outputs,
      filteredData.invoices,
      filteredData.collections,
      filteredData.manualWorks,
      filteredData.chemicals,
      filteredData.recipes
    );
  }, [filteredData]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-accent font-black text-[10px] uppercase tracking-[0.3em] mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Business Intelligence
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">
            Resúmenes Analíticos
          </h1>
          <p className="text-muted-foreground text-base max-w-xl leading-relaxed font-medium">
            Visualización avanzada de métricas clave y rendimiento operativo de DenimLab.
          </p>
        </div>
      </div>

      <ReportsFilters 
        filters={filters} 
        onChange={handleFilterChange} 
        onClear={clearFilters} 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 border border-muted/20">
          {[
            { id: "resumen", label: "Dashboard", icon: LayoutDashboard },
            { id: "ingresos", label: "Ingresos", icon: ArrowDownCircle },
            { id: "salidas", label: "Salidas", icon: ArrowUpCircle },
            { id: "facturacion", label: "Facturas", icon: Receipt },
            { id: "cobranzas", label: "Cobros", icon: Wallet },
            { id: "produccion", label: "Producción", icon: Shirt },
            { id: "manualidades", label: "Manualidades", icon: Zap },
            { id: "quimicos", label: "Químicos", icon: Beaker },
          ].map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="rounded-xl px-5 py-2.5 font-bold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md transition-all"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-10">
          <TabsContent value="resumen">
            <OperationalSummary metrics={metrics} />
          </TabsContent>
          <TabsContent value="ingresos">
            <EntriesReport entries={filteredData.entries} />
          </TabsContent>
          <TabsContent value="salidas">
            <OutputsReport outputs={filteredData.outputs} />
          </TabsContent>
          <TabsContent value="facturacion">
            <InvoicesReport invoices={filteredData.invoices} />
          </TabsContent>
          <TabsContent value="cobranzas">
            <CollectionsReport collections={filteredData.collections} />
          </TabsContent>
          <TabsContent value="produccion">
            <ProductionReport entries={filteredData.entries} />
          </TabsContent>
          <TabsContent value="manualidades">
            <ManualWorksReport works={filteredData.manualWorks} />
          </TabsContent>
          <TabsContent value="quimicos">
            <ChemicalsReport chemicals={filteredData.chemicals} recipes={filteredData.recipes} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

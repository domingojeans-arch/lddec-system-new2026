import { Entry } from "@/types/entry";
import { Output } from "@/types/output";
import { Invoice } from "@/types/invoice";
import { Collection } from "@/types/collection";
import { ManualWork } from "@/types/manual-work";
import { Chemical, ChemicalRecipe } from "@/types/chemical";
import { Client } from "@/types/client";
import { toDate } from "./toDate";

export const calculateOperationalMetrics = (
  clients: Client[],
  entries: Entry[],
  outputs: Output[],
  invoices: Invoice[],
  collections: Collection[],
  manualWorks: ManualWork[],
  chemicals: Chemical[],
  recipes: ChemicalRecipe[]
) => {
  const totalGarmentsIn = entries.reduce((acc, curr) => acc + curr.totalGarments, 0);
  const totalGarmentsOut = outputs.reduce((acc, curr) => acc + curr.totalDispatched, 0);
  const totalInvoiced = invoices.reduce((acc, curr) => acc + curr.total, 0);
  const totalCollected = collections.reduce((acc, curr) => acc + curr.totalReceived, 0);
  
  // Production stats from Entry Lots
  const allLots = entries.flatMap(e => e.lots);
  const productionLots = {
    pending: allLots.filter(l => l.status === 'pending').length,
    inProcess: allLots.filter(l => l.status === 'in_process').length,
    ready: allLots.filter(l => l.status === 'ready').length,
  };

  const manualWorksCost = manualWorks.reduce((acc, curr) => acc + curr.totalCost, 0);
  const chemicalConsumptionCost = recipes.reduce((acc, curr) => acc + curr.totalChemicalCost, 0);
  const totalStockKg = chemicals.reduce((acc, curr) => acc + curr.currentStockKg, 0);

  return {
    totalClients: clients.length,
    totalEntries: entries.length,
    totalGarmentsIn,
    totalOutputs: outputs.length,
    totalGarmentsOut,
    totalPendingOut: totalGarmentsIn - totalGarmentsOut,
    totalInvoiced,
    totalCollected,
    totalPendingCollection: totalInvoiced - totalCollected,
    productionLots,
    manualWorks: {
      totalJobs: manualWorks.length,
      totalCost: manualWorksCost
    },
    chemicals: {
      totalStockKg,
      totalConsumptionCost: chemicalConsumptionCost
    }
  };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export const filterByRange = <T extends { createdAt?: any; entryDate?: string; outputDate?: string; invoiceDate?: string; collectionDate?: string; workDate?: string; purchaseDate?: string; recipeDate?: string; fecha?: any; fechaStr?: string }>(
  items: T[],
  from: string,
  to: string
) => {
  if (!from || !to) return items;
  const fromDate = new Date(from + "T00:00:00");
  const toDateObj = new Date(to + "T23:59:59");

  return items.filter(item => {
    const rawDate = (item as any).fecha || (item as any).fechaStr || item.entryDate || item.outputDate || item.invoiceDate || item.collectionDate || item.workDate || item.purchaseDate || item.recipeDate || item.createdAt;
    if (!rawDate) return true;
    const itemDate = toDate(rawDate);
    return itemDate && itemDate >= fromDate && itemDate <= toDateObj;
  });
};

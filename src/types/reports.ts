export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  status: string;
  responsibleId?: string;
  process?: string;
}

export interface OperationalMetrics {
  totalClients: number;
  totalEntries: number;
  totalGarmentsIn: number;
  totalOutputs: number;
  totalGarmentsOut: number;
  totalPendingOut: number;
  totalInvoiced: number;
  totalCollected: number;
  totalPendingCollection: number;
  productionLots: {
    pending: number;
    inProcess: number;
    ready: number;
  };
  manualWorks: {
    totalJobs: number;
    totalCost: number;
  };
  chemicals: {
    totalStockKg: number;
    totalConsumptionCost: number;
  };
}

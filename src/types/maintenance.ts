
export type SystemRole = 
  | "ADMINISTRADOR" 
  | "BODEGUERO" 
  | "PRODUCCION" 
  | "CHOFER" 
  | "CONTADOR" 
  | "BANCO" 
  | "FACTURACION" 
  | "OPERARIO MANUALIDADES" 
  | "SOCIO" 
  | "EQUIPO LDDEC";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  position: string;
  role: SystemRole;
  isActive: boolean;
}

export interface ProductionSettings {
  avgDeliveryDays: number;
  alertDaysLimit: number;
  weeklyQuota: number;
}

export interface ManualTariff {
  id: string;
  processName: string;
  adultPrice: number;
  childPrice: number;
  isActive: boolean;
}

export interface GarmentCatalogItem {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ProcessCatalogItem {
  id: string;
  name: string;
  isActive: boolean;
}

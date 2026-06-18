export type ClientStatus = 'active' | 'inactive';
export type ClientClassification = 'nacional' | 'socio' | 'especial' | 'moroso';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  name: string; // Concatenado para compatibilidad
  classification: ClientClassification;
  idNumber: string;
  noId: boolean;
  baseDebt: number;
  openingDate: string;
  phone: string;
  email: string;
  address: string;
  status: ClientStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  // Legacy fields for backward compatibility
  code?: string;
  contactName?: string;
  sinceYear?: number;
  nombre?: string;
}

export type ClientInput = Omit<Client, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'createdBy'>;

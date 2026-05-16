export type ManualWorkStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'cancelled';

export type ManualWorkTypeId = 
  | 'whiskers' 
  | 'sanding' 
  | 'ripping' 
  | 'repair' 
  | 'patching' 
  | 'ironing' 
  | 'embroidery' 
  | 'labeling' 
  | 'special_finish';

export interface ManualWorkType {
  id: ManualWorkTypeId;
  label: string;
  icon: string;
}

export interface ManualWork {
  id: string;
  entryId: string;
  entryNumber: string;
  lotId: string;
  lotNumber: string;
  clientId: string;
  clientName: string;
  garmentType: string;
  process: string;
  manualWorkType: ManualWorkTypeId;
  quantity: number;
  operatorName: string;
  workDate: string;
  unitCost: number;
  totalCost: number;
  notes?: string;
  status: ManualWorkStatus;
  isPaid?: boolean;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ManualWorkInput = Omit<ManualWork, 'id' | 'totalCost' | 'createdAt' | 'updatedAt'>;

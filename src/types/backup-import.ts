
// TEMP_BACKUP_LAB

export type BackupFileStatus = 'valid' | 'warning' | 'error';

export interface BackupFile {
  id: string;
  name: string;
  originalPath: string;
  size: number;
  count: number;
  data: any[];
  fields: string[];
  status: BackupFileStatus;
}

export type DiagnosticIssueType = 'missing' | 'type_mismatch' | 'extra';

export interface DiagnosticIssue {
  field: string;
  issue: DiagnosticIssueType;
  expectedType?: string;
  foundType?: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface BackupDiagnostic {
  fileName: string;
  issues: DiagnosticIssue[];
  isValid: boolean;
  isTransformed?: boolean;
  observations: string;
  coverage: number;
}

export interface MappingSimulation {
  fileName: string;
  targetCollection: string;
  compatibleCount: number;
  totalCount: number;
  sampleMapped: any;
  sampleOriginal: any;
  allMappedData: any[]; // Datos transformados completos para simulación de carga
}

export interface ImportSimulationResult {
  collection: string;
  total: number;
  ready: number;
  warnings: number;
  errors: number;
  details: string[];
}

export interface GlobalSimulationReport {
  results: ImportSimulationResult[];
  canImport: boolean;
  totalErrors: number;
  totalWarnings: number;
  totalReady: number;
}

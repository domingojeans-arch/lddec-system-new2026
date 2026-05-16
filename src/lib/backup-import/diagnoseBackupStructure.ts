// TEMP_BACKUP_LAB
import { BackupFile, BackupDiagnostic, DiagnosticIssue } from '@/types/backup-import';

const REQUIRED_FIELDS: Record<string, string[]> = {
  'clients.json': ['id', 'name', 'phone'],
  'entries.json': ['id', 'clientId', 'date', 'lotes'],
  'outputs.json': ['outputNumber', 'cliente', 'fecha'],
  'facturas.json': ['invoiceNumber', 'clientId', 'total', 'balancePending'],
  'roles_usuarios.json': ['email', 'role']
};

export function diagnoseFile(file: BackupFile): BackupDiagnostic {
  const expected = REQUIRED_FIELDS[file.name] || [];
  const issues: DiagnosticIssue[] = [];
  let observations = '';
  let isTransformed = false;
  
  if (file.count === 0) {
    return {
      fileName: file.name,
      issues: [{ field: 'all', issue: 'missing', severity: 'critical' }],
      isValid: false,
      observations: 'El archivo está vacío.',
      coverage: 0
    };
  }

  // Diccionario de Alias por Archivo (Campos que pueden derivarse)
  const ALIAS_MAP: Record<string, Record<string, string[]>> = {
    'clients.json': {
      'phone': ['phoneNumber']
    },
    'outputs.json': {
      'outputNumber': ['id', 'numeroSalida'],
      'cliente': ['containedClientNames', 'clienteNombre'],
      'fecha': ['date', 'fechaSalida']
    },
    'facturas.json': {
      'invoiceNumber': ['numeroFactura'],
      'clientId': ['clienteId', 'clienteNombre'],
      'total': ['montoTotal', 'valorTotal', 'totalFactura'],
      'balancePending': ['saldoPendiente', 'pagosAjustes', 'abonos']
    }
  };

  const fileAliases = ALIAS_MAP[file.name] || {};

  // Verificar campos obligatorios con soporte para alias
  expected.forEach(field => {
    let fieldFound = file.fields.includes(field);
    const aliases = fileAliases[field] || [];
    
    // Si no está el campo real, buscar si existe algún alias en los campos del archivo
    if (!fieldFound) {
      const foundAlias = aliases.find(a => file.fields.includes(a));
      if (foundAlias) {
        fieldFound = true;
        isTransformed = true;
        observations += `Campo "${field}" será derivado de "${foundAlias}". `;
      }
    }

    if (!fieldFound) {
      issues.push({
        field,
        issue: 'missing',
        severity: 'critical'
      });
    }
  });

  // Validaciones especiales por tipo de archivo
  if (file.name === 'entries.json') {
    const sample = file.data[0];
    if (sample && !Array.isArray(sample.lotes) && !Array.isArray(sample.prendas)) {
      issues.push({
        field: 'lotes/prendas',
        issue: 'type_mismatch',
        foundType: typeof sample.lotes,
        expectedType: 'Array',
        severity: 'critical'
      });
    }
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const coverage = Math.max(0, 100 - (criticalCount * 25));

  return {
    fileName: file.name,
    issues,
    isValid: criticalCount === 0,
    isTransformed,
    observations: observations || (issues.length === 0 
      ? 'Estructura compatible.' 
      : `Se detectaron ${issues.length} discrepancias.`),
    coverage
  };
}


// TEMP_BACKUP_LAB
import { BackupFile, BackupDiagnostic, MappingSimulation } from '@/types/backup-import';

export function downloadAnalysisJson(
  files: BackupFile[], 
  diagnostics: BackupDiagnostic[], 
  simulations: MappingSimulation[]
) {
  const report = {
    generatedAt: new Date().toISOString(),
    mode: "MEMORY_ONLY",
    summary: {
      totalFiles: files.length,
      totalRecords: files.reduce((acc, f) => acc + f.count, 0)
    },
    files: files.map(f => ({ name: f.name, count: f.count, fields: f.fields })),
    diagnostics,
    simulations
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LDDEC_Analysis_${new Date().getTime()}.json`;
  a.click();
}

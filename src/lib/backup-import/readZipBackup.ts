
// TEMP_BACKUP_LAB
import JSZip from 'jszip';
import { BackupFile } from '@/types/backup-import';

const EXPECTED_FILES = [
  'clients.json',
  'configuracion.json',
  'cuentas_bancarias.json',
  'entries.json',
  'facturas.json',
  'manualidad_tarifas.json',
  'manualidades.json',
  'outputs.json',
  'roles_usuarios.json'
];

export async function readZipBackup(file: File): Promise<BackupFile[]> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const detectedFiles: BackupFile[] = [];

  // Iterar sobre todas las entradas del ZIP recursivamente
  const filePaths = Object.keys(content.files);

  for (const path of filePaths) {
    const zipEntry = content.files[path];
    
    // Ignorar directorios
    if (zipEntry.dir) continue;

    // Obtener nombre base del archivo (ignorar carpetas padre)
    const segments = path.split('/');
    const baseName = segments[segments.length - 1];
    const lowerBaseName = baseName.toLowerCase();

    // Solo procesar archivos .json
    if (lowerBaseName.endsWith('.json')) {
      const isStandard = EXPECTED_FILES.includes(lowerBaseName);
      
      try {
        const rawData = await zipEntry.async('string');
        const jsonData = JSON.parse(rawData);
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        // Extraer campos del primer registro para el análisis de esquema
        const firstRecord = dataArray[0] || {};
        const fields = Object.keys(firstRecord);

        detectedFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: baseName, // Nombre real del archivo
          originalPath: path, // Ruta completa dentro del ZIP
          size: (zipEntry as any)._data?.uncompressedSize || 0,
          count: dataArray.length,
          data: dataArray,
          fields,
          status: isStandard ? 'valid' : 'warning'
        });
      } catch (e) {
        console.error(`Error parseando ${path}:`, e);
      }
    }
  }

  return detectedFiles;
}

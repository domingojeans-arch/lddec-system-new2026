/**
 * MOTOR DE CONVERSIÓN DE FECHAS LDDEC 1.2
 * Optimizado para evitar desfases de zona horaria (UTC vs Local).
 */
export function toDate(value: any): Date | null {
  if (!value) return null;
  
  // 1. Si es un Timestamp de Firestore
  if (typeof value.toDate === 'function') return value.toDate();
  
  // 2. Si es un objeto con segundos (formato plano de Firestore)
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  
  // 3. Si es un objeto Date
  if (value instanceof Date) return value;
  
  // 4. Si es un string de fecha (ej: "2024-04-09")
  if (typeof value === 'string') {
    // Si es formato YYYY-MM-DD, añadimos mediodía para evitar saltos de día por zona horaria
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + "T12:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    // Formatos DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    // Formatos DD/MM/YY (año de 2 dígitos)
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(value)) {
      const [day, month, year] = value.split('/');
      const yearNum = parseInt(year);
      const fullYear = yearNum + (yearNum < 50 ? 2000 : 1900);
      const d = new Date(fullYear, parseInt(month) - 1, parseInt(day), 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

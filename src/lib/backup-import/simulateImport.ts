
// TEMP_BACKUP_LAB
import { MappingSimulation, GlobalSimulationReport, ImportSimulationResult } from '@/types/backup-import';

/**
 * Ejecuta una simulación de importación validando integridad referencial,
 * duplicados y tipos de datos sobre los datos ya mapeados en memoria.
 */
export function runImportSimulation(simulations: MappingSimulation[]): GlobalSimulationReport {
  const results: ImportSimulationResult[] = [];
  
  // 1. Indexar datos mapeados para validaciones cruzadas
  const dataMap: Record<string, any[]> = {};
  simulations.forEach(sim => {
    dataMap[sim.targetCollection] = sim.allMappedData || [];
  });

  // ASEGURAR EXISTENCIA DE CLIENTE DESCONOCIDO PARA REPARACIONES
  const clientsSim = simulations.find(s => s.targetCollection === 'clients');
  const clientsData = dataMap['clients'] || [];
  
  // Verificar si ya existe un cliente con ID 'unknown_client' para evitar duplicados
  const hasUnknownClient = clientsData.some(c => c.id === 'unknown_client');
  if (!hasUnknownClient && clientsSim) {
    const unknownClientRecord = {
      id: "unknown_client",
      firstName: "CLIENTE",
      lastName: "DESCONOCIDO",
      name: "CLIENTE DESCONOCIDO",
      classification: "especial",
      status: "active",
      notes: "Registro generado automáticamente por el importador para rescatar facturas huérfanas.",
      phone: ""
    };
    
    // Solo añadimos el registro al array mapeado (clientsData es una referencia a sim.allMappedData)
    if (clientsSim.allMappedData) {
      clientsSim.allMappedData.push(unknownClientRecord);
      clientsSim.compatibleCount++;
      clientsSim.totalCount++;
    }
  }

  const entries = dataMap['entries'] || [];
  const invoices = dataMap['invoices'] || [];

  // 2. Procesar cada colección mapeada
  simulations.forEach(sim => {
    const colName = sim.targetCollection;
    const items = sim.allMappedData || [];
    let ready = 0;
    let warnings = 0;
    let errors = 0;
    const details: string[] = [];

    const usedIds = new Set<string>();

    items.forEach((item, idx) => {
      let hasError = false;
      let hasWarning = false;

      // VALIDACIÓN 1: Identificadores Únicos y Duplicados
      const id = item.id || item.invoiceNumber || item.outputNumber || item.entryNumber;
      if (!id) {
        errors++;
        hasError = true;
        if (details.length < 5) details.push(`Registro #${idx + 1}: Identificador único ausente.`);
      } else if (usedIds.has(id)) {
        errors++;
        hasError = true;
        if (details.length < 5) details.push(`ID Duplicado: ${id}`);
      }
      usedIds.add(id);

      // VALIDACIÓN 2: Integridad Referencial (Relaciones)
      if (colName === 'outputs') {
        // ¿Existe el ingreso maestro relacionado?
        if (item.entryNumber) {
          const entryExists = entries.some(e => e.entryNumber === item.entryNumber);
          if (!entryExists) {
            warnings++;
            hasWarning = true;
            if (details.length < 5) details.push(`Salida ${id}: Refiere a ingreso ${item.entryNumber} no detectado.`);
          }
        }
      }

      if (colName === 'invoices') {
        // ¿Existe el cliente vinculado?
        const clientExists = clientsData.some(c => c.id === item.clientId);
        
        if (!item.clientId || !clientExists) {
          // LÓGICA DE RESCATE: No marcar como error, reasignar a cliente desconocido
          item.clienteOriginalId = item.clientId || "N/A";
          item.clientId = "unknown_client";
          item.importObservation = "Cliente original no encontrado en backup. Asignado cliente de respaldo.";
          
          warnings++;
          hasWarning = true;
          if (details.length < 5) details.push(`Factura ${id}: Cliente reasignado a DESCONOCIDO (Referencia rota).`);
        }

        // ¿Valores numéricos correctos (No NaN)?
        if (isNaN(item.total) || isNaN(item.balancePending)) {
          errors++;
          hasError = true;
          if (details.length < 5) details.push(`Factura ${id}: Montos financieros inválidos.`);
        }
      }

      if (!hasError) ready++;
    });

    results.push({
      collection: colName,
      total: items.length,
      ready,
      warnings,
      errors,
      details: details.slice(0, 5)
    });
  });

  const totalErrors = results.reduce((acc, r) => acc + r.errors, 0);
  const totalWarnings = results.reduce((acc, r) => acc + r.warnings, 0);
  const totalReady = results.reduce((acc, r) => acc + r.ready, 0);

  return {
    results,
    canImport: totalErrors === 0 && totalReady > 0,
    totalErrors,
    totalWarnings,
    totalReady
  };
}

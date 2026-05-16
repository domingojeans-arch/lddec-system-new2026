
// TEMP_BACKUP_LAB
import { MappingSimulation, BackupFile } from '@/types/backup-import';

/**
 * Normaliza nombres para comparación
 */
function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Simula el mapeo de datos de una estructura antigua a la versión 1.1
 * sin realizar escrituras reales.
 */
export function simulateMapping(fileName: string, data: any[], allFiles: BackupFile[] = []): MappingSimulation {
  const sample = data[0] || {};
  let targetCollection = "";
  let compatibleCount = 0;

  // Colección de destino basada en nombre de archivo
  switch (fileName) {
    case 'clients.json': targetCollection = "clients"; break;
    case 'outputs.json': targetCollection = "outputs"; break;
    case 'entries.json': targetCollection = "entries"; break;
    case 'facturas.json': targetCollection = "invoices"; break;
    case 'manualidades.json': targetCollection = "manualidades"; break;
    case 'manualidad_tarifas.json': targetCollection = "manualidad_tarifas"; break;
    case 'cuentas_bancarias.json': targetCollection = "cuentas_bancarias"; break;
    case 'roles_usuarios.json': targetCollection = "roles_usuarios"; break;
    case 'configuracion.json': targetCollection = "configuracion"; break;
    default: targetCollection = fileName.replace('.json', '');
  }

  // Ejecutar mapeo sobre todos los datos para la simulación de carga posterior
  const allMappedData = data.map(item => {
    let mapped: any = {};

    if (targetCollection === 'clients') {
      mapped = {
        id: item.id || Math.random().toString(36).substr(2, 9),
        firstName: item.firstName || (item.name ? item.name.split(' ')[0] : "N/A"),
        lastName: item.lastName || (item.name ? item.name.split(' ').slice(1).join(' ') : ""),
        name: item.name || `${item.firstName || ""} ${item.lastName || ""}`.trim() || "N/A",
        idNumber: item.idNumber || item.ruc || "N/A",
        phone: item.phone || item.phoneNumber || "",
        classification: item.classification || "nacional",
        status: item.status || "active",
        email: item.email || ""
      };
    } else if (targetCollection === 'outputs') {
      mapped = {
        ...item,
        outputNumber: item.outputNumber || item.numeroSalida || item.id || "N/A",
        cliente: item.cliente || item.containedClientNames || item.clienteNombre || "N/A",
        fecha: item.fecha || item.date || item.fechaSalida || null
      };
    } else if (targetCollection === 'invoices') {
      const total = Number(item.total || item.montoTotal || item.valorTotal || item.totalFactura || 0);
      
      // Resolución de Cliente (Cross-ref)
      let resolvedClientId = item.clientId || item.clienteId || null;
      if (!resolvedClientId && (item.clienteNombre || item.name)) {
        const clientFile = allFiles.find(f => f.name === 'clients.json');
        if (clientFile) {
          const targetName = normalizeName(item.clienteNombre || item.name);
          const foundClient = clientFile.data.find(c => normalizeName(c.name || `${c.firstName} ${c.lastName}`) === targetName);
          if (foundClient) resolvedClientId = foundClient.id;
        }
      }

      // Cálculo de Balance
      let paymentsSum = 0;
      const paymentStructures = [item.pagosAjustes, item.pagos, item.abonos];
      paymentStructures.forEach(struct => {
        if (Array.isArray(struct)) {
          struct.forEach(p => {
            const val = Number(p.monto || p.valor || p.amount || 0);
            if (!isNaN(val)) paymentsSum += val;
          });
        }
      });

      mapped = {
        invoiceNumber: item.invoiceNumber || item.numeroFactura || "N/A",
        clientId: resolvedClientId,
        invoiceDate: item.fecha || item.fechaFactura || item.date || null,
        total: total,
        balancePending: Math.max(0, total - paymentsSum)
      };
    } else {
      mapped = { ...item };
    }

    if (Object.keys(mapped).length > 0) compatibleCount++;
    return mapped;
  });

  return {
    fileName,
    targetCollection,
    compatibleCount,
    totalCount: data.length,
    sampleOriginal: sample,
    sampleMapped: allMappedData[0] || {},
    allMappedData
  };
}

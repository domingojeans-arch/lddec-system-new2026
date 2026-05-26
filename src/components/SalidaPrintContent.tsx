import React from 'react';

interface SalidaPrintContentProps {
  salida: any;
  startAtLine?: number;
}

/**
 * Plantilla técnica para formularios preimpresos.
 * Usa coordenadas exactas en CM para coincidir con la papelería física.
 * Soporta múltiples esquemas de datos (Transicional y 2026).
 */
export function cleanClientNames(nameStr: string): string {
  if (!nameStr) return "";
  const parts = nameStr.split(",").map(p => p.trim()).filter(Boolean);
  const seenSignatures = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    const cleanWords: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (i === 0 || words[i].toUpperCase() !== words[i - 1].toUpperCase()) {
        cleanWords.push(words[i]);
      }
    }
    const cleanPart = cleanWords.join(" ");
    const signature = cleanWords
      .map(w => w.toUpperCase())
      .sort()
      .join(" ");

    if (signature && !seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueParts.push(cleanPart);
    }
  }

  const result = uniqueParts.join(", ");
  const finalWords = result.split(/\s+/).filter(Boolean);
  const finalCleanWords: string[] = [];
  for (let i = 0; i < finalWords.length; i++) {
    const currentWordClean = finalWords[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase();
    const prevWordClean = i > 0 ? finalWords[i - 1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase() : "";
    if (i === 0 || currentWordClean !== prevWordClean) {
      finalCleanWords.push(finalWords[i]);
    }
  }
  
  let finalStr = finalCleanWords.join(" ");
  finalStr = finalStr.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
  return finalStr;
}

export function SalidaPrintContent({ salida, startAtLine = 1 }: SalidaPrintContentProps) {
  // 1. Resolución de fecha (Timestamp, String o Date)
  const rawDate = salida.date || salida.fechaSalida || salida.fecha || salida.createdAt;
  let dateObj: Date;
  if (rawDate?.toDate) {
    dateObj = rawDate.toDate();
  } else if (rawDate) {
    dateObj = new Date(rawDate);
  } else {
    dateObj = new Date();
  }
  
  const fechaStr = isNaN(dateObj.getTime()) 
    ? "---" 
    : dateObj.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // 2. Resolución de cliente (Array o String)
  let clienteStr = salida.clienteNombre || salida.cliente || salida.clientName || "";
  if (!clienteStr) {
    const clientNamesArray = Array.isArray(salida.containedClientNames) ? salida.containedClientNames : [];
    clienteStr = clientNamesArray.length > 0 ? clientNamesArray.join(", ") : "S/D";
  }

  clienteStr = cleanClientNames(clienteStr.toString().trim().toUpperCase());

  // 3. Procesamiento de ítems (Lotes)
  const items = Array.isArray(salida.itemsDispatched) ? salida.itemsDispatched : [];
  
  // Ordenamiento alfabético por número de lote para consistencia en papel
  const sortedItems = [...items].sort((a, b) => {
    const lotA = String(a.entryLotNumber || a.lotNumber || "");
    const lotB = String(b.entryLotNumber || b.lotNumber || "");
    return lotA.localeCompare(lotB, undefined, { numeric: true });
  });

  // 4. Cálculo de Totales
  const totalDespachado = items.reduce((acc: number, it: any) => 
    acc + (Number(it.quantityToDispatch || it.availableToDispatch || it.cantidad || it.quantity || 0)), 0
  );
  const muestras = Number(salida.numeroMuestras || 0);
  const totalGeneral = totalDespachado + muestras;

  // 5. Lógica de 21 renglones preimpresos
  const startIndex = Math.max(0, startAtLine - 1);
  const tableRows = new Array(21).fill(null);
  
  sortedItems.forEach((item, index) => {
    const pos = startIndex + index;
    if (pos < 21) {
      tableRows[pos] = {
        cant: Number(item.quantityToDispatch || item.availableToDispatch || item.cantidad || item.quantity || 0),
        desc: `${item.garmentType || 'PRENDAS'} - ${item.processType || item.process || 'S/D'}`.toUpperCase(),
        lote: String(item.entryLotNumber || item.lotNumber || item.loteId || "S/L").toUpperCase(),
        ingreso: String(item.parentIngresoNumber || item.parentIngresoMaestro || "S/I").toUpperCase()
      };
    }
  });

  // Si hay muestras, agregarlas automáticamente al final del listado de ítems
  const lastItemIndex = startIndex + sortedItems.length;
  if (muestras > 0 && lastItemIndex < 21) {
    tableRows[lastItemIndex] = {
      cant: muestras,
      desc: "MUESTRAS ADICIONALES",
      lote: "---",
      ingreso: "---"
    };
  }

  return (
    <div className="hoja-preimpresa">
      <style>{`
        .hoja-preimpresa {
          position: relative;
          width: 21cm;
          height: 29.7cm;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          color: black;
          background: white;
        }
        .dato-fijo {
          position: absolute;
          font-weight: bold;
          text-transform: uppercase;
        }
        /* Coordenadas auditadas ajustadas para papelería LDDEC - BAJADO 0.5CM */
        .f-fecha { top: 4.29cm; left: 5.61cm; }
        .f-cliente { top: 4.99cm; left: 5.61cm; width: 7.5cm; white-space: nowrap; overflow: hidden; }
        .f-resumen { top: 3.76cm; left: 12.83cm; }
        .f-total { top: 4.90cm; left: 14.00cm; font-size: 12pt; font-weight: 900; }
        
        .area-tabla {
          position: absolute;
          top: 6.26cm;
          left: 0;
          width: 100%;
        }
        .renglon {
          display: flex;
          height: 0.6cm; 
          align-items: center;
        }
        .col-cant { width: 1.5cm; text-align: center; margin-left: 4.8cm; font-weight: bold; }
        .col-desc { width: 6.5cm; padding-left: 0.5cm; overflow: hidden; white-space: nowrap; font-size: 9pt; }
        .col-lote { width: 2.5cm; font-weight: bold; text-align: center; }
        .col-ingreso { width: 3cm; text-align: right; padding-right: 1.5cm; }
      `}</style>

      {/* Cabecera: solo se imprime si empezamos desde la fila 1 para evitar sobreescritura */}
      {startAtLine === 1 && (
        <>
          <div className="dato-fijo f-fecha">{fechaStr}</div>
          <div className="dato-fijo f-cliente" title={clienteStr}>{clienteStr}</div>
          <div className="dato-fijo f-resumen">SERVICIO DE LAVANDERIA</div>
          <div className="dato-fijo f-total">{totalGeneral}</div>
        </>
      )}

      <div className="area-tabla">
        {tableRows.map((row, i) => (
          <div key={i} className="renglon">
            {row && (
              <>
                <div className="col-cant">{row.cant}</div>
                <div className="col-desc">{row.desc}</div>
                <div className="col-lote">{row.lote}</div>
                <div className="col-ingreso">{row.ingreso}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

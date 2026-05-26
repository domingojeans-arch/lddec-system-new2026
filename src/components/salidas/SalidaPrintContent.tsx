'use client';

import React from 'react';

interface SalidaPrintContentProps {
  salida: any;
  startAtLine?: number;
  colorImpresion?: "negro" | "azul";
}

/**
 * TECHNICAL PRINT COMPONENT LDDEC
 * Procesa cada sublote como una fila independiente.
 * Recupera procesos específicos de cada prenda evitando duplicaciones.
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

export function SalidaPrintContent({ salida, startAtLine = 1, colorImpresion = "negro" }: SalidaPrintContentProps) {
  // 1. Date Resolution
  const rawDate = salida.date || salida.fechaSalida || salida.fecha || salida.createdAt;
  let dateObj: Date;
  if (rawDate?.toDate) dateObj = rawDate.toDate();
  else if (rawDate) dateObj = new Date(rawDate);
  else dateObj = new Date();
  
  const fechaStr = isNaN(dateObj.getTime()) 
    ? "---" 
    : dateObj.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // 2. Client Resolution
  let clienteStr = salida.clienteNombre || salida.cliente || salida.clientName || "";
  if (!clienteStr) {
    const clientNamesArray = Array.isArray(salida.containedClientNames) ? salida.containedClientNames : [];
    const uniqueNames = Array.from(new Set(
      clientNamesArray.map((n: any) => String(n || "").trim().toUpperCase())
    )).filter(Boolean);
    clienteStr = uniqueNames.length > 0 ? uniqueNames.join(", ") : "S/D";
  }

  clienteStr = cleanClientNames(clienteStr.toString().trim().toUpperCase());

  // 3. Data Processing (Main Garment Type & Rows)
  const lines: any[] = [];
  const items = Array.isArray(salida.itemsDispatched) ? salida.itemsDispatched : [];
  
  // Extract main garment type for the header subtitle
  const mainGarmentType = (items[0]?.garmentType || items[0]?.prendas?.[0]?.garmentType || "PRENDAS").toUpperCase();

  items.forEach((item: any) => {
    // ID RESOLUTION
    const lotId = (item.entryLotNumber || item.lotNumber || item.loteId || item.lote || "").toString().toUpperCase();
    const entryId = (item.parentIngresoNumber || item.parentIngresoMaestro || item.numeroIngreso || "").toString().toUpperCase();

    // SUB-LOTS (PRENDAS)
    const sublotes = Array.isArray(item.prendas) ? item.prendas : [];
    
    if (sublotes.length > 0) {
      sublotes.forEach((sub: any, subIdx: number) => {
        const garmentType = (sub.garmentType || item.garmentType || 'PRENDA').toUpperCase();
        
        // MOTOR DE BÚSQUEDA PROFUNDA DE PROCESOS (Recupera datos reales de revisión)
        let subProcess = "";
        
        // A. Intentar desde el sublote directamente
        subProcess = (sub.process || sub.proceso || "").toString().trim();

        // B. Intentar desde el mapa técnico del item
        if (!subProcess && item.processesByGarment && sub.id) {
          subProcess = (item.processesByGarment[sub.id] || "").toString().trim();
        }

        // C. Intentar extraer del resumen global (con o sin pipes '|')
        if (!subProcess) {
          const globalProc = (item.process || item.proceso || "").toString();
          if (globalProc.includes("|")) {
            const parts = globalProc.split("|").map((p: string) => p.trim());
            subProcess = parts[subIdx] || "";
          } else {
            subProcess = globalProc;
          }
        }

        // Limpiar prefijos redundantes (ej: "P.HOMBRE: BIGOTES" -> "BIGOTES")
        if (subProcess.includes(":")) {
          const splitProc = subProcess.split(":");
          subProcess = splitProc[1]?.trim() || subProcess;
        }

        if (!subProcess) subProcess = "S/D";

        // DIAGNÓSTICO OBLIGATORIO - Verificación de coincidencia con Tarjeta Previa
        console.log("DEBUG PRINT PROCESO SUBLOTE", {
          lotId,
          cantidad: Number(sub.quantityToDispatch || sub.quantity || 0),
          subLoteIndex: subIdx,
          garment: garmentType,
          process: subProcess
        });

        lines.push({
          cant: Number(sub.quantityToDispatch || sub.quantity || 0),
          desc: `${garmentType} - ${subProcess}`.toUpperCase(),
          lote: lotId,
          ingreso: entryId
        });
      });
    } else {
      // Caso de lotes sin desglose de prendas (Legacy o Simples)
      const lotProc = (item.process || item.proceso || item.processType || "S/D").toString().toUpperCase();
      const garmentType = (item.garmentType || 'PRENDAS').toUpperCase();
      
      lines.push({
        cant: Number(item.quantityToDispatch || item.cantidad || item.quantity || 0),
        desc: `${garmentType} - ${lotProc}`,
        lote: lotId,
        ingreso: entryId
      });
    }
  });

  // Ordenar por lote para la hoja física
  lines.sort((a, b) => a.lote.localeCompare(b.lote, undefined, { numeric: true }));

  // Muestras adicionales
  const muestras = Number(salida.numeroMuestras || 0);
  if (muestras > 0) {
    lines.push({
      cant: muestras,
      desc: "MUESTRAS FISICAS ADICIONALES",
      lote: "---",
      ingreso: "---"
    });
  }

  const emptyPrefix = new Array(Math.max(0, startAtLine - 1)).fill(null);
  const totalGeneral = lines.reduce((acc, curr) => acc + curr.cant, 0);

  return (
    <div 
      className={colorImpresion === 'azul' ? 'print-color-azul' : ''}
      style={{
        position: 'relative',
        width: '21cm',
        height: '29.7cm',
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: '10pt',
        color: colorImpresion === 'azul' ? '#0f172a' : 'black',
        background: 'white',
        overflow: 'hidden',
        margin: '0',
        padding: '0'
      }}
    >
      <style>{`
        @media print {
          .print-color-azul, .print-color-azul * {
            color: #0f172a !important;
            border-color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      {/* COORDENADAS CABECERA - AJUSTADAS (+0.5CM TOP / -0.3CM LEFT) */}
      {startAtLine === 1 && (
        <>
          <div style={{ position: 'absolute', fontWeight: 'bold', textTransform: 'uppercase', top: '4.29cm', left: '5.31cm' }}>
            {fechaStr}
          </div>
          <div style={{ position: 'absolute', fontWeight: 'bold', textTransform: 'uppercase', top: '4.99cm', left: '5.31cm', width: '7.5cm', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {clienteStr}
          </div>
          <div style={{ position: 'absolute', fontWeight: 'bold', textTransform: 'uppercase', top: '3.76cm', left: '12.53cm' }}>
            {mainGarmentType}
          </div>
          <div style={{ position: 'absolute', fontWeight: 'bold', textTransform: 'uppercase', top: '4.90cm', left: '13.70cm', fontSize: '12pt' }}>
            {totalGeneral}
          </div>
        </>
      )}

      {/* CUERPO DE TABLA: SOPORTE PARA DESCRIPCIONES MULTILÍNEA */}
      <div style={{ position: 'absolute', top: '6.26cm', left: 0, width: '100%' }}>
        {emptyPrefix.map((_, i) => ( <div key={`empty-${i}`} style={{ height: '0.5cm' }} /> ))}
        {lines.map((row, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            minHeight: '0.6cm', 
            height: 'auto',
            alignItems: 'flex-start', 
            position: 'relative',
            paddingTop: '2px',
            paddingBottom: '2px'
          }}>
            <div style={{ width: '1.5cm', textAlign: 'center', marginLeft: '4.5cm', fontWeight: 'bold' }}>{row.cant}</div>
            <div style={{ 
              width: '6.3cm', 
              paddingLeft: '0.3cm', 
              fontSize: '9pt',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              lineHeight: '1.1'
            }}>{row.desc}</div>
            <div style={{ position: 'absolute', left: '12.70cm', width: '2.0cm', textAlign: 'center', fontWeight: 'bold' }}>{row.lote}</div>
            <div style={{ position: 'absolute', left: '14.70cm', width: '2.0cm', textAlign: 'right' }}>{row.ingreso}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

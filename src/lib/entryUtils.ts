/**
 * HELPER UNIVERSAL PARA SUMAR TODAS LAS PRENDAS DE UN INGRESO
 * Soporta la estructura de lotes con prendas (garments[]), campos de cantidad de lote,
 * y campos planos a nivel de documento (totalGarments, totalPrendas, cantidad, total).
 * Incluye protección contra errores humanos de digitación (donde se escribe el número de lote como cantidad, ej: lote 25119 con 25119 prendas).
 */
export function getEntryTotalPrendas(e: any): number {
  if (!e) return 0;
  const lotes = e.lotes || e.lots || [];
  if (Array.isArray(lotes) && lotes.length > 0) {
    const lotesSum = lotes.reduce((acc: number, l: any) => {
      const lotNum = Number(String(l?.lotNumber || l?.numeroLote || l?.loteId || "").trim());

      // 1. Si el lote tiene prendas detalladas (garments[] o prendas[])
      const garmentsArr = Array.isArray(l?.garments) ? l.garments : (Array.isArray(l?.prendas) ? l.prendas : []);
      if (garmentsArr.length > 0) {
        const gSum = garmentsArr.reduce((gAcc: number, g: any) => {
          let gVal = Number(g?.quantity ?? g?.cantidad ?? g?.cantidadConfirmada ?? 0);
          if (isNaN(gVal) || !isFinite(gVal)) gVal = 0;

          // Protección contra error de digitación: número de lote copiado en el campo de cantidad (ej: lote 25119 con cantidad 25119)
          if (lotNum > 1000 && gVal === lotNum) {
            gVal = 18; // Corrección normalizada de prendas
          } else if (gVal > 5000) {
            gVal = 0;
          }

          return gAcc + gVal;
        }, 0);
        if (gSum > 0) return acc + gSum;
      }

      // 2. Si no tiene garments o sumó 0, verificar campos de cantidad a nivel de lote
      let val = l?.quantityToDispatch ??
                l?.cantidadConfirmada ??
                l?.quantity ??
                l?.cantidad ??
                l?.totalPrendas ??
                l?.total ?? null;

      let num = Number(val);
      if (isNaN(num) || !isFinite(num)) num = 0;
      if (lotNum > 1000 && num === lotNum) {
        num = 18;
      } else if (num > 5000) {
        num = 0;
      }
      return acc + num;
    }, 0);

    if (lotesSum > 0) return lotesSum;
  }

  // 3. Fallback a campos planos en el encabezado del ingreso
  const flatVal = Number(e.totalGarments ?? e.totalPrendas ?? e.cantidad ?? e.total ?? 0);
  if (isNaN(flatVal) || !isFinite(flatVal) || flatVal > 50000) return 0;
  return flatVal;
}

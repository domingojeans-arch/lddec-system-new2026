import { 
  Firestore, 
  doc, 
  getDoc, 
  writeBatch, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit
} from "firebase/firestore";

export interface PendingDeliveryItem {
  id: string; // Clave única (ej: outputId_lotNumber_timestamp)
  outputId: string;
  lotNumber: string;
  parentIngresoMaestro?: string | null;
  deliveredAt: string; // ISO date string
  deliveredBy: string;
}

const STORAGE_KEY_PENDING = "lddec_pending_deliveries_v1";
const IDB_NAME = "lddec_offline_db";
const IDB_VERSION = 1;
const IDB_STORE_OUTPUTS = "outputs_cache";

/**
 * Limpieza preventiva de localStorage para no consumir cuota de 5MB
 */
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("lddec_outputs_cache_v1");
  } catch (e) {
    // Ignorar
  }
}

/**
 * Inicializador nativo de IndexedDB (soporta cientos de MB sin límite de cuota)
 */
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB no soportado en este navegador"));
    }
    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_OUTPUTS)) {
        db.createObjectStore(IDB_STORE_OUTPUTS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Obtiene todas las entregas pendientes de sincronizar guardadas en el navegador
 */
export function getPendingDeliveries(): PendingDeliveryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Aviso al leer entregas pendientes:", e);
    return [];
  }
}

/**
 * Guarda la lista de entregas pendientes en localStorage (son pocos bytes)
 */
export function savePendingDeliveries(items: PendingDeliveryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(items));
  } catch (e) {
    console.warn("Aviso al guardar entregas pendientes:", e);
  }
}

/**
 * Añade una entrega a la cola local pendiente
 */
export function addPendingDelivery(item: PendingDeliveryItem): void {
  const current = getPendingDeliveries();
  const exists = current.some(
    (p) => p.outputId === item.outputId && p.lotNumber.toUpperCase() === item.lotNumber.toUpperCase()
  );
  if (!exists) {
    savePendingDeliveries([...current, item]);
  }
}

/**
 * Añade múltiples entregas a la cola local
 */
export function addMultiplePendingDeliveries(newItems: PendingDeliveryItem[]): void {
  const current = getPendingDeliveries();
  const merged = [...current];
  for (const item of newItems) {
    if (!merged.some(p => p.outputId === item.outputId && p.lotNumber.toUpperCase() === item.lotNumber.toUpperCase())) {
      merged.push(item);
    }
  }
  savePendingDeliveries(merged);
}

/**
 * Elimina de la cola las entregas sincronizadas con éxito
 */
export function removePendingDeliveries(idsToRemove: string[]): void {
  const current = getPendingDeliveries();
  const idSet = new Set(idsToRemove);
  const remaining = current.filter(p => !idSet.has(p.id));
  savePendingDeliveries(remaining);
}

/**
 * Limpia toda la cola pendiente
 */
export function clearPendingDeliveries(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING);
  } catch (e) {
    console.warn("Aviso al limpiar entregas pendientes:", e);
  }
}

/**
 * Guarda las guías en IndexedDB (sin límite de cuota de localStorage)
 * Filtra a las 150 guías más recientes para máxima velocidad
 */
export async function setCachedOutputsAsync(outputs: any[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openOfflineDB();
    const leanOutputs = (outputs || []).slice(0, 150);
    const tx = db.transaction(IDB_STORE_OUTPUTS, "readwrite");
    const store = tx.objectStore(IDB_STORE_OUTPUTS);
    store.put(leanOutputs, "latest_outputs");
  } catch (err) {
    console.warn("Aviso al guardar en IndexedDB:", err);
  }
}

/**
 * Obtiene las guías cacheadas en IndexedDB para visualización sin internet
 */
export async function getCachedOutputsAsync(): Promise<any[]> {
  if (typeof window === "undefined") return [];
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_OUTPUTS, "readonly");
      const store = tx.objectStore(IDB_STORE_OUTPUTS);
      const req = store.get("latest_outputs");
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Mezcla las entregas pendientes locales sobre la lista de salidas
 * para que el chofer vea reflejado inmediatamente el estado sin importar la conexión
 */
export function mergePendingDeliveriesWithOutputs(
  outputs: any[], 
  pending: PendingDeliveryItem[], 
  getVisibleLotNameFn: (l: any) => string
): any[] {
  if (!pending || pending.length === 0) return outputs;

  return outputs.map((out) => {
    const pendingForOutput = pending.filter(p => 
      p.outputId === out.id || 
      (out.numeroSalida && p.outputId === out.numeroSalida) || 
      (out.numeroGuia && p.outputId === out.numeroGuia) ||
      (out._docId && p.outputId === out._docId)
    );
    if (pendingForOutput.length === 0) return out;

    const hasGuiaDelivery = pendingForOutput.some(p => p.lotNumber === "__GUIA__");
    const pendingLotNames = new Set(pendingForOutput.map(p => p.lotNumber.toUpperCase()));

    const updatedItems = (out.itemsDispatched || []).map((item: any) => {
      const lotName = getVisibleLotNameFn(item).toUpperCase();
      const altNames = [
        lotName,
        item.entryLotNumber ? String(item.entryLotNumber).toUpperCase() : "",
        item.lotNumber ? String(item.lotNumber).toUpperCase() : "",
        item.loteId ? String(item.loteId).toUpperCase() : "",
        item.numeroLote ? String(item.numeroLote).toUpperCase() : "",
      ].filter(Boolean);

      const isMatch = hasGuiaDelivery || 
        altNames.some(name => pendingLotNames.has(name)) ||
        (pendingLotNames.has("S/L") && (lotName === "S/L" || altNames.length === 0));

      if (isMatch) {
        const matchingPending = pendingForOutput.find(p => altNames.includes(p.lotNumber.toUpperCase())) || pendingForOutput[0];
        return {
          ...item,
          isClientDelivered: true,
          clientDeliveryTimestamp: matchingPending?.deliveredAt || pendingForOutput[0]?.deliveredAt,
          entregadoPor: matchingPending?.deliveredBy || pendingForOutput[0]?.deliveredBy,
          isOfflinePendingSync: true, // Distintivo visual
        };
      }
      return item;
    });

    const allDelivered = updatedItems.length === 0 
      ? hasGuiaDelivery 
      : updatedItems.every((i: any) => i.isClientDelivered === true);

    return {
      ...out,
      isClientDelivered: hasGuiaDelivery || allDelivered || out.isClientDelivered,
      isOfflinePendingSync: hasGuiaDelivery || out.isOfflinePendingSync,
      itemsDispatched: updatedItems,
    };
  });
}

/**
 * Helper con timeout estricto para evitar bloqueos cuando el celular pierde señal
 */
export function withTimeout<T>(promise: Promise<T>, ms: number = 3500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms)
    ),
  ]);
}

/**
 * Sincroniza todas las entregas pendientes hacia Firestore
 */
export async function syncDeliveriesToFirestore(
  db: Firestore,
  pendingItems: PendingDeliveryItem[],
  getVisibleLotNameFn: (l: any) => string
): Promise<{ success: boolean; syncedCount: number; errors: any[] }> {
  if (!pendingItems || pendingItems.length === 0) {
    return { success: true, syncedCount: 0, errors: [] };
  }

  const syncedIds: string[] = [];
  const errors: any[] = [];

  // Agrupar entregas por outputId para hacer operaciones batch eficientes
  const outputGroups = new Map<string, PendingDeliveryItem[]>();
  pendingItems.forEach(p => {
    if (!outputGroups.has(p.outputId)) outputGroups.set(p.outputId, []);
    outputGroups.get(p.outputId)!.push(p);
  });

  for (const [outputId, items] of outputGroups.entries()) {
    try {
      let outputRef = doc(db, "outputs", outputId);
      let outputSnap = await withTimeout(getDoc(outputRef), 3000);
      
      if (!outputSnap.exists()) {
        outputRef = doc(db, "salidas", outputId);
        outputSnap = await withTimeout(getDoc(outputRef), 3000);
      }
      if (!outputSnap.exists()) {
        outputRef = doc(db, "muestras", outputId);
        outputSnap = await withTimeout(getDoc(outputRef), 3000);
      }

      // Si no existe por ID directo, buscar mediante query en outputs y salidas (ej: si outputId es el número de guía)
      if (!outputSnap.exists()) {
        try {
          const qOutputs = query(collection(db, "outputs"), where("numeroSalida", "==", outputId), limit(1));
          const qSnap = await withTimeout(getDocs(qOutputs), 3000);
          if (!qSnap.empty) {
            outputRef = qSnap.docs[0].ref;
            outputSnap = qSnap.docs[0];
          }
        } catch (e) {}
      }
      if (!outputSnap.exists()) {
        try {
          const qOutputsGuia = query(collection(db, "outputs"), where("numeroGuia", "==", outputId), limit(1));
          const qSnap = await withTimeout(getDocs(qOutputsGuia), 3000);
          if (!qSnap.empty) {
            outputRef = qSnap.docs[0].ref;
            outputSnap = qSnap.docs[0];
          }
        } catch (e) {}
      }
      if (!outputSnap.exists()) {
        try {
          const qSalidas = query(collection(db, "salidas"), where("numeroSalida", "==", outputId), limit(1));
          const qSnap = await withTimeout(getDocs(qSalidas), 3000);
          if (!qSnap.empty) {
            outputRef = qSnap.docs[0].ref;
            outputSnap = qSnap.docs[0];
          }
        } catch (e) {}
      }

      if (!outputSnap.exists()) {
        // Si la salida ya no existe en ninguna colección tras todas las búsquedas, descartar items obsoletos
        items.forEach(i => syncedIds.push(i.id));
        continue;
      }

      const outputData = outputSnap.data() || {};
      const currentItems = Array.isArray(outputData.itemsDispatched) && outputData.itemsDispatched.length > 0
        ? outputData.itemsDispatched
        : (Array.isArray(outputData.items) && outputData.items.length > 0
          ? outputData.items
          : (Array.isArray(outputData.lotes) && outputData.lotes.length > 0
            ? outputData.lotes
            : (Array.isArray(outputData.lines) && outputData.lines.length > 0
              ? outputData.lines
              : (Array.isArray(outputData.prendas) && outputData.prendas.length > 0
                ? outputData.prendas
                : (Array.isArray(outputData.garments) && outputData.garments.length > 0
                  ? outputData.garments
                  : (Array.isArray(outputData.lots) ? outputData.lots : []))))));

      const batch = writeBatch(db);
      const lotNamesToDeliver = new Set(items.map(i => i.lotNumber.toUpperCase()));
      const hasGuiaDelivery = lotNamesToDeliver.has("__GUIA__");
      const entriesToUpdate = new Map<string, Set<string>>();

      const updatedItemsDispatched = currentItems.map((item: any) => {
        const itemLotName = getVisibleLotNameFn(item).toUpperCase();
        const altNames = [
          itemLotName,
          item.entryLotNumber ? String(item.entryLotNumber).toUpperCase() : "",
          item.lotNumber ? String(item.lotNumber).toUpperCase() : "",
          item.loteId ? String(item.loteId).toUpperCase() : "",
          item.numeroLote ? String(item.numeroLote).toUpperCase() : "",
        ].filter(Boolean);

        const isMatch = hasGuiaDelivery || 
          altNames.some(name => lotNamesToDeliver.has(name)) ||
          (lotNamesToDeliver.has("S/L") && (itemLotName === "S/L" || altNames.length === 0));

        if (isMatch) {
          const matchingPending = items.find(i => altNames.includes(i.lotNumber.toUpperCase())) || items[0];
          const entryId = item.parentIngresoMaestro || matchingPending?.parentIngresoMaestro;
          const bestLotName = (altNames.find(n => n !== "S/L") || itemLotName);
          if (entryId && bestLotName && bestLotName !== "S/L") {
            if (!entriesToUpdate.has(entryId)) entriesToUpdate.set(entryId, new Set());
            entriesToUpdate.get(entryId)!.add(bestLotName);
          }
          return {
            ...item,
            isClientDelivered: true,
            clientDeliveryTimestamp: matchingPending?.deliveredAt || items[0]?.deliveredAt || new Date().toISOString(),
            entregadoPor: matchingPending?.deliveredBy || items[0]?.deliveredBy || "sistema",
          };
        }
        return item;
      });

      const allDelivered = updatedItemsDispatched.length === 0 
        ? hasGuiaDelivery 
        : updatedItemsDispatched.every((i: any) => i.isClientDelivered === true);

      batch.update(outputRef, {
        itemsDispatched: updatedItemsDispatched,
        isClientDelivered: allDelivered,
        status: allDelivered ? "completed" : (outputData.status || "in_transit"),
        clientDeliveryTimestamp: items[0]?.deliveredAt || new Date().toISOString(),
        entregadoPor: items[0]?.deliveredBy || "sistema",
        updatedAt: serverTimestamp(),
      });

      // Actualizar los ingresos maestros asociados
      for (const [entryId, lotNumbers] of entriesToUpdate.entries()) {
        try {
          const entryRef = doc(db, "entries", entryId);
          const entrySnap = await withTimeout(getDoc(entryRef), 3000);
          if (entrySnap.exists()) {
            const entryData = entrySnap.data();
            const updatedLotes = (entryData.lotes || []).map((l: any) => {
              const lid = getVisibleLotNameFn(l).toUpperCase();
              const altLids = [
                lid,
                l.entryLotNumber ? String(l.entryLotNumber).toUpperCase() : "",
                l.lotNumber ? String(l.lotNumber).toUpperCase() : "",
                l.loteId ? String(l.loteId).toUpperCase() : "",
                l.numeroLote ? String(l.numeroLote).toUpperCase() : "",
              ].filter(Boolean);

              if (altLids.some(name => lotNumbers.has(name))) {
                return { ...l, productionStatus: "Completed", status: "ready" };
              }
              return l;
            });
            batch.update(entryRef, { lotes: updatedLotes, updatedAt: serverTimestamp() });
          }
        } catch (entryErr) {
          console.warn(`Aviso al actualizar ingreso ${entryId} en sincronización:`, entryErr);
        }
      }

      await withTimeout(batch.commit(), 4000);
      items.forEach(i => syncedIds.push(i.id));
    } catch (err) {
      console.warn(`Aviso al sincronizar salida ${outputId} (red no disponible o timeout):`, err);
      errors.push({ outputId, error: err });
    }
  }

  // Eliminar los procesados exitosamente
  if (syncedIds.length > 0) {
    removePendingDeliveries(syncedIds);
  }

  return {
    success: errors.length === 0,
    syncedCount: syncedIds.length,
    errors,
  };
}

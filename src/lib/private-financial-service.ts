import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  PrivateMovement, 
  PrivateContact, 
  PrivateCategory, 
  INITIAL_EXPENSE_CATEGORIES 
} from "@/types/private-financial";

const MOVEMENTS_COL = "private_financial_movements";
const CONTACTS_COL = "private_financial_contacts";
const CATEGORIES_COL = "private_financial_categories";

/**
 * Verifica si ya existe un movimiento idéntico para evitar duplicados.
 */
export function findPotentialDuplicate(
  movements: PrivateMovement[], 
  candidate: { date: string; contactName: string; amount: number; reference?: string; excludeId?: string }
): PrivateMovement | null {
  const normName = candidate.contactName.trim().toUpperCase();
  const normRef = (candidate.reference || "").trim().toUpperCase();

  const match = movements.find(m => {
    if (m.status !== "ACTIVO") return false;
    if (candidate.excludeId && m.id === candidate.excludeId) return false;
    
    const sameDate = m.date === candidate.date;
    const sameContact = m.contactName.trim().toUpperCase() === normName;
    const sameAmount = Math.abs(Number(m.amount) - Number(candidate.amount)) < 0.001;

    if (!sameDate || !sameContact || !sameAmount) return false;

    // Si ambos tienen referencia, deben coincidir
    if (normRef && m.reference) {
      return m.reference.trim().toUpperCase() === normRef;
    }

    return true;
  });

  return match || null;
}

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !(value instanceof Date) && !(value instanceof Timestamp)) {
        if (Array.isArray(value)) {
          cleaned[key] = value.filter(v => v !== undefined);
        } else if (value.constructor === Object) {
          cleaned[key] = removeUndefinedFields(value);
        } else {
          cleaned[key] = value;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

/**
 * Guarda o actualiza un movimiento en la colección privada.
 */
export async function savePrivateMovement(
  movement: Omit<PrivateMovement, "id" | "createdAt" | "updatedAt"> & { id?: string },
  userEmail: string
): Promise<string> {
  const isUpdate = !!movement.id;
  const docRef = isUpdate 
    ? doc(db, MOVEMENTS_COL, movement.id!) 
    : doc(collection(db, MOVEMENTS_COL));

  const safeEmail = userEmail || "admin";

  const payload: any = {
    id: docRef.id,
    type: movement.type,
    date: movement.date || new Date().toISOString().split("T")[0],
    contactName: (movement.contactName || "").trim().toUpperCase(),
    concept: (movement.concept || "").trim(),
    amount: Number(movement.amount) || 0,
    paymentMethod: movement.paymentMethod || "Transferencia Bancaria",
    dateTimeMs: movement.date ? new Date(movement.date + "T12:00:00").getTime() : Date.now(),
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail
  };

  if (movement.bank && movement.bank.trim()) {
    payload.bank = movement.bank.trim();
  }
  if (movement.reference && movement.reference.trim()) {
    payload.reference = movement.reference.trim().toUpperCase();
  }
  if (movement.notes && movement.notes.trim()) {
    payload.notes = movement.notes.trim();
  }
  if (movement.type === "gasto_general" && movement.category) {
    payload.category = movement.category;
  }

  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = safeEmail;
    payload.status = "ACTIVO";
  }

  // Sanitizar absolutamente cualquier campo undefined antes de pasar a setDoc
  const sanitized = removeUndefinedFields(payload);

  await setDoc(docRef, sanitized, { merge: true });

  // Guardar contacto en catálogo si no existe
  if (movement.contactName) {
    const contactType = movement.type === "cobro_cliente" ? "cliente" : "proveedor";
    await addPrivateContact(movement.contactName, contactType, safeEmail).catch(() => {});
  }

  // Guardar categoría si es gasto general y no existe
  if (movement.type === "gasto_general" && movement.category) {
    await addPrivateCategory(movement.category, safeEmail).catch(() => {});
  }

  return docRef.id;
}

/**
 * Anula un movimiento conservando el registro y motivo para auditoría.
 */
export async function annulPrivateMovement(
  movementId: string, 
  reason: string, 
  userEmail: string
): Promise<void> {
  const safeEmail = userEmail || "admin";
  const docRef = doc(db, MOVEMENTS_COL, movementId);
  await updateDoc(docRef, {
    status: "ANULADO",
    annulReason: reason.trim(),
    annulledAt: serverTimestamp(),
    annulledBy: safeEmail,
    updatedAt: serverTimestamp(),
    updatedBy: safeEmail
  });
}

/**
 * Gestión del Catálogo Privado de Contactos (Clientes / Proveedores)
 */
export async function addPrivateContact(name: string, type: "cliente" | "proveedor" | "beneficiario", userEmail: string): Promise<void> {
  const cleanName = name.trim().toUpperCase();
  if (!cleanName) return;

  const safeEmail = userEmail || "admin";
  const contactId = `${type}_${cleanName.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const docRef = doc(db, CONTACTS_COL, contactId);

  await setDoc(docRef, {
    id: contactId,
    name: cleanName,
    type,
    createdAt: serverTimestamp(),
    createdBy: safeEmail
  }, { merge: true });
}

/**
 * Gestión del Catálogo Privado de Categorías de Gastos
 */
export async function addPrivateCategory(name: string, userEmail: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) return;

  const safeEmail = userEmail || "admin";
  const catId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const docRef = doc(db, CATEGORIES_COL, catId);

  await setDoc(docRef, {
    id: catId,
    name: cleanName,
    createdAt: serverTimestamp(),
    createdBy: safeEmail
  }, { merge: true });
}

/**
 * Inicializa las categorías por defecto si la colección está vacía.
 */
export async function seedInitialCategories(userEmail: string): Promise<void> {
  const snap = await getDocs(collection(db, CATEGORIES_COL));
  if (snap.empty) {
    const promises = INITIAL_EXPENSE_CATEGORIES.map(cat => addPrivateCategory(cat, userEmail));
    await Promise.all(promises);
  }
}

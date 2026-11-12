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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
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
 * Sube un archivo a Firebase Storage en la ruta privada específica del módulo.
 * Si Storage falla o no está configurado, convierte a Base64 como fallback.
 */
export async function uploadPrivateVoucher(file: File): Promise<{ url: string; name: string; type: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}_${safeName}`;
  const storagePath = `private_financial/comprobantes/${fileName}`;

  try {
    if (storage) {
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream"
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return {
        url: downloadUrl,
        name: file.name,
        type: file.type
      };
    }
  } catch (err) {
    console.warn("Storage upload failed, attempting fallback to base64:", err);
  }

  // Fallback: Si el archivo es menor a 2.5MB, guardarlo como Data URL Base64
  return new Promise((resolve, reject) => {
    if (file.size > 2.5 * 1024 * 1024) {
      reject(new Error("El archivo supera el límite de 2.5MB permitido para almacenamiento directo."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name: file.name,
        type: file.type
      });
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

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

  const payload: any = {
    ...movement,
    id: docRef.id,
    contactName: movement.contactName.trim().toUpperCase(),
    concept: movement.concept.trim(),
    amount: Number(movement.amount) || 0,
    reference: (movement.reference || "").trim().toUpperCase(),
    notes: (movement.notes || "").trim(),
    dateTimeMs: movement.date ? new Date(movement.date + "T12:00:00").getTime() : Date.now(),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail
  };

  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = userEmail;
    payload.status = "ACTIVO";
  }

  await setDoc(docRef, payload, { merge: true });

  // Guardar contacto en catálogo si no existe
  if (movement.contactName) {
    const contactType = movement.type === "cobro_cliente" ? "cliente" : "proveedor";
    await addPrivateContact(movement.contactName, contactType, userEmail).catch(() => {});
  }

  // Guardar categoría si es gasto general y no existe
  if (movement.type === "gasto_general" && movement.category) {
    await addPrivateCategory(movement.category, userEmail).catch(() => {});
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
  const docRef = doc(db, MOVEMENTS_COL, movementId);
  await updateDoc(docRef, {
    status: "ANULADO",
    annulReason: reason.trim(),
    annulledAt: serverTimestamp(),
    annulledBy: userEmail,
    updatedAt: serverTimestamp(),
    updatedBy: userEmail
  });
}

/**
 * Gestión del Catálogo Privado de Contactos (Clientes / Proveedores)
 */
export async function addPrivateContact(name: string, type: "cliente" | "proveedor" | "beneficiario", userEmail: string): Promise<void> {
  const cleanName = name.trim().toUpperCase();
  if (!cleanName) return;

  const contactId = `${type}_${cleanName.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const docRef = doc(db, CONTACTS_COL, contactId);

  await setDoc(docRef, {
    id: contactId,
    name: cleanName,
    type,
    createdAt: serverTimestamp(),
    createdBy: userEmail
  }, { merge: true });
}

/**
 * Gestión del Catálogo Privado de Categorías de Gastos
 */
export async function addPrivateCategory(name: string, userEmail: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) return;

  const catId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const docRef = doc(db, CATEGORIES_COL, catId);

  await setDoc(docRef, {
    id: catId,
    name: cleanName,
    createdAt: serverTimestamp(),
    createdBy: userEmail
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

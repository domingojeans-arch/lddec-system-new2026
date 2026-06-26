/**
 * Formats a client name to ensure it follows the "LASTNAME FIRSTNAME" pattern.
 * If the name comes in as a single string (e.g. "OSCAR RECALDE"), it attempts to invert it.
 * 
 * Rules applied:
 * - 1 word: returned as is.
 * - 2 words: Word2 Word1.
 * - 3 words: Word3 Word1 Word2 (assumes 1 firstname, 2 lastnames).
 * - 4+ words: second half + first half.
 */
export function formatClientName(
  rawName: string | undefined | null,
  firstName?: string,
  lastName?: string
): string {
  if (!rawName) return "S/D";
  
  // Si tenemos campos separados, formateamos estrictamente como APELLIDOS NOMBRES
  if (lastName && firstName) {
    return `${lastName.trim()} ${firstName.trim()}`.toUpperCase().replace(/\s+/g, ' ');
  }
  
  const cleanName = rawName.trim().toUpperCase().replace(/\s+/g, ' ');
  const parts = cleanName.split(' ');

  if (parts.length <= 1) {
    return cleanName;
  }

  // Lista de nombres comunes para detectar si la cadena viene como "Nombres Apellidos"
  const COMMON_FIRST_NAMES = new Set([
    "JUAN", "MARIA", "JOSE", "LUIS", "CARLOS", "ANTONIO", "DIEGO", "FRANCISCO", 
    "MANUEL", "PEDRO", "JORGE", "JAIME", "MIGUEL", "ANGEL", "ANA", "CARMEN", 
    "ROSA", "MERCEDES", "SEGUNDO", "WILSON", "EDWIN", "OSCAR", "EDISON", "LIVINTONG", 
    "MARISOL", "VICTOR", "LAURA", "PATRICIA", "SANDRA", "MONICA", "GLORIA", "SILVIA", 
    "BEATRIZ", "ELIZABETH", "ALEXANDRA", "HECTOR", "RUTH", "MARTHA", "MILTON", "HUGO", 
    "CESAR", "WALTER", "GUIDO", "BYRON", "EDGAR", "JAVIER", "DANIEL", "ANDRES", 
    "ALEX", "CHRISTIAN", "PAULO", "PABLO", "GABRIEL", "ADRIAN", "JONATHAN", "SANTIAGO", 
    "SEBASTIAN", "MARCO", "RAMON", "HERNAN", "RENE", "FREDDY", "ALFREDO", "GUSTAVO", 
    "EFRAIN", "ROLANDO"
  ]);

  // Si la primera palabra es un nombre común, asumimos que viene como "Nombres Apellidos" y lo invertimos
  if (COMMON_FIRST_NAMES.has(parts[0])) {
    if (parts.length === 2) {
      // JUAN ALVARADO -> ALVARADO JUAN
      return `${parts[1]} ${parts[0]}`;
    }
    if (parts.length === 3) {
      // JUAN ALVARADO SANCHEZ -> ALVARADO SANCHEZ JUAN
      return `${parts[1]} ${parts[2]} ${parts[0]}`;
    }
    if (parts.length >= 4) {
      // Si tiene 4 o más palabras (ej: JUAN GABRIEL ALVARADO SANCHEZ)
      // Asumimos que los 2 primeros son nombres y el resto apellidos
      // Invertimos: Apellidos + Nombres
      const names = parts.slice(0, 2);
      const lastnames = parts.slice(2);
      return [...lastnames, ...names].join(' ');
    }
  }

  // De lo contrario, asumimos que ya está en formato "APELLIDOS NOMBRES" y lo devolvemos limpio
  return cleanName;
}

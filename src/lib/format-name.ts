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
export function formatClientName(rawName: string | undefined | null): string {
  if (!rawName) return "S/D";
  
  const cleanName = rawName.trim().toUpperCase().replace(/\s+/g, ' ');
  const parts = cleanName.split(' ');

  if (parts.length <= 1) {
    return cleanName;
  }

  // To avoid inverting already inverted names (like "RECALDE OSCAR") safely without a dictionary
  // is hard. But per instructions, if we assume they are "FirstName LastName" in the DB:
  if (parts.length === 2) {
    // OSCAR RECALDE -> RECALDE OSCAR
    return `${parts[1]} ${parts[0]}`;
  }

  if (parts.length === 3) {
    // LUIS PEREZ LOPEZ -> PEREZ LOPEZ LUIS
    return `${parts[1]} ${parts[2]} ${parts[0]}`;
  }

  // 4 or more words (e.g. LUIS ANTONIO PEREZ LOPEZ -> PEREZ LOPEZ LUIS ANTONIO)
  const mid = Math.floor(parts.length / 2);
  const firstHalf = parts.slice(0, mid);
  const secondHalf = parts.slice(mid);

  return [...secondHalf, ...firstHalf].join(' ');
}

// Empreinte courte d'un texte (FNV-1a 32 bits, 8 caractères hexadécimaux) : de quoi savoir si
// un menu ou un frigo a changé depuis le calcul d'une liste. Pas une protection.
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

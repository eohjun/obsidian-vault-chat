/**
 * Hash-based note ID generation.
 * Must match Vault Embeddings implementation.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateNoteId(path: string): string {
  const pathWithoutExt = path.replace(/\.md$/, '');
  return simpleHash(pathWithoutExt);
}

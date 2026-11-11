/**
 * Computes a deterministic SHA-256 hexadecimal hash string for string or binary input.
 * Compatible with Node.js 18+ and modern Web Cryptography API.
 */
export async function computeSha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

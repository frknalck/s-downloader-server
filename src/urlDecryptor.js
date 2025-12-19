/**
 * URL Decryption Module
 * Ported from Sownloader C# implementation
 */

const SECRET_KEY = "TT18WlV5TXVeLXFXYn1WTF5qSmR9TXYpOHklYlFXWGY+SUZCRGNKPiU0emcyQ2l8dGVsamBkVlpA";

/**
 * Decodes a base64-like character pool from the key
 * @param {string} key - The encoded key string
 * @returns {string} - The decoded character pool
 */
function registerCharPool(key) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const k = {};

  // Create lookup dictionary
  for (let i = 0; i < 64; i++) {
    k[alphabet[i]] = i;
  }

  let charPool = "";
  let l = 0;
  let c = 0;
  const h = key.length;

  for (let d = 0; d < h; d++) {
    const index = key[d];
    const a = k[index] !== undefined ? k[index] : 0;

    l = (l << 6) + a;
    c += 6;

    while (c >= 8) {
      c -= 8;
      const b = (l >> c) & 255;

      if (b !== 0 || d < h - 2) {
        charPool += String.fromCharCode(b);
      }
    }
  }

  return charPool;
}

// Pre-compute the secret character pool
const REGISTERED_SECRET_CHAR_POOL = registerCharPool(SECRET_KEY);

/**
 * Processes and decrypts an encoded recording URL
 * @param {string} urlEncoded - The encoded URL (starts with "e:")
 * @returns {string} - The decrypted URL or original if not encoded
 */
export function processRecording(urlEncoded) {
  // Check if URL is encoded
  if (urlEncoded.length < 2 || !urlEncoded.startsWith("e:")) {
    return urlEncoded;
  }

  // Extract and decode the public character pool
  const publicCharPool = registerCharPool(urlEncoded.substring(2));

  // Initialize permutation array
  const a = [];
  for (let i = 0; i < 256; i++) {
    a[i] = i;
  }

  // Key scheduling algorithm (KSA)
  let h = 0;
  for (let b = 0; b < 256; b++) {
    h = (h + a[b] + REGISTERED_SECRET_CHAR_POOL.charCodeAt(b % REGISTERED_SECRET_CHAR_POOL.length)) % 256;
    // Swap
    const temp = a[b];
    a[b] = a[h];
    a[h] = temp;
  }

  // Pseudo-random generation algorithm (PRGA) - XOR decryption
  let urlDecoded = "";
  let b = 0;
  h = 0;

  for (let e = 0; e < publicCharPool.length; e++) {
    b = (b + 1) % 256;
    h = (h + a[b]) % 256;

    // Swap
    const temp = a[b];
    a[b] = a[h];
    a[h] = temp;

    // XOR with keystream
    const keystream = a[(a[b] + a[h]) % 256];
    urlDecoded += String.fromCharCode(publicCharPool.charCodeAt(e) ^ keystream);
  }

  // Validate the result starts with "http"
  if (!urlDecoded.startsWith("http")) {
    throw new Error(`Failed to decode URL: ${urlEncoded}; got: ${urlDecoded}`);
  }

  return urlDecoded;
}

/**
 * Decrypts media URL if encoded
 * @param {string} mediaUrl - The media URL (may be encoded with "e:" prefix)
 * @returns {string} - The decrypted URL
 */
export function decryptMediaUrl(mediaUrl) {
  if (!mediaUrl) {
    return null;
  }
  return processRecording(mediaUrl);
}

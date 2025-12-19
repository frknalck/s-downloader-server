/**
 * Smule API Client
 * Handles requests to Smule's API with spoofed headers
 */

import axios from 'axios';
import { decryptMediaUrl } from './urlDecryptor.js';

const SMULE_API_BASE = 'https://www.smule.com';

/**
 * Generates a random User-Agent string
 * @returns {string}
 */
function generateRandomUserAgent() {
  const versions = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  return versions[Math.floor(Math.random() * versions.length)];
}

/**
 * Generates a random public IPv4 address
 * @returns {string}
 */
function generateRandomIPv4() {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

/**
 * Normalizes Smule URL to ensure proper format
 * @param {string} url - The Smule URL
 * @returns {string} - Normalized URL
 */
function normalizeSmuleUrl(url) {
  // Ensure https
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  if (!url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Ensure www
  if (url.startsWith('https://smule.com')) {
    url = url.replace('https://smule.com', 'https://www.smule.com');
  }

  return url;
}

/**
 * Extracts performance key from Smule URL
 * @param {string} url - The Smule URL
 * @returns {string|null} - The performance key or null
 */
export function extractPerformanceKey(url) {
  try {
    const normalizedUrl = normalizeSmuleUrl(url);
    const urlObj = new URL(normalizedUrl);
    const pathParts = urlObj.pathname.split('/').filter(p => p);

    if (pathParts.length === 0) {
      return null;
    }

    // Handle different Smule URL formats:

    // Format 1: /p/PERFORMANCE_KEY
    // Example: https://www.smule.com/p/1234567890_1234567890
    if (pathParts[0] === 'p' && pathParts[1]) {
      return pathParts[1];
    }

    // Format 2: /recording/SONG_NAME/PERFORMANCE_KEY
    // Example: https://www.smule.com/recording/bruno-mars-uptown-funk/1234567890_1234567890
    if (pathParts[0] === 'recording' && pathParts.length >= 3) {
      return pathParts[pathParts.length - 1];
    }

    // Format 3: /recording/p/PERFORMANCE_KEY
    // Example: https://www.smule.com/recording/p/1234567890_1234567890
    if (pathParts[0] === 'recording' && pathParts[1] === 'p' && pathParts[2]) {
      return pathParts[2];
    }

    // Format 4: /sing-recording/PERFORMANCE_KEY
    // Example: https://www.smule.com/sing-recording/1234567890_1234567890
    if (pathParts[0] === 'sing-recording' && pathParts[1]) {
      return pathParts[1];
    }

    // Format 5: /sing/recording/PERFORMANCE_KEY
    // Example: https://www.smule.com/sing/recording/1234567890_1234567890
    if (pathParts[0] === 'sing' && pathParts[1] === 'recording' && pathParts[2]) {
      return pathParts[2];
    }

    // Format 6: /performance/PERFORMANCE_KEY
    // Example: https://www.smule.com/performance/1234567890_1234567890
    if (pathParts[0] === 'performance' && pathParts[1]) {
      return pathParts[1];
    }

    // Format 7: Direct performance key in any path with numbers and underscore
    // Try to find a performance key pattern (digits_digits or long digit string)
    for (const part of pathParts) {
      // Match pattern: 1234567890_1234567890 or single long number
      if (/^\d+_\d+$/.test(part) || /^\d{10,}$/.test(part)) {
        return part;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches performance data from Smule API
 * @param {string} performanceKey - The performance key
 * @returns {Promise<Object>} - The performance data
 */
export async function fetchPerformance(performanceKey) {
  const url = `${SMULE_API_BASE}/p/${performanceKey}/json`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': generateRandomUserAgent(),
        'Referer': 'http://www.google.com',
        'X-Forwarded-For': generateRandomIPv4(),
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Debug logging
    console.log(`✅ Fetched performance ${performanceKey}`);
    console.log(`   Has media_url: ${!!response.data.media_url}`);
    console.log(`   Has video_media_mp4_url: ${!!response.data.video_media_mp4_url}`);
    console.log(`   Title: ${response.data.title || 'N/A'}`);

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Smule API error for ${performanceKey}: ${error.response.status}`);
      throw new Error(`Smule API error: ${error.response.status} - ${error.response.statusText}`);
    }
    console.error(`❌ Failed to fetch ${performanceKey}: ${error.message}`);
    throw new Error(`Failed to fetch performance: ${error.message}`);
  }
}

/**
 * Processes Smule performance data and decrypts URLs
 * @param {Object} performanceData - Raw performance data from API
 * @returns {Object} - Processed performance with decrypted URLs
 */
export function processPerformanceData(performanceData) {
  const result = {
    key: performanceData.key || performanceData.performance_key,
    title: performanceData.title,
    artist: performanceData.artist,
    songLength: performanceData.song_length,
    createdAt: performanceData.created_at,
    coverUrl: performanceData.cover_url,
    videoMediaUrl: null,
    videoMediaMp4Url: null,
    mediaUrl: null,
    owner: performanceData.owner ? {
      accountId: performanceData.owner.account_id,
      handle: performanceData.owner.handle,
      pictureUrl: performanceData.owner.pic_url,
    } : null,
  };

  // Decrypt media URLs
  try {
    if (performanceData.media_url) {
      result.mediaUrl = decryptMediaUrl(performanceData.media_url);
    }
    if (performanceData.video_media_url) {
      result.videoMediaUrl = decryptMediaUrl(performanceData.video_media_url);
    }
    if (performanceData.video_media_mp4_url) {
      result.videoMediaMp4Url = decryptMediaUrl(performanceData.video_media_mp4_url);
    }
  } catch (error) {
    console.error('URL decryption error:', error);
    throw new Error('Failed to decrypt media URLs');
  }

  return result;
}

/**
 * Follows redirects to get the final Smule URL
 * @param {string} smuleUrl - The Smule URL that might redirect
 * @returns {Promise<string>} - The final URL after redirects
 */
async function followRedirects(smuleUrl) {
  try {
    const response = await axios.get(smuleUrl, {
      headers: {
        'User-Agent': generateRandomUserAgent(),
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Return the final URL after redirects
    return response.request.res.responseUrl || smuleUrl;
  } catch (error) {
    console.log(`Failed to follow redirects for ${smuleUrl}: ${error.message}`);
    return smuleUrl;
  }
}

/**
 * Gets complete performance data with decrypted URLs from a Smule URL
 * @param {string} smuleUrl - The Smule performance URL
 * @returns {Promise<Object>} - Processed performance data
 */
export async function getPerformanceFromUrl(smuleUrl) {
  let performanceKey = extractPerformanceKey(smuleUrl);

  // If we can't extract the key, try following redirects first
  if (!performanceKey) {
    console.log(`Could not extract key from ${smuleUrl}, trying to follow redirects...`);
    const redirectedUrl = await followRedirects(smuleUrl);
    performanceKey = extractPerformanceKey(redirectedUrl);

    if (!performanceKey) {
      throw new Error('Invalid Smule URL: Could not extract performance key');
    }

    console.log(`Found performance key after redirect: ${performanceKey}`);
  }

  try {
    const rawData = await fetchPerformance(performanceKey);
    return processPerformanceData(rawData);
  } catch (error) {
    // If we get a 404, try following redirects to get the correct URL
    if (error.message.includes('404')) {
      console.log(`Got 404 for ${performanceKey}, trying to follow redirects...`);
      const redirectedUrl = await followRedirects(smuleUrl);
      const newKey = extractPerformanceKey(redirectedUrl);

      if (newKey && newKey !== performanceKey) {
        console.log(`Trying with new key from redirect: ${newKey}`);
        const rawData = await fetchPerformance(newKey);
        return processPerformanceData(rawData);
      }
    }

    // Re-throw the original error if redirect didn't help
    throw error;
  }
}

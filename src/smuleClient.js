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

    // Handle different URL formats:
    // https://www.smule.com/p/1234567890/1234567890
    // https://www.smule.com/recording/username/song/1234567890

    if (pathParts[0] === 'p' && pathParts[1]) {
      return pathParts[1];
    }

    if (pathParts[0] === 'recording' && pathParts.length >= 3) {
      return pathParts[pathParts.length - 1];
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
 * Gets complete performance data with decrypted URLs from a Smule URL
 * @param {string} smuleUrl - The Smule performance URL
 * @returns {Promise<Object>} - Processed performance data
 */
export async function getPerformanceFromUrl(smuleUrl) {
  const performanceKey = extractPerformanceKey(smuleUrl);

  if (!performanceKey) {
    throw new Error('Invalid Smule URL: Could not extract performance key');
  }

  const rawData = await fetchPerformance(performanceKey);
  return processPerformanceData(rawData);
}

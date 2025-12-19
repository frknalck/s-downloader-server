/**
 * Download Manager
 * Handles file downloads and caching
 */

import axios from 'axios';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';

const DOWNLOAD_DIR = './downloads';
const CLEANUP_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

// Track downloads: { downloadId: { filePath, cleanupTimer, metadata } }
const downloadCache = new Map();

/**
 * Ensures download directory exists
 */
async function ensureDownloadDir() {
  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create download directory:', error);
  }
}

/**
 * Checks if a URL is directly accessible (returns 200-299 status)
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - True if accessible
 */
export async function isUrlAccessible(url) {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    return false;
  }
}

/**
 * Downloads a file from URL and saves it locally
 * @param {string} url - The URL to download from
 * @param {Object} metadata - Performance metadata
 * @returns {Promise<Object>} - Download info { downloadId, filePath }
 */
export async function downloadFile(url, metadata) {
  await ensureDownloadDir();

  const downloadId = uuidv4();
  const extension = metadata.videoMediaMp4Url ? '.mp4' : '.m4a';
  const fileName = `${downloadId}${extension}`;
  const filePath = path.join(DOWNLOAD_DIR, fileName);

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000, // 60 seconds
    });

    const writer = createWriteStream(filePath);
    await pipeline(response.data, writer);

    // Schedule cleanup
    const cleanupTimer = setTimeout(() => {
      cleanupDownload(downloadId);
    }, CLEANUP_TIMEOUT);

    // Store download info
    downloadCache.set(downloadId, {
      filePath,
      cleanupTimer,
      metadata: {
        title: metadata.title,
        artist: metadata.artist,
        createdAt: Date.now(),
        extension,
      },
    });

    console.log(`File downloaded successfully: ${downloadId}`);

    return {
      downloadId,
      filePath,
      fileName,
    };
  } catch (error) {
    // Clean up partial file if exists
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      // Ignore unlink errors
    }

    throw new Error(`Download failed: ${error.message}`);
  }
}

/**
 * Gets download info by ID
 * @param {string} downloadId - The download ID
 * @returns {Object|null} - Download info or null
 */
export function getDownloadInfo(downloadId) {
  return downloadCache.get(downloadId) || null;
}

/**
 * Cleans up a download (deletes file and removes from cache)
 * @param {string} downloadId - The download ID
 */
export async function cleanupDownload(downloadId) {
  const downloadInfo = downloadCache.get(downloadId);

  if (!downloadInfo) {
    return;
  }

  // Clear cleanup timer
  if (downloadInfo.cleanupTimer) {
    clearTimeout(downloadInfo.cleanupTimer);
  }

  // Delete file
  try {
    await fs.unlink(downloadInfo.filePath);
    console.log(`Cleaned up download: ${downloadId}`);
  } catch (error) {
    console.error(`Failed to delete file: ${downloadInfo.filePath}`, error);
  }

  // Remove from cache
  downloadCache.delete(downloadId);
}

/**
 * Manually trigger cleanup for a download
 * @param {string} downloadId - The download ID
 * @returns {Promise<boolean>} - True if cleaned up successfully
 */
export async function manualCleanup(downloadId) {
  if (!downloadCache.has(downloadId)) {
    return false;
  }

  await cleanupDownload(downloadId);
  return true;
}

/**
 * Gets statistics about downloads
 * @returns {Object} - Download statistics
 */
export function getStats() {
  return {
    activeDownloads: downloadCache.size,
    downloads: Array.from(downloadCache.entries()).map(([id, info]) => ({
      id,
      fileName: path.basename(info.filePath),
      metadata: info.metadata,
    })),
  };
}

// Initialize download directory on module load
ensureDownloadDir();

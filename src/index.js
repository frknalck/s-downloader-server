/**
 * Smule Downloader API Server
 * Main Express application
 */

import express from 'express';
import { getPerformanceFromUrl } from './smuleClient.js';
import { isUrlAccessible, downloadFile, getDownloadInfo, manualCleanup, getStats } from './downloadManager.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Enable CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Process Smule URL and return download information
 * POST /api/process
 * Body: { url: "https://www.smule.com/..." }
 *
 * Returns both video and audio URLs for app to choose
 */
app.post('/api/process', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing required parameter: url',
    });
  }

  try {
    console.log(`Processing URL: ${url}`);

    // Step 1: Fetch and decrypt performance data
    const performance = await getPerformanceFromUrl(url);

    if (!performance.mediaUrl && !performance.videoMediaMp4Url) {
      return res.status(404).json({
        error: 'No media found for this performance',
      });
    }

    // Build response with both video and audio options
    const response = {
      title: performance.title,
      artist: performance.artist,
      coverUrl: performance.coverUrl,
      duration: performance.songLength,
      owner: performance.owner,
      video: {
        available: false,
        type: null,
        url: null,
      },
      audio: {
        available: false,
        type: null,
        url: null,
      },
    };

    // Process video URL if available
    if (performance.videoMediaMp4Url) {
      response.video.available = true;
      const videoAccessible = await isUrlAccessible(performance.videoMediaMp4Url);

      if (videoAccessible) {
        response.video.type = 'direct';
        response.video.url = performance.videoMediaMp4Url;
      } else {
        // Will need to proxy - but don't download yet, wait for user choice
        response.video.type = 'proxy';
        response.video.url = performance.videoMediaMp4Url;
      }
      console.log(`Video: ${response.video.type}`);
    }

    // Process audio URL if available
    if (performance.mediaUrl) {
      response.audio.available = true;
      const audioAccessible = await isUrlAccessible(performance.mediaUrl);

      if (audioAccessible) {
        response.audio.type = 'direct';
        response.audio.url = performance.mediaUrl;
      } else {
        response.audio.type = 'proxy';
        response.audio.url = performance.mediaUrl;
      }
      console.log(`Audio: ${response.audio.type}`);
    }

    console.log(`✅ Processed: ${performance.title} | Video: ${response.video.available} | Audio: ${response.audio.available}`);

    return res.json(response);

  } catch (error) {
    console.error('Error processing URL:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process URL',
    });
  }
});

/**
 * Proxy download - downloads file through server when direct access fails
 * POST /api/proxy-download
 * Body: { url: "https://...", type: "video" | "audio", title: "Song Name" }
 */
app.post('/api/proxy-download', async (req, res) => {
  const { url, type, title } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing required parameter: url',
    });
  }

  try {
    console.log(`Proxy downloading: ${type} - ${title || 'Unknown'}`);

    const metadata = {
      title: title || 'download',
      videoMediaMp4Url: type === 'video' ? url : null,
    };

    const downloadInfo = await downloadFile(url, metadata);
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/download/${downloadInfo.downloadId}`;

    return res.json({
      success: true,
      downloadUrl,
      downloadId: downloadInfo.downloadId,
    });

  } catch (error) {
    console.error('Proxy download error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to download file',
    });
  }
});

/**
 * Download file by ID
 * GET /api/download/:id
 */
app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;

  const downloadInfo = getDownloadInfo(id);

  if (!downloadInfo) {
    return res.status(404).json({
      error: 'Download not found or expired',
    });
  }

  // Set proper headers
  const fileName = `${downloadInfo.metadata.title || 'download'}${downloadInfo.metadata.extension}`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', downloadInfo.metadata.extension === '.mp4' ? 'video/mp4' : 'audio/mp4');

  // Stream the file
  res.sendFile(downloadInfo.filePath, { root: process.cwd() }, (error) => {
    if (error) {
      console.error('Error sending file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to send file' });
      }
    } else {
      console.log(`File sent successfully: ${id}`);
    }
  });
});

/**
 * Check download status
 * GET /api/status/:id
 */
app.get('/api/status/:id', (req, res) => {
  const { id } = req.params;

  const downloadInfo = getDownloadInfo(id);

  if (!downloadInfo) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Download not found or expired',
    });
  }

  res.json({
    status: 'ready',
    downloadId: id,
    metadata: downloadInfo.metadata,
  });
});

/**
 * Manually cleanup a download
 * DELETE /api/cleanup/:id
 */
app.delete('/api/cleanup/:id', async (req, res) => {
  const { id } = req.params;

  const success = await manualCleanup(id);

  if (success) {
    return res.json({
      success: true,
      message: 'Download cleaned up successfully',
    });
  }

  return res.status(404).json({
    success: false,
    error: 'Download not found',
  });
});

/**
 * Get server statistics
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`🚀 Smule Downloader API Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
});

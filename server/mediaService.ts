import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const MEDIA_CACHE_DIR = path.resolve(process.cwd(), 'data', 'media_cache');
if (!fs.existsSync(MEDIA_CACHE_DIR)) {
  fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
}

export interface MediaMetadata {
  duration?: number;
  width?: number;
  height?: number;
  posterPath?: string;
  masterPlaylistPath?: string;
  availableQualities: string[];
  thumbnailPath?: string;
  mediumPath?: string;
}

// In-flight processing lock to prevent duplicate concurrent FFmpeg jobs
const activeProcessingJobs = new Map<string, Promise<MediaMetadata>>();

export async function probeMedia(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration:stream=width,height,codec_type -of json "${filePath}"`
    );
    const data = JSON.parse(stdout);
    const duration = parseFloat(data.format?.duration || '0');
    const videoStream = (data.streams || []).find((s: any) => s.codec_type === 'video');
    const width = videoStream?.width || 1280;
    const height = videoStream?.height || 720;
    return { duration, width, height };
  } catch (err) {
    console.warn('Probe media failed:', err);
    return { duration: 0, width: 1280, height: 720 };
  }
}

export function processVideoMedia(lessonId: string, inputFilePath: string): Promise<MediaMetadata> {
  // If this lesson is already being processed, return the active promise
  if (activeProcessingJobs.has(lessonId)) {
    return activeProcessingJobs.get(lessonId)!;
  }

  const jobPromise = (async () => {
    const itemDir = path.join(MEDIA_CACHE_DIR, lessonId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }

    const posterPath = path.join(itemDir, 'poster.jpg');
    const hlsDir = path.join(itemDir, 'hls');
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }

    const { duration, width, height } = await probeMedia(inputFilePath);

    // 1. Extract Poster at 1 second (or 0)
    try {
      await execAsync(`ffmpeg -y -ss 00:00:01 -i "${inputFilePath}" -vframes 1 -q:v 3 "${posterPath}"`);
    } catch (e) {
      try {
        await execAsync(`ffmpeg -y -ss 00:00:00 -i "${inputFilePath}" -vframes 1 -q:v 3 "${posterPath}"`);
      } catch (err) {
        console.warn('Failed to extract poster image:', err);
      }
    }

    // Determine allowed qualities strictly <= original source resolution
    const availableQualities: string[] = ['360p'];
    if (height >= 480) availableQualities.push('480p');
    if (height >= 720) availableQualities.push('720p');
    if (height >= 1080) availableQualities.push('1080p');

    // 2. Generate HLS Adaptive Streams with proper bandwidth tags
    try {
      // 360p (Baseline rendition)
      const dir360 = path.join(hlsDir, '360p');
      if (!fs.existsSync(dir360)) fs.mkdirSync(dir360, { recursive: true });
      await execAsync(
        `ffmpeg -y -i "${inputFilePath}" -vf "scale=636:360:force_original_aspect_ratio=decrease,pad=636:360:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -b:v 800k -maxrate 900k -bufsize 1200k -preset veryfast -c:a aac -b:a 96k -hls_time 6 -hls_list_size 0 -hls_segment_filename "${dir360}/seg_%03d.ts" "${dir360}/index.m3u8"`
      );

      let masterContent = `#EXTM3U\n#EXT-X-VERSION:3\n`;
      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=896000,AVERAGE-BANDWIDTH=800000,RESOLUTION=636x360,FRAME-RATE=30.000,CODECS="avc1.4d401f,mp4a.40.2"\n360p/index.m3u8\n`;

      // 480p rendition
      if (height >= 480 && availableQualities.includes('480p')) {
        const dir480 = path.join(hlsDir, '480p');
        if (!fs.existsSync(dir480)) fs.mkdirSync(dir480, { recursive: true });
        await execAsync(
          `ffmpeg -y -i "${inputFilePath}" -vf "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -b:v 1400k -maxrate 1600k -bufsize 2100k -preset veryfast -c:a aac -b:a 128k -hls_time 6 -hls_list_size 0 -hls_segment_filename "${dir480}/seg_%03d.ts" "${dir480}/index.m3u8"`
        );
        masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=1528000,AVERAGE-BANDWIDTH=1400000,RESOLUTION=854x480,FRAME-RATE=30.000,CODECS="avc1.4d401f,mp4a.40.2"\n480p/index.m3u8\n`;
      }

      // 720p rendition
      if (height >= 720 && availableQualities.includes('720p')) {
        const dir720 = path.join(hlsDir, '720p');
        if (!fs.existsSync(dir720)) fs.mkdirSync(dir720, { recursive: true });
        await execAsync(
          `ffmpeg -y -i "${inputFilePath}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -b:v 2800k -maxrate 3100k -bufsize 4200k -preset veryfast -c:a aac -b:a 128k -hls_time 6 -hls_list_size 0 -hls_segment_filename "${dir720}/seg_%03d.ts" "${dir720}/index.m3u8"`
        );
        masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=2928000,AVERAGE-BANDWIDTH=2800000,RESOLUTION=1280x720,FRAME-RATE=30.000,CODECS="avc1.4d401f,mp4a.40.2"\n720p/index.m3u8\n`;
      }

      // 1080p rendition
      if (height >= 1080 && availableQualities.includes('1080p')) {
        const dir1080 = path.join(hlsDir, '1080p');
        if (!fs.existsSync(dir1080)) fs.mkdirSync(dir1080, { recursive: true });
        await execAsync(
          `ffmpeg -y -i "${inputFilePath}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -b:v 5000k -maxrate 5500k -bufsize 7500k -preset veryfast -c:a aac -b:a 128k -hls_time 6 -hls_list_size 0 -hls_segment_filename "${dir1080}/seg_%03d.ts" "${dir1080}/index.m3u8"`
        );
        masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=5128000,AVERAGE-BANDWIDTH=4800000,RESOLUTION=1920x1080,FRAME-RATE=30.000,CODECS="avc1.640028,mp4a.40.2"\n1080p/index.m3u8\n`;
      }

      const masterPath = path.join(hlsDir, 'master.m3u8');
      fs.writeFileSync(masterPath, masterContent, 'utf-8');

      return {
        duration,
        width,
        height,
        posterPath: fs.existsSync(posterPath) ? posterPath : undefined,
        masterPlaylistPath: masterPath,
        availableQualities,
      };
    } catch (err) {
      console.warn('HLS transcoding warning (falling back to range stream):', err);
      return {
        duration,
        width,
        height,
        posterPath: fs.existsSync(posterPath) ? posterPath : undefined,
        availableQualities: ['360p'],
      };
    } finally {
      activeProcessingJobs.delete(lessonId);
    }
  })();

  activeProcessingJobs.set(lessonId, jobPromise);
  return jobPromise;
}

export function processImageMedia(lessonId: string, inputFilePath: string): Promise<MediaMetadata> {
  if (activeProcessingJobs.has(lessonId)) {
    return activeProcessingJobs.get(lessonId)!;
  }

  const jobPromise = (async () => {
    const itemDir = path.join(MEDIA_CACHE_DIR, lessonId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }

    const thumbPath = path.join(itemDir, 'thumb.jpg');
    const mediumPath = path.join(itemDir, 'medium.jpg');

    try {
      await execAsync(`ffmpeg -y -i "${inputFilePath}" -vf "scale=300:-1" -q:v 5 "${thumbPath}"`);
      await execAsync(`ffmpeg -y -i "${inputFilePath}" -vf "scale=800:-1" -q:v 4 "${mediumPath}"`);
    } catch (err) {
      console.warn('Image variant generation warning:', err);
    }

    const { width, height } = await probeMedia(inputFilePath);

    return {
      width,
      height,
      thumbnailPath: fs.existsSync(thumbPath) ? thumbPath : undefined,
      mediumPath: fs.existsSync(mediumPath) ? mediumPath : undefined,
      availableQualities: [],
    };
  })().finally(() => {
    activeProcessingJobs.delete(lessonId);
  });

  activeProcessingJobs.set(lessonId, jobPromise);
  return jobPromise;
}

/**
 * Cache cleanup helper to remove stale media caches older than specified days
 */
export function cleanupMediaCache(maxAgeDays = 30): void {
  try {
    if (!fs.existsSync(MEDIA_CACHE_DIR)) return;
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    const items = fs.readdirSync(MEDIA_CACHE_DIR);
    for (const item of items) {
      const itemPath = path.join(MEDIA_CACHE_DIR, item);
      const stat = fs.statSync(itemPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    }
  } catch (err) {
    console.warn('Media cache cleanup warning:', err);
  }
}

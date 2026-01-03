import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { readdir, readFile, stat, writeFile, mkdir } from "fs/promises";
import { join, relative, dirname } from "path";
import path from "path";
import * as cliProgress from "cli-progress"; 
import { Song } from "../types/godot";
import logger from "./logger";

const getS3Config = () => {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials are required.');
  }

  return new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    region,
  });
};

const getContentType = (fileName: string) => {
  const ext = fileName.toLowerCase().split('.').pop();
  const contentTypes: { [key: string]: string } = {
    'json': 'application/json',
    'ogg': 'audio/ogg',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'mpd': 'application/dash+xml',
    'm4s': 'video/iso.segment',
    'webm': 'video/webm',
    'mp4': 'video/mp4'
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
};

const uploadFile = async (s3: S3Client, bucketName: string, filePath: string, bucketKey: string) => {
  try {
    const fileContent = await readFile(filePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: bucketKey,
        Body: fileContent,
        ContentType: getContentType(filePath),
      })
    );
  } catch (error) {
    logger.error(`Failed to upload ${bucketKey}:`, error);
    throw error;
  }
};

const getAllFiles = async (dirPath: string): Promise<string[]> => {
  const files: string[] = [];
  const items = await readdir(dirPath);
  for (const item of items) {
    const fullPath = join(dirPath, item);
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

const createProgressBar = (total: number) => {
  return new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total}',
    hideCursor: true,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
};

const uploadSong = async (song: Song, mapFolder: string) => {
  const s3 = getS3Config();
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var is missing");

  const { mapName, version } = song;
  const bucketPath = `songs/${mapName}_${version}`;

  try {
    const allFiles = await getAllFiles(mapFolder);
    logger.info(`Uploading ${allFiles.length} files to ${bucket}/${bucketPath}...`);

    const bar = createProgressBar(allFiles.length);
    bar.start(allFiles.length, 0);

    for (const filePath of allFiles) {
      const relativePath = relative(mapFolder, filePath);
      const s3Key = `${bucketPath}/${relativePath}`.replace(/\\/g, '/');
      await uploadFile(s3, bucket, filePath, s3Key);
      bar.increment();
    }
    
    bar.stop();
    logger.success(`Public Upload Complete.`);
  } catch (error) {
    throw error;
  }
};

const uploadDash = async (mapName: string, dashFolder: string) => {
  const s3 = getS3Config();
  const bucket = process.env.S3_BUCKET_PRIVATE;
  
  if (!bucket) throw new Error("S3_BUCKET_PRIVATE env var is missing");

  const bucketPath = `dash/${mapName}`;

  try {
    const allFiles = await getAllFiles(dashFolder);
    logger.info(`Uploading ${allFiles.length} DASH segments to ${bucket}/${bucketPath}...`);

    const bar = createProgressBar(allFiles.length);
    bar.start(allFiles.length, 0);

    for (const filePath of allFiles) {
      const relativePath = relative(dashFolder, filePath);
      const s3Key = `${bucketPath}/${relativePath}`.replace(/\\/g, '/');
      await uploadFile(s3, bucket, filePath, s3Key);
      bar.increment();
    }

    bar.stop();
    logger.success(`Private DASH Upload Complete.`);
  } catch (error) {
    throw error;
  }
};

const checkDashExists = async (mapName: string): Promise<boolean> => {
    const s3 = getS3Config();
    const bucket = process.env.S3_BUCKET_PRIVATE;
    if (!bucket) throw new Error("S3_BUCKET_PRIVATE missing");

    const prefix = `dash/${mapName}/`;

    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 1
        });
        const response = await s3.send(command);
        return (response.Contents && response.Contents.length > 0) || false;
    } catch (error: any) {
        logger.error(`S3 Check Error: ${error.message}`);
        return false;
    }
};

const checkPreviewExists = async (mapName: string): Promise<boolean> => {
    const s3 = getS3Config();
    const bucket = process.env.S3_BUCKET_PRIVATE;
    if (!bucket) throw new Error("S3_BUCKET_PRIVATE missing");

    const key = `previews/${mapName}_VideoPreview.mp4`;

    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: key,
            MaxKeys: 1
        });
        const response = await s3.send(command);
        return (response.Contents && response.Contents.length > 0) || false;
    } catch (error: any) {
        logger.error(`S3 Preview Check Error: ${error.message}`);
        return false;
    }
};

const uploadPreview = async (mapName: string, filePath: string) => {
    const s3 = getS3Config();
    const bucket = process.env.S3_BUCKET_PRIVATE;
    if (!bucket) throw new Error("S3_BUCKET_PRIVATE missing");

    const key = `previews/${mapName}_VideoPreview.mp4`;

    try {
        await uploadFile(s3, bucket, filePath, key);
        logger.success(`Preview uploaded to s3://${bucket}/${key}`);
    } catch (error) {
        throw error;
    }
};



const listDashMaps = async (): Promise<string[]> => {
    const s3 = getS3Config();
    const bucket = process.env.S3_BUCKET_PRIVATE;
    if (!bucket) throw new Error("S3_BUCKET_PRIVATE missing");

    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: "dash/",
            Delimiter: "/" 
        });

        const response = await s3.send(command);
        if (response.CommonPrefixes) {
            return response.CommonPrefixes
                .map(p => p.Prefix)
                .filter((p): p is string => !!p)
                .map(p => p.replace("dash/", "").replace("/", ""));
        }
        return [];
    } catch (error: any) {
        logger.error(`Failed to list DASH maps: ${error.message}`);
        return [];
    }
};

/**
 * Optimized downloader: Fetches MPD, PRUNES all unused representations to prevent FFmpeg crashes,
 * and downloads ONLY the highest quality video + audio segments.
 */
const downloadBestDashStreams = async (mapName: string, outputDir: string) => {
    const s3 = getS3Config();
    const bucket = process.env.S3_BUCKET_PRIVATE;
    if (!bucket) throw new Error("S3_BUCKET_PRIVATE missing");

    const prefix = `dash/${mapName}/`;
    const mpdKey = `${prefix}master.mpd`;
    const localMpdPath = path.join(outputDir, "master.mpd");

    await mkdir(outputDir, { recursive: true });

    // 1. Download and Read MPD
    logger.info(`Fetching manifest for ${mapName}...`);
    let mpdContent = "";
    try {
        const getCmd = new GetObjectCommand({ Bucket: bucket, Key: mpdKey });
        const res = await s3.send(getCmd);
        if (res.Body) mpdContent = await res.Body.transformToString();
    } catch (e) {
        throw new Error(`Failed to download master.mpd: ${e}`);
    }

    // 2. Identify Best Video and Audio IDs
    const repRegex = /<Representation id="(\w+)"[^>]*bandwidth="(\d+)"[^>]*>/g;
    let bestVideoId = "";
    let maxBandwidth = 0;
    let audioId = "";

    let match;
    while ((match = repRegex.exec(mpdContent)) !== null) {
        const id = match[1];
        const bw = parseInt(match[2]);
        if (bw > 300000) {
            if (bw > maxBandwidth) { maxBandwidth = bw; bestVideoId = id; }
        } else { audioId = id; }
    }

    const targets = [bestVideoId, audioId].filter(Boolean);
    logger.info(`Selected Streams -> Video: ${bestVideoId}, Audio: ${audioId}`);

    // 3. Extract Filename Templates
    // This looks for things like "init-stream$RepresentationID$.m4s" or "chunk_$RepresentationID$_$Number$.m4s"
    const initTemplates: string[] = [];
    const mediaTemplates: string[] = [];
    
    const initMatch = mpdContent.match(/initialization="([^"]+)"/g);
    const mediaMatch = mpdContent.match(/media="([^"]+)"/g);

    initMatch?.forEach(m => initTemplates.push(m.split('"')[1]));
    mediaMatch?.forEach(m => mediaTemplates.push(m.split('"')[1]));

    // 4. Sanitize MPD (Strip paths and prune)
    mpdContent = mpdContent.replace(/(initialization|media)=".*?[\\/]([^"]+)"/g, '$1="$2"');
    mpdContent = mpdContent.replace(/<BaseURL>.*?<\/BaseURL>/g, "");
    
    const representationBlocks = mpdContent.match(/<Representation[\s\S]*?<\/Representation>/g) || [];
    for (const block of representationBlocks) {
        const idMatch = block.match(/id="(\w+)"/);
        if (idMatch && !targets.includes(idMatch[1])) {
            mpdContent = mpdContent.replace(block, ``);
        }
    }
    await writeFile(localMpdPath, mpdContent);

    // 5. Build Regex for S3 filtering based on the Templates we found
    // We replace $RepresentationID$ with our target IDs to find the exact filenames
    const targetFilePatterns = targets.flatMap(id => {
        return [...initTemplates, ...mediaTemplates].map(temp => {
            // Escape dots, replace $RepresentationID$ with ID, replace $Number...$ with wildcards
            let pattern = temp
                .replace(/\./g, '\\.')
                .replace(/\$RepresentationID\$/g, id)
                .replace(/\$Number.*?\$/g, '\\d+');
            return new RegExp(`^${pattern}$`);
        });
    });

    // 6. List and Filter S3 Files
    let continuationToken: string | undefined;
    const allKeys: string[] = [];
    do {
        const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken });
        const response = await s3.send(command);
        response.Contents?.forEach(c => { if (c.Key) allKeys.push(c.Key); });
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    const keysToDownload = allKeys.filter(key => {
        const fname = path.basename(key);
        return targetFilePatterns.some(regex => regex.test(fname));
    });

    if (keysToDownload.length === 0) {
        throw new Error(`No segments found on S3. Expected patterns for IDs ${targets.join(', ')} were not matched.`);
    }

    // 7. Download
    logger.info(`Downloading ${keysToDownload.length} segments for selected quality...`);
    const bar = new cliProgress.SingleBar({ format: 'Downloading Segments |{bar}| {percentage}% | {value}/{total}', hideCursor: true }, cliProgress.Presets.shades_classic);
    bar.start(keysToDownload.length, 0);

    for (const key of keysToDownload) {
        const localPath = path.join(outputDir, path.basename(key));
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (res.Body) {
            const byteArray = await res.Body.transformToByteArray();
            await writeFile(localPath, byteArray);
        }
        bar.increment();
    }
    bar.stop();
};

export {
  uploadSong,
  uploadDash,
  checkDashExists,
  checkPreviewExists,
  uploadPreview,
  downloadBestDashStreams,
  listDashMaps
};
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import * as cliProgress from "cli-progress"; // Import progress bar
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
    'webm': 'video/webm'
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

// Helper to Create & Manage Progress Bar
const createProgressBar = (total: number) => {
  return new cliProgress.SingleBar({
    format: 'Upload |{bar}| {percentage}% | {value}/{total} Files',
    hideCursor: true,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
};

// Original public upload
const uploadSong = async (song: Song, mapFolder: string) => {
  const s3 = getS3Config();
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var is missing");

  const { mapName, version } = song;
  const bucketPath = `songs/${mapName}_${version}`;

  try {
    const allFiles = await getAllFiles(mapFolder);
    logger.info(`Uploading ${allFiles.length} files to ${bucket}/${bucketPath}...`);

    // Initialize Progress Bar
    const bar = createProgressBar(allFiles.length);
    bar.start(allFiles.length, 0);

    for (const filePath of allFiles) {
      const relativePath = relative(mapFolder, filePath);
      const s3Key = `${bucketPath}/${relativePath}`.replace(/\\/g, '/');
      
      await uploadFile(s3, bucket, filePath, s3Key);
      
      // Update Progress
      bar.increment();
    }
    
    bar.stop();
    logger.success(`Public Upload Complete.`);
  } catch (error) {
    throw error;
  }
};

// New Private DASH upload
const uploadDash = async (mapName: string, dashFolder: string) => {
  const s3 = getS3Config();
  const bucket = process.env.S3_BUCKET_PRIVATE;
  
  if (!bucket) throw new Error("S3_BUCKET_PRIVATE env var is missing");

  const bucketPath = `dash/${mapName}`;

  try {
    const allFiles = await getAllFiles(dashFolder);
    logger.info(`Uploading ${allFiles.length} DASH segments to ${bucket}/${bucketPath}...`);

    // Initialize Progress Bar
    const bar = createProgressBar(allFiles.length);
    bar.start(allFiles.length, 0);

    for (const filePath of allFiles) {
      const relativePath = relative(dashFolder, filePath);
      const s3Key = `${bucketPath}/${relativePath}`.replace(/\\/g, '/');
      
      await uploadFile(s3, bucket, filePath, s3Key);
      
      // Update Progress
      bar.increment();
    }

    bar.stop();
    logger.success(`Private DASH Upload Complete.`);
  } catch (error) {
    throw error;
  }
};

export {
  uploadSong,
  uploadDash
};
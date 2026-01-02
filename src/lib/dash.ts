import fs from "fs";
import path from "path";
import logger from "./logger";
import { convertDash } from "./ffmpeg";
import config from "../config";

interface Quality {
    width: number;
    height: number;
    bitrate: string;
}

const QUALITIES: Quality[] = [
    { width: 1920, height: 1080, bitrate: "5000k" },
    { width: 1280, height: 720, bitrate: "3000k" },
    { width: 854, height: 480, bitrate: "1500k" },
];

/**
 * Converts a mixed video file into a DASH stream (MPEG-DASH).
 */
const processDash = async (
  mapName: string,
  videoInput: string,
  outputDir: string
): Promise<boolean> => {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, "master.mpd");
  logger.info(`Processing DASH stream for ${mapName} into ${outputDir}...`);
  
  const args: string[] = [
    "-i", videoInput,
    
    // Global settings
    "-r", `${config.VIDEOSCOACH_FPS || 60}`,
    "-g", String((config.VIDEOSCOACH_FPS || 60) * 2),
    "-keyint_min", String((config.VIDEOSCOACH_FPS || 60) * 2),
    "-sc_threshold", "0",
  ];
  
  // Map video streams (one per quality)
  QUALITIES.forEach((q, i) => {
    args.push(
      "-map", "0:v:0",
      "-c:v:" + i, "libx264",
      "-preset:v:" + i, "fast",
      "-profile:v:" + i, "main",
      "-pix_fmt:v:" + i, "yuv420p",
      "-b:v:" + i, q.bitrate,
      "-maxrate:v:" + i, q.bitrate,
      "-bufsize:v:" + i, String(parseInt(q.bitrate) * 2) + "k",
      "-s:v:" + i, `${q.width}x${q.height}`
    );
  });
  
  // Map audio stream
  if (config.MUTE_VIDEOSCOACH) {
    args.push("-an");
  } else {
    args.push(
      "-map", "0:a:0",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ac", "2",
      "-ar", "48000"
    );
  }
  
  // DASH output settings
  args.push(
    "-f", "dash",
    "-seg_duration", "4",
    "-use_timeline", "1",
    "-use_template", "1",
    "-min_seg_duration", "4000000",
    // FIX: Prepend outputDir so FFmpeg writes files to the correct folder, not root
    "-init_seg_name", path.join(outputDir, "init_$RepresentationID$.m4s"),
    "-media_seg_name", path.join(outputDir, "chunk_$RepresentationID$_$Number%05d$.m4s"),
    "-adaptation_sets", "id=0,streams=v id=1,streams=a",
    outputFile
  );
  
  try {
    await convertDash(args);
    logger.success(`DASH manifest created: ${outputFile}`);
    return true;
  } catch (err: any) {
    logger.error(`Failed to create DASH stream: ${err.message}`);
    return false;
  }
};

export default {
    processDash
};
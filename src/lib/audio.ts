import * as fs from 'fs';
import path from "path";
import { parseString } from 'xml2js';

import logger from "./logger";
import config from "../config";
import { convertAudio } from "./ffmpeg";
import { execSync } from 'child_process';
import { MusicTrack } from '../types/godot';

export const audioExtensions = [".wav"];

/**
 * Converts an audio file to the required Godot format.
 * @param input Input audio file
 * @param outputFolder Map output folder
 * @param isAmb Is ambient audio?
 * @returns 
 */
const convert = async (input: string, outputFolder: string, isAmb = false): Promise<boolean> => {
  const output = path.resolve(
    outputFolder,
    isAmb ? "audio/amb" : "audio",
    path.basename(input.toLowerCase().replace(path.extname(input), ".m4a")) // change extension to .m4a
  );
  const outputDir = path.dirname(output);

  if (fs.existsSync(output)) {
    logger.warn(`Audio file already exists, it will be overwritten!`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    await convertAudio(input, output, [
      "-ac", "2",             // stereo
      "-ar", "48000",         // sample rate
      "-c:a", "aac",          // AAC codec
      "-b:a", "192k"          // bitrate
    ]);
    return true;
  } catch (err: any) {
    logger.error(`Failed to convert main audio: ${err.message}`);
    return false;
  }
};

/**
 * Creates preview based on musicTrack preview values.
 * @param input Input of full audio
 * @param outputFolder Output folder for the preview
 * @param musicTrack Music track of the map
 * @returns 
 */
const createPreview = async (
  input: string,
  outputFolder: string,
  musicTrack: MusicTrack
): Promise<boolean> => {
  const output = path.resolve(
    outputFolder,
    "assets",
    path.basename(input.toLowerCase().replace(path.extname(input), ".mp3")) // use .mp3
  );
  const outputDir = path.dirname(output);

  if (fs.existsSync(output)) {
    logger.warn(`Audio preview already exists, it will be overwritten!`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const markers = musicTrack.markers.map(m => m / 48);
  const previewStart = markers[musicTrack.audioPreview.entry] || 0;
  const previewEnd = markers[musicTrack.audioPreview.loopEnd] || 30000;

  // ensure max 30s duration
  const maxDuration = 30000;
  const actualEnd = Math.min(previewEnd, previewStart + maxDuration);
  const duration = (actualEnd - previewStart) / 1000; // convert ms → seconds

  try {
    await convertAudio(input, output, [
      "-ss", (previewStart / 1000).toString(), // start position in seconds
      "-t", duration.toString(),               // clip length in seconds
      "-ac", "2",                              // stereo
      "-ar", "48000",                          // sample rate
      "-c:a", "libmp3lame",                    // MP3 codec
      "-b:a", "192k"                           // bitrate
    ]);
    return true;
  } catch (err: any) {
    logger.error(`Failed to convert audio preview: ${err.message}`);
    return false;
  }
};

export default {
  convert,
  createPreview
};
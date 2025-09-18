import * as fs from 'fs';
import path from "path";
import { parseString } from 'xml2js';

import logger from "./logger";
import config from "../config";
import { convertAudio } from "./ffmpeg";
import { execSync } from 'child_process';

export const audioExtensions = [".wav"];

/**
 * Converts an audio file to the required Godot format.
 * @param input Input audio file
 * @param outputFolder Map output folder
 * @param isAmb Is ambient audio?
 * @returns 
 */
const convert = async (input: string, outputFolder: string, isAmb = false): Promise<boolean> => {
  const output = path.resolve(outputFolder, isAmb ? "audio/amb" : "audio", path.basename(input.toLowerCase()));
  const outputDir = path.dirname(output);

  if (fs.existsSync(output)) {
    logger.warn(`Audio file already exists, it will be overwritten!`);
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  };

  try {
    await convertAudio(input, output, ["-ac", "2", "-ar", "48000", "-c:a", "pcm_f32le"]);
    return true;
  } catch (err: any) {
    logger.error(`Failed to convert main audio: ${err.message}`);
    return false;
  }
};

export default {
  convert
};
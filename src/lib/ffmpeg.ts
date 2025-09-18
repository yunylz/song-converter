import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import logger from "./logger";

/**
 * Converts an audio file with FFmpeg.
 * @param input Input audio file
 * @param output Output audio file
 * @param args Arguments
 * @returns 
 */
export const convertAudio = (input: string, output: string, args: string[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    const command: FfmpegCommand = ffmpeg(input);
    // Apply custom ffmpeg arguments if provided
    if (args.length > 0) {
      command.outputOptions(args);
    }
    command
      .on('start', (cmd) => {
      })
      .on('progress', (progress) => {
        logger.info(`Processing: ${progress.percent?.toFixed(2)}% done`);
      })
      .on('error', (err) => {
        logger.error(`Error converting audio: ${err.message}`);
        reject(err);
      })
      .on('end', () => {
        resolve();
      })
      .save(output);
  });
};

/**
 * Gets the sample rate of an audio file.
 * @param inputAudio Input audio file
 * @returns Sample rate in Hz
 */
export const getSampleRate = (inputAudio: string): number => {
  try {
    // Method 1: Try to find Nuendo XML in metadata
    const nuendoSampleRate = extractNuendoSampleRate(inputAudio);
    if (nuendoSampleRate > 0) {
      return nuendoSampleRate;
    }

    // Method 2: Fallback to WAV sample rate using ffprobe
    const ffprobeCmd = `ffprobe -v quiet -print_format json -show_streams "${inputAudio}"`;
    const output = execSync(ffprobeCmd, { encoding: 'utf8' });
    const data = JSON.parse(output);
    
    const audioStream = data.streams.find((stream: any) => stream.codec_type === 'audio');
    if (audioStream?.sample_rate) {
      return parseInt(audioStream.sample_rate);
    }

    return 44100; // Default fallback
  } catch (error) {
    logger.error('Error extracting sample rate:', error);
    return 44100;
  }
};

/**
 * Extracts Nuendo beat markers from the audio file metadata.
 * @param inputAudio Input audio file
 * @returns Array of beat marker positions in milliseconds
 */
export const extractBeatMarkers = (inputAudio: string): number[] => {
  try {
    const metadataCmd = `ffmpeg -i "${inputAudio}" -f ffmetadata - 2>/dev/null || echo ""`;
    const metadata = execSync(metadataCmd, { encoding: 'utf8' });
    
    const markers: number[] = [];
    const lines = metadata.split('\n');
    
    let currentTimebase = 1;
    for (const line of lines) {
      if (line.startsWith('TIMEBASE=')) {
        const timebaseMatch = line.match(/TIMEBASE=1\/(\d+)/);
        if (timebaseMatch) {
          currentTimebase = parseInt(timebaseMatch[1]);
        }
      } else if (line.startsWith('START=')) {
        const startMatch = line.match(/START=(\d+)/);
        if (startMatch) {
          const startSample = parseInt(startMatch[1]);
          // Convert to milliseconds: (samples / sampleRate) * 1000
          const startMs = (startSample / currentTimebase) * 1000;
          markers.push(Math.round(startMs));
        }
      }
    }
    
    return markers.length > 0 ? markers : [0, 500]; // Default if no markers found
    
  } catch (error) {
    logger.error('Error extracting beat markers:', error);
    return [0, 500]; // Default markers
  }
};

/**
 * Extracts the Nuendo sample rate from the audio file metadata.
 * @param inputAudio Input audio file
 * @returns Nuendo sample rate in Hz
 */
const extractNuendoSampleRate = (inputAudio: string): number => {
  try {
    // Try to extract any XML metadata that might contain Nuendo data
    const xmlCmd = `ffmpeg -i "${inputAudio}" -map_metadata 0 -f wav - 2>/dev/null | strings | grep -E "<?xml|<obj|SampleRate" | head -10`;
    const xmlOutput = execSync(xmlCmd, { encoding: 'utf8' });
    
    if (xmlOutput.trim()) {
      // Look for sample rate patterns in the XML
      const sampleRateMatch = xmlOutput.match(/SampleRate[">:=\s]*(\d+)/i);
      if (sampleRateMatch) {
        return parseInt(sampleRateMatch[1]);
      }
    }
    
    return 0; // No Nuendo data found
    
  } catch (error) {
    return 0; // No Nuendo data found
  }
};
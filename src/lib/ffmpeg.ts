import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { execSync, spawn } from 'child_process'; // Added spawn
import cliProgress from "cli-progress";
import logger from "./logger";
import path from 'path';

// Try to resolve ffmpeg-static, fallback to system ffmpeg if not installed
let ffmpegPath = 'ffmpeg';
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  // ffmpeg-static not found, relying on system PATH
}

/**
 * Converts an audio file with FFmpeg.
 */
export const convertAudio = (input: string, output: string, args: string[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    const command: FfmpegCommand = ffmpeg(input);
    if (args.length > 0) {
      command.outputOptions(args);
    }
    command
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

export const convertVideo = (input: string, output: string, args: string[] = []): Promise<void> => {
    return new Promise((resolve, reject) => {
        const command: FfmpegCommand = ffmpeg(input);

        if (args.length > 0) {
            command.outputOptions(args);
        }

        const progressBar = new cliProgress.SingleBar({
            format: 'Converting [{bar}] {percentage}% | ETA: {eta_formatted}',
            barCompleteChar: '#',
            barIncompleteChar: '-',
            hideCursor: true
        });

        let duration: number | undefined;

        command
            .on('codecData', (data) => {
                const timeParts = data.duration.split(':').map(Number);
                duration = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                progressBar.start(100, 0);
            })
            .on('progress', (progress) => {
                if (duration && progress.timemark) {
                    const parts = progress.timemark.split(':').map(Number);
                    const seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    const percent = Math.min((seconds / duration) * 100, 100);
                    progressBar.update(percent);
                }
            })
            .on('error', (err) => {
                progressBar.stop();
                logger.error(`Error converting video: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                progressBar.update(100);
                progressBar.stop();
                resolve();
            })
            .save(output);
    });
};

/**
 * Robust DASH converter using spawn() to capture full error logs.
 */
export const convertDash = (args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!args || args.length === 0) return reject(new Error("No ffmpeg arguments provided"));

    logger.info(`FFmpeg started with command: ${ffmpegPath} ${args.join(" ")}`);

    const process = spawn(ffmpegPath, args);
    
    // Setup Progress Bar
    const progressBar = new cliProgress.SingleBar({
      format: 'Converting DASH |{bar}| {percentage}% | ETA: {eta_formatted}',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    let totalDuration = 0;
    let errorLog: string[] = []; 

    // Capture STDERR (Logs + Errors)
    process.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      
      // Buffer last 20 lines for debugging
      errorLog.push(msg);
      if (errorLog.length > 20) errorLog.shift();

      // Parse Duration
      if (msg.includes("Duration: ")) {
        const durationMatch = msg.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const mins = parseInt(durationMatch[2]);
          const secs = parseInt(durationMatch[3]);
          totalDuration = (hours * 3600) + (mins * 60) + secs;
          progressBar.start(100, 0);
        }
      }

      // Parse Progress
      if (msg.includes("time=")) {
        const timeMatch = msg.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch && totalDuration > 0) {
          const hours = parseInt(timeMatch[1]);
          const mins = parseInt(timeMatch[2]);
          const secs = parseInt(timeMatch[3]);
          const currentSeconds = (hours * 3600) + (mins * 60) + secs;
          const percent = Math.min(100, (currentSeconds / totalDuration) * 100);
          progressBar.update(percent);
        }
      }
    });

    process.on('close', (code: number) => {
      progressBar.stop();
      if (code === 0) {
        resolve();
      } else {
        logger.error("\n=== FFmpeg Error Dump ===");
        console.error(errorLog.join(""));
        logger.error("=========================");
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    process.on('error', (err: Error) => {
      progressBar.stop();
      reject(err);
    });
  });
};

/**
 * Gets the sample rate of an audio file.
 */
export const getSampleRate = (inputAudio: string): number => {
  try {
    const nuendoSampleRate = extractNuendoSampleRate(inputAudio);
    if (nuendoSampleRate > 0) {
      return nuendoSampleRate;
    }

    const ffprobeCmd = `ffprobe -v quiet -print_format json -show_streams "${inputAudio}"`;
    const output = execSync(ffprobeCmd, { encoding: 'utf8' });
    const data = JSON.parse(output);
    
    const audioStream = data.streams.find((stream: any) => stream.codec_type === 'audio');
    if (audioStream?.sample_rate) {
      return parseInt(audioStream.sample_rate);
    }

    return 44100;
  } catch (error) {
    logger.error('Error extracting sample rate:', error);
    return 44100;
  }
};

/**
 * Extracts Nuendo beat markers from the audio file metadata.
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
          const startMs = (startSample / currentTimebase) * 1000;
          markers.push(Math.round(startMs));
        }
      }
    }
    
    return markers.length > 0 ? markers : [0, 500];
    
  } catch (error) {
    logger.error('Error extracting beat markers:', error);
    return [0, 500];
  }
};

const extractNuendoSampleRate = (inputAudio: string): number => {
  try {
    const xmlCmd = `ffmpeg -i "${inputAudio}" -map_metadata 0 -f wav - 2>/dev/null | strings | grep -E "<?xml|<obj|SampleRate" | head -10`;
    const xmlOutput = execSync(xmlCmd, { encoding: 'utf8' });
    
    if (xmlOutput.trim()) {
      const sampleRateMatch = xmlOutput.match(/SampleRate[">:=\s]*(\d+)/i);
      if (sampleRateMatch) {
        return parseInt(sampleRateMatch[1]);
      }
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

/**
 * Generates a 30s preview with fade in/out and scaling.
 */
export const createPreview = (
  videoInput: string,
  audioInput: string,
  output: string,
  startTime: number,
  duration: number,
  isDash: boolean = false
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const FADE_IN = 1;
    const FADE_OUT = 5;
    const fadeOutStart = duration - FADE_OUT;

    const videoFilter = `[0:v]scale=-2:720,fade=t=in:st=0:d=${FADE_IN},fade=t=out:st=${fadeOutStart}:d=${FADE_OUT}[v]`;
    const audioSource = (videoInput === audioInput) ? "[0:a]" : "[1:a]";
    const audioFilter = `${audioSource}afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fadeOutStart}:d=${FADE_OUT}[a]`;

    const args: string[] = ["-y"];

    // --- CRITICAL DASH FIXES ---
    if (isDash) {
      args.push(
        "-allowed_extensions", "ALL",
        "-protocol_whitelist", "file,crypto,data,http,tcp,https,tls"
      );
    }

    // Seek and Input
    // Prepend 'file:' if isDash to ensure the demuxer looks locally
    const finalVideoInput = isDash ? `file:${path.resolve(videoInput)}` : videoInput;
    const finalAudioInput = isDash ? `file:${path.resolve(audioInput)}` : audioInput;

    args.push("-ss", String(startTime), "-i", finalVideoInput);

    if (videoInput !== audioInput) {
      args.push("-ss", String(startTime), "-i", finalAudioInput);
    }

    args.push(
      "-t", String(duration),
      "-filter_complex", `${videoFilter};${audioFilter}`,
      "-map", "[v]",
      "-map", "[a]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-pix_fmt", "yuv420p",
      output
    )

    // Reuse your robust spawn logic
    let ffmpegPath = 'ffmpeg';
    try { ffmpegPath = require('ffmpeg-static'); } catch (e) {}
    
    logger.info(`Generating preview: ${output}`);
    // logger.info(`Command: ${ffmpegPath} ${args.join(" ")}`); // Uncomment to debug

    const process = spawn(ffmpegPath, args);
    
    const progressBar = new cliProgress.SingleBar({
      format: 'Rendering Preview |{bar}| {percentage}% | ETA: {eta_formatted}',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    // Since it's a fixed duration (e.g. 30s), we can just start the bar
    progressBar.start(100, 0);

    let errorLog: string[] = [];

    process.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      errorLog.push(msg);
      if (errorLog.length > 20) errorLog.shift();

      // Simple time parsing for progress
      if (msg.includes("time=")) {
        const timeMatch = msg.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const secs = (parseInt(timeMatch[1]) * 3600) + (parseInt(timeMatch[2]) * 60) + parseInt(timeMatch[3]);
          const percent = Math.min(100, (secs / duration) * 100);
          progressBar.update(percent);
        }
      }
    });

    process.on('close', (code: number) => {
      progressBar.stop();
      if (code === 0) {
        resolve();
      } else {
        logger.error("\n=== FFmpeg Preview Error ===");
        console.error(errorLog.join(""));
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
};
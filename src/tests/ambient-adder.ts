import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";
import { promisify } from "util";
import { Cinematics, MusicTrack } from "../types/godot";
import { getSampleRate } from "../lib/ffmpeg";
import UnitConverter from "../lib/unit-converter";
const execAsync = promisify(exec);

type AmbFiles = {
  path: string;
  time: number;
  duration: number;
};

class AmbientAdder {
  constructor() {}

  private async addSilence(audioFile: string, outputFile: string, silenceMs: number): Promise<void> {
    const cmd = `ffmpeg -y -i "${audioFile}" -af "adelay=${silenceMs}|${silenceMs}" -map_chapters -1 "${outputFile}"`;
    console.log(`Running addSilence: ${cmd}`);
    try {
      const { stdout, stderr } = await execAsync(cmd);
      console.log("FFmpeg addSilence stdout:", stdout);
      if (stderr) console.warn("FFmpeg addSilence stderr:", stderr);
    } catch (e) {
      console.error("FFmpeg addSilence error:", e);
      throw e;
    }
  }

  private async addOverlayingAudio(audioFile: string, olAudio: string, startTime: number, mainDuration: number, outputFile: string): Promise<void> {
    const delayMs = Math.min(Math.max(Math.round(startTime * 1000), 0), 600000); // Cap at 10min
    const padDuration = Math.max(mainDuration - startTime, 0) + 1; // Add 1s buffer
    const cmd = `ffmpeg -y -i "${audioFile}" -i "${olAudio}" -filter_complex "[1]adelay=${delayMs}|${delayMs},apad=pad_dur=${padDuration}[delayed];[0][delayed]amix=inputs=2:duration=first:weights=0.7 0.3,volume=1.0" -c:a aac -b:a 256k -ar 44100 -map_chapters -1 "${outputFile}"`;
    console.log(`Running addOverlayingAudio: ${cmd}`);
    try {
      const { stdout, stderr } = await execAsync(cmd);
      console.log("FFmpeg addOverlayingAudio stdout:", stdout);
      if (stderr) console.warn("FFmpeg addOverlayingAudio stderr:", stderr);
    } catch (e) {
      console.error("FFmpeg addOverlayingAudio error:", e);
      throw e;
    }
  }

  private isValidAudio(filePath: string): boolean {
    try {
      execSync(`ffprobe -i "${filePath}"`, { stdio: "ignore" });
      return true;
    } catch (e) {
      console.error(`Invalid audio file: ${filePath}`);
      return false;
    }
  }

  private getFileSampleRate(filePath: string): number {
    try {
      const output = execSync(`ffprobe -v error -show_entries stream=sample_rate -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: "utf8" });
      return parseInt(output) || 44100; // Default to 44100 if parsing fails
    } catch (e) {
      console.error(`Error getting sample rate for ${filePath}: ${e}`);
      return 44100;
    }
  }

  private getFileDuration(filePath: string): number {
    try {
      const output = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: "utf8" });
      return parseFloat(output) || 0; // Return duration in seconds
    } catch (e) {
      console.error(`Error getting duration for ${filePath}: ${e}`);
      return 0;
    }
  }

  private getFileChapters(filePath: string): number {
    try {
      const output = execSync(`ffprobe -v error -show_entries chapter -of json "${filePath}"`, { encoding: "utf8" });
      const chapters = JSON.parse(output).chapters || [];
      return chapters.length;
    } catch (e) {
      console.error(`Error getting chapters for ${filePath}: ${e}`);
      return 0;
    }
  }

  async process(codeName: string, musicTrack: MusicTrack, audioPath: string, ambs: AmbFiles[], outputFile: string): Promise<boolean> {
    const outputDir = path.dirname(outputFile);
    const outputExt = path.extname(outputFile).substring(1);
    const tempOutput = path.join(outputDir, `${codeName}_temp.${outputExt}`);
    const finalOutput = path.join(outputDir, `${codeName}_with_ambient.${outputExt}`);

    try {
      // Validate main audio file
      if (!fs.existsSync(audioPath) || !this.isValidAudio(audioPath)) {
        throw new Error(`Invalid main audio file: ${audioPath}`);
      }

      // Get main audio duration and chapters
      const mainDuration = this.getFileDuration(audioPath);
      const mainChapters = this.getFileChapters(audioPath);
      console.log(`Main audio duration: ${mainDuration.toFixed(2)}s, chapters: ${mainChapters}`);

      // Check sample rate, duration, and chapters consistency
      const mainSampleRate = this.getFileSampleRate(audioPath);
      console.log(`Main audio sample rate: ${mainSampleRate} Hz`);
      for (const amb of ambs) {
        const ambSampleRate = this.getFileSampleRate(amb.path);
        const ambDuration = this.getFileDuration(amb.path);
        const ambChapters = this.getFileChapters(amb.path);
        if (ambSampleRate !== mainSampleRate) {
          console.warn(`Sample rate mismatch: ${amb.path} (${ambSampleRate} Hz) differs from main audio (${mainSampleRate} Hz)`);
        }
        console.log(`Ambient file: ${amb.path}, duration: ${ambDuration.toFixed(2)}s, start: ${amb.time.toFixed(2)}s, chapters: ${ambChapters}`);
      }

      // Process silence
      const startBeat = Math.abs(musicTrack.startBeat);
      const silenceMs = Math.min(Math.max(Math.round(startBeat / 48 * 1000), 0), 10000); // Cap at 10s
      console.log(`Processing ${codeName}...`);
      console.log(`Adding ${silenceMs}ms of silence...`);
      await this.addSilence(audioPath, tempOutput, silenceMs);

      // Check temp file chapters
      const tempChapters = this.getFileChapters(tempOutput);
      console.log(`Temp file chapters: ${tempChapters}`);

      console.log(`Adding ${ambs.length} ambient sound(s)...`);
      let currentInput = tempOutput;

      for (let i = 0; i < ambs.length; i++) {
        const amb = ambs[i];
        if (!this.isValidAudio(amb.path)) {
          console.warn(`Skipping invalid ambient file: ${amb.path}`);
          continue;
        }
        const stepOutput = path.join(outputDir, `${codeName}_ambient_step${i}.${outputExt}`);
        await this.addOverlayingAudio(currentInput, amb.path, amb.time, mainDuration, stepOutput);
        console.log(`Step ${i + 1}: ${amb.path} at ${amb.time.toFixed(2)}s for ${amb.duration.toFixed(2)}s`);

        // Keep intermediate files for debugging
        if (currentInput !== tempOutput && fs.existsSync(currentInput)) {
          fs.unlinkSync(currentInput);
        }
        currentInput = stepOutput;

        // Check step file chapters
        const stepChapters = this.getFileChapters(stepOutput);
        console.log(`Step ${i + 1} file chapters: ${stepChapters}`);
      }

      fs.renameSync(currentInput, finalOutput);
      // Keep temp file for debugging
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

      // Log final output duration and chapters
      const finalDuration = this.getFileDuration(finalOutput);
      const finalChapters = this.getFileChapters(finalOutput);
      console.log(`Final output duration: ${finalDuration.toFixed(2)}s, chapters: ${finalChapters}`);
      console.log(`Successfully created: ${finalOutput}`);
      return true;
    } catch (e) {
      console.error(`Error processing files: ${e}`);
      return false;
    }
  }
}

const fixPath = (mapName: string, ambPath: string) => {
  let filename = path.basename(ambPath);
  if (filename.startsWith("set_")) filename = filename.substring(4);
  if (filename.endsWith(".tpl")) filename = filename.replace(".tpl", ".wav");
  return path.resolve(`./input/${mapName}/Audio/AMB/${filename}`);
};

export default new AmbientAdder();
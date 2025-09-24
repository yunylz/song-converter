import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

async function finalizeVideo(
  inputVideo: string,
  inputAudio: string,
  startBeat: number, // in seconds (e.g. 0.584 means 584ms)
  videoStartTime: number,
  outputFile?: string
) {
  const outPath =
    outputFile || path.resolve(process.cwd(), "finalized_output.mp4");

  // If startBeat > 0, apply audio offset
  const audioInput = startBeat > 0
    ? `-itsoffset ${startBeat} -i "${inputAudio}"`
    : `-i "${inputAudio}"`;

  const audioIndex = startBeat > 0 ? 1 : 1; // still input #1

  const cmd = `
    ffmpeg -y -ss ${videoStartTime} -i "${inputVideo}" ${audioInput} \
    -c:v libx264 -crf 26 -preset ultrafast \
    -c:a aac -b:a 192k \
    -map 0:v:0 -map ${audioIndex}:a:0 \
    -shortest "${outPath}"
  `;

  console.log("Running FFmpeg:\n", cmd);

  try {
    await execAsync(cmd);
    console.log("✅ Finalized video created at:", outPath);
  } catch (err) {
    console.error("❌ Error finalizing video:", err);
  }
}

export default finalizeVideo;

import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";
import { promisify } from "util";
import { Cinematics, MusicTrack } from "../types/godot";
import { getSampleRate } from "../lib/ffmpeg";
import UnitConverter from "../lib/unit-converter";
import ambientAdder from "./ambient-adder";
import finalizeVideo from "./finalize-video";

const fixPath = (mapName: string, ambPath: string) => {
  let filename = path.basename(ambPath);
  if (filename.startsWith("set_")) filename = filename.substring(4);
  if (filename.endsWith(".tpl")) filename = filename.replace(".tpl", ".wav");
  return path.resolve(`./input/${mapName}/Audio/AMB/${filename}`);
};

(async () => {
  const amb = ambientAdder;

  const mapName = "FollowMe";
  const mapNameLower = mapName.toLowerCase();
  const video = `./input/${mapName}/VideosCoach/${mapName}.webm`;
  const audio = `./input/${mapName}/Audio/${mapName}.wav`;
  const output = `./input/${mapName}/Audio/${mapName}_with_ambient.m4a`;
  const final = `./input/${mapName}/Audio/${mapName}_with_ambient.mp4`;

  const outputDir = path.dirname(output);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const cinematicsPath = `./output/${mapNameLower}/cinematics/${mapNameLower}_mainsequence.json`;
  const cinematics: Cinematics = JSON.parse(fs.readFileSync(cinematicsPath, "utf-8"));

  const musicTrackPath = `./output/${mapNameLower}/audio/${mapNameLower}_musictrack.json`;
  const musicTrack: MusicTrack = JSON.parse(fs.readFileSync(musicTrackPath, "utf-8"));

  const sampleRate = getSampleRate(audio);
  const unitConverter = new UnitConverter(musicTrack.markers, sampleRate, 24);

  const ambFiles = cinematics.clips
    .sort((a, b) => a.startTime - b.startTime)
    .map(c => ({
      time: unitConverter.timeFromTicks(c.startTime),
      duration: unitConverter.timeFromTicks(c.duration),
      path: fixPath(mapName, c.soundSetPath),
    }))
    .filter(amb => fs.existsSync(amb.path));

  console.log("Ambient Files:", JSON.stringify(ambFiles, null, 2));
  console.log("Main Sample Rate:", sampleRate);
  await amb.process(mapName, musicTrack, audio, ambFiles, output);

  const startBeat = Math.abs(musicTrack.startBeat);
  const startBeatMs = (startBeat / 48) / 1000;
    const silenceMs = Math.min(Math.max(Math.round(startBeat / 48 * 1000), 0), 10000);

  await finalizeVideo(video, output, musicTrack.startBeat +musicTrack.videoStartTime, musicTrack.videoStartTime, final);
})();
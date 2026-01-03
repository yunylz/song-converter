import fs from "fs-extra";
import path from "path";
import inquirer from "inquirer";
import logger from "./logger";
import { createPreview } from "./ffmpeg";
import { downloadBestDashStreams, uploadPreview } from "./s3";
import p4 from "./map-types/p4";

const PREVIEW_DURATION = 30; // 30 seconds
const SAMPLE_RATE = 48000;

export const processFromMap = async (inputDir: string, workDir: string) => {
    const mapData = await p4(inputDir, workDir, Date.now(), true);
    
    if (!mapData.song || !mapData.musicTrack) {
        throw new Error("Could not parse map data.");
    }

    logger.info(`Generating preview for ${mapData.mapName} from source files...`);

    const markers = mapData.musicTrack.structure.MusicTrackStructure.markers;
    const startBeat = mapData.musicTrack.structure.MusicTrackStructure.previewEntry ?? 0;
    
    if (!markers[startBeat]) throw new Error(`Preview start beat ${startBeat} not found in markers.`);

    // markers are in samples, convert to seconds
    const startMs = (markers[startBeat].VAL / SAMPLE_RATE); 
    
    if (!mapData.videoPath) throw new Error("No video file found in VideosCoach folder.");
    
    const output = path.join(workDir, `${mapData.mapName}_Preview.mp4`);

    await createPreview(
        mapData.videoPath,
        mapData.audioPath,
        output,
        startMs,
        PREVIEW_DURATION
    );

    await uploadPreview(mapData.mapName, output);
};

export const processFromDash = async (mapName: string, workDir: string) => {
    logger.info(`Downloading Optimized DASH source for ${mapName}...`);
    
    const dashDir = path.join(workDir, "dash_source");
    // This still downloads the init_0 and chunk_0 files
    await downloadBestDashStreams(mapName, dashDir);

    const mpdPath = path.join(dashDir, "master.mpd");
    
    // --- NEW LOGIC: Create a playable stream from segments ---
    // Instead of letting FFmpeg struggle with the MPD, we combine the segments
    // we downloaded into a single streamable file.
    logger.info("Preparing playable stream from DASH segments...");
    
    // We'll look for the IDs we selected (usually 0 for video, 3 for audio)
    // To keep it simple and robust, let's stick to the MPD but tell FFmpeg to be less strict
    
    let { startTime } = await inquirer.prompt([{
        type: "number",
        name: "startTime",
        message: "Enter preview START time (seconds):",
        default: 0
    }]);

    if (startTime > 1000) {
        logger.warn(`Input ${startTime} seems to be in milliseconds. Converting to ${startTime / 1000}s.`);
        startTime = startTime / 1000;
    }

    const output = path.join(workDir, `${mapName}_Preview.mp4`);

    // We add "-allowed_extensions ALL" and use the local file protocol explicitly
    // We also use a custom createPreview call that handles the DASH input better
    await createPreview(
        mpdPath, 
        mpdPath, 
        output,
        startTime,
        PREVIEW_DURATION,
        true // isDash flag
    );

    await uploadPreview(mapName, output);
};

export const processFromVideo = async (workDir: string) => {
    let { mapName, videoPath, startTime } = await inquirer.prompt([
        { type: "input", name: "mapName", message: "Enter Map Name:" },
        { 
            type: "input", 
            name: "videoPath", 
            message: "Path to video file:",
            validate: (val) => fs.existsSync(val) || "File not found"
        },
        { type: "number", name: "startTime", message: "Start Time (seconds):", default: 0 }
    ]);

    // SMART FIX here too
    if (startTime > 1000) {
        logger.warn(`Input ${startTime} seems to be in milliseconds. Converting to ${startTime / 1000}s.`);
        startTime = startTime / 1000;
    }

    const output = path.join(workDir, `${mapName}_Preview.mp4`);

    await createPreview(
        videoPath,
        videoPath,
        output,
        startTime,
        PREVIEW_DURATION
    );

    await uploadPreview(mapName, output);
};
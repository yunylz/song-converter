import fs from "fs";
import path from "path";

import logger from "./logger";
import { convertDash, convertVideo } from "./ffmpeg";
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

const process = async (input: string, outputFolder: string, mapName: string) => {
    const baseOutput = path.resolve(outputFolder, "videoscoach", mapName.toLowerCase());

    if (!fs.existsSync(baseOutput)) fs.mkdirSync(baseOutput, { recursive: true });

    logger.info(`VideosCoach will be processed for DASH adaptive streaming.`);

    // Common FFmpeg options
    const commonOptions: string[] = [
        "-r", `${config.VIDEOSCOACH_FPS}`
    ];

    if (config.MUTE_VIDEOSCOACH) {
        commonOptions.push("-an");
    }

    // DASH master manifest options
    const dashOptions: string[] = [
        "-i", input,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-seg_duration", "6",
        "-use_timeline", "1",
        "-use_template", "1",
        "-adaptation_sets", "id=0,streams=v id=1,streams=a",
    ];

    // Add each quality
    QUALITIES.forEach((q, i) => {
        dashOptions.push(
            "-b:v:" + i, q.bitrate,
            "-s:v:" + i, `${q.width}x${q.height}`
        );
    });

    // Merge common options like FPS and muting
    dashOptions.push(...commonOptions);

    // Output DASH master manifest
    dashOptions.push(path.join(baseOutput, "master.mpd"));

    try {
        await convertDash(dashOptions);
        logger.info(`VideosCoach DASH master manifest created successfully at ${baseOutput}/master.mpd`);
        return true;
    } catch (err: any) {
        logger.error(`Failed to convert video to DASH: ${err.message}`);
        return false;
    }
};

export default {
    process
};

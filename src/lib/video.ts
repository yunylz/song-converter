import fs from "fs";
import path from "path";

import logger from "./logger";

import { convertVideo } from "./ffmpeg";
import config from "../config";

const process = async (input: string, outputFolder: string, mapName: string) => {
    const fileName = `${mapName.toLowerCase()}.mp4`;
    const output = path.resolve(outputFolder, "videoscoach", fileName);
    const outputDir = path.dirname(output);

    if (fs.existsSync(output)) {
        logger.warn(`Video file already exists, it will be overwritten!`);
    };

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    };

    let options = [
        "-vf", `scale=${config.VIDEOSCOACH_RESOLUTION[0]}:${config.VIDEOSCOACH_RESOLUTION[1]}`,
        "-c:v", "libx264",
        "-crf", "20", 
        "-r", `${config.VIDEOSCOACH_FPS}`
    ];
    if (config.MUTE_VIDEOSCOACH) {
        options.push("-an");
    };

    logger.info(`VideosCoach will be processed in ${config.VIDEOSCOACH_RESOLUTION[0]}x${config.VIDEOSCOACH_RESOLUTION[1]} resolution with ${config.VIDEOSCOACH_FPS} FPS. Is it muted? ${config.MUTE_VIDEOSCOACH ? "Yes." : "No."}`);

    try {
        await convertVideo(input, output, options);
        return true;
    } catch (err: any) {
        logger.error(`Failed to convert main audio: ${err.message}`);
        return false;
    }
};

export default {
    process
};
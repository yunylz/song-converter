import fs from "fs";
import path from "path";
import logger from "./logger";
import { convertDash } from "./ffmpeg";
import config from "../config";

interface Quality {
    width: number;
    height: number;
    bitrate: string;
}

const QUALITIES: Quality[] = [
    // { width: 1920, height: 1080, bitrate: "5000k" },
    // { width: 1280, height: 720, bitrate: "3000k" },
    { width: 854, height: 480, bitrate: "1500k" },
];

const processDash = async (
    mapName: string,
    videoInput: string,
    audioInput: string,
    outputFile: string // full path including filename (e.g., .../master.mpd)
): Promise<boolean> => {
    const baseOutput = path.dirname(outputFile);

    if (!fs.existsSync(baseOutput)) fs.mkdirSync(baseOutput, { recursive: true });

    logger.info(`Processing DASH stream for ${mapName}...`);

    // Build FFmpeg arguments
    const args: string[] = [
        "-i", videoInput,
        "-i", audioInput,
        "-r", `${config.VIDEOSCOACH_FPS}`,   // preserve FPS
    ];

    // Audio options
    if (config.MUTE_VIDEOSCOACH) {
        args.push("-an");
    } else {
        args.push("-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000");
    }

    // Video options per quality
    QUALITIES.forEach((q, i) => {
        args.push(
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-b:v:" + i, q.bitrate,
            "-s:v:" + i, `${q.width}x${q.height}`,
            "-profile:v", "main"
        );
    });

    // DASH segmenting: write all segments in the same folder as the output manifest
    args.push(
        "-f", "dash",
        "-seg_duration", "6",
        "-use_timeline", "1",
        "-use_template", "1",
        "-init_seg_name", path.join(baseOutput, "init_$RepresentationID$.m4s"),
        "-media_seg_name", path.join(baseOutput, "chunk_$RepresentationID$_$Number%05d$.m4s"),
        "-adaptation_sets", "id=0,streams=v id=1,streams=a",
        outputFile
    );

    try {
        await convertDash(args);
        logger.info(`DASH master manifest created successfully at ${outputFile}`);
        return true;
    } catch (err: any) {
        logger.error(`Failed to create DASH stream: ${err.message}`);
        return false;
    }
};

export default {
    processDash
};

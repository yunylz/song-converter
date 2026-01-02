import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import lua from "./lua"; 
import logger from "./logger";
import { MainSequence } from "../types/lua/mainsequence";
import { SoundDescriptorFile } from "../types/lua/ilu";
import * as cliProgress from "cli-progress";

const TICKS_PER_BEAT = 24;

const dbToLinear = (db: number) => {
    return Math.pow(10, db / 20);
};

const getMsFromTicks = (ticks: number, markers: any[]) => {
    // markers here are the VAL numbers (samples)
    if (!markers || markers.length === 0) return 0;

    if (ticks < 0) {
        if (markers.length > 1) {
            const firstBeatDurationSamples = markers[1] - markers[0];
            const samplesPerTick = firstBeatDurationSamples / TICKS_PER_BEAT;
            const negativeSamples = ticks * samplesPerTick;
            return Math.round(negativeSamples / 48);
        } else {
            return 0;
        }
    }

    const beatIndex = Math.floor(ticks / TICKS_PER_BEAT);
    const fraction = (ticks % TICKS_PER_BEAT) / TICKS_PER_BEAT;

    if (beatIndex >= markers.length) {
        return Math.round((markers[markers.length - 1] || 0) / 48);
    }

    const startSample = markers[beatIndex];
    if (startSample === undefined) return 0;

    let endSample = startSample;
    if (markers[beatIndex + 1] !== undefined) {
        endSample = markers[beatIndex + 1];
    } else if (beatIndex > 0) {
        const prevDuration = startSample - markers[beatIndex - 1];
        endSample = startSample + prevDuration;
    }

    const actualSample = startSample + ((endSample - startSample) * fraction);
    return Math.round(actualSample / 48);
};

const findAmbFile = (targetRawPath: string, availableFiles: string[]): string | undefined => {
    const cleanTarget = path.basename(targetRawPath)
        .toLowerCase()
        .replace("set_", "")
        .replace(/\.(tpl|wav|ilu)$/, "");
    
    return availableFiles.find(f => {
        const fName = path.basename(f)
            .toLowerCase()
            .replace("set_", "")
            .replace(/\.(tpl|wav|ilu)$/, "");
        return fName === cleanTarget && f.toLowerCase().endsWith(".wav");
    });
};

const process = async ({
    ambFiles, 
    videoPath, 
    audioPath, 
    musicTrack, 
    mainSequence, 
    output
} : {
    ambFiles: string[],
    videoPath: string,
    audioPath: string,
    musicTrack: any, 
    mainSequence: MainSequence | undefined,
    output: string
}): Promise<boolean> => {
    
    // In p4.ts, markers is already an array of numbers
    // In Godot types, it's musicTrack.markers. 
    // In raw Lua, it's trk.structure.MusicTrackStructure.markers.
    const markers = musicTrack?.markers || musicTrack?.structure?.MusicTrackStructure?.markers?.map((m: any) => m.VAL) || [];
    const rawVideoStart = musicTrack?.videoStartTime || musicTrack?.structure?.MusicTrackStructure?.videoStartTime || 0;
    const clips = mainSequence?.params?.Tape?.Clips || [];

    const globalOffset = rawVideoStart < 0 ? Math.abs(Math.round(rawVideoStart * 1000)) : 0;
    
    logger.info(`Starting Video Mix. Global Audio Delay: ${globalOffset}ms`);

    let ffmpegCmd = ffmpeg();
    ffmpegCmd.input(videoPath);
    ffmpegCmd.input(audioPath);

    let inputCount = 2; 
    let filterComplex: string[] = [];
    
    filterComplex.push(`[1:a]adelay=${globalOffset}|${globalOffset}[mainDelayed]`);
    let mixInputs = ["[mainDelayed]"];

    const sortedClips = clips.sort((a, b) => a.SoundSetClip.StartTime - b.SoundSetClip.StartTime);

    for (const clipWrapper of sortedClips) {
        const clip = clipWrapper.SoundSetClip;
        if (!clip) continue;

        const fullAmbPath = findAmbFile(clip.SoundSetPath, ambFiles);
        if (!fullAmbPath) continue;

        // Volume Logic
        const iluPath = fullAmbPath.replace(/\.wav$/i, ".ilu");
        let volDb = 0;

        let validIluPath = fs.existsSync(iluPath) ? iluPath : null;
        if (!validIluPath) {
            const iluWithSet = path.join(path.dirname(fullAmbPath), "SET_" + path.basename(iluPath));
            if (fs.existsSync(iluWithSet)) validIluPath = iluWithSet;
        }

        if (validIluPath) {
            try {
                const iluData = lua(validIluPath) as SoundDescriptorFile;
                const template = iluData?.DESCRIPTOR?.[0]?.SoundDescriptor_Template;
                if (template && typeof template.volume === 'number') {
                    volDb = template.volume;
                }
            } catch (err) {}
        }

        const volLinear = dbToLinear(volDb).toFixed(3);
        const songTime = getMsFromTicks(clip.StartTime, markers);
        
        // --- THE FIX FOR NaN ---
        if (isNaN(songTime)) {
            logger.warn(`Could not calculate time for ${path.basename(fullAmbPath)} (Tick: ${clip.StartTime})`);
            continue;
        }

        let totalDelay = songTime + globalOffset;
        if (totalDelay < 0) totalDelay = 0;

        ffmpegCmd.input(fullAmbPath);
        const inputLabel = `${inputCount}:a`;
        const tagName = `amb${inputCount}`;

        filterComplex.push(`[${inputLabel}]volume=${volLinear},adelay=${totalDelay}|${totalDelay}[${tagName}]`);
        mixInputs.push(`[${tagName}]`);

        logger.info(`Adding AMB: ${path.basename(fullAmbPath)} | Vol: ${volDb}dB | Delay: ${totalDelay}ms`);
        inputCount++;
    }

    const mixFilter = `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0[outaudio]`;
    filterComplex.push(mixFilter);

    const progressBar = new cliProgress.SingleBar({
        format: 'Progress |' + '{bar}' + '| {percentage}% | ETA: {eta}s',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    return new Promise<boolean>((resolve) => {
        ffmpegCmd
            .complexFilter(filterComplex)
            .output(output)
            .videoCodec('copy') 
            .audioCodec('libopus') 
            .outputOptions(['-map 0:v', '-map [outaudio]'])
            .on('start', () => {
                progressBar.start(100, 0);
            })
            .on('progress', (progress) => {
                if (progress.percent) progressBar.update(Math.round(progress.percent));
            })
            .on('end', () => {
                progressBar.update(100);
                progressBar.stop();
                resolve(true);
            })
            .on('error', (err) => {
                progressBar.stop();
                logger.error(`FFmpeg Error: ${err.message}`);
                resolve(false);
            })
            .run();
    });
};

export default { process };
import fs from "fs";
import path from "path";
import logger from "../logger";
import lua from "../lua";
import exporter from "../exporter";
import { fixEnginePath, parseDifficulty, parseGameMode, parseGameModeFlags, parseGameModeStatus, parseNumCoach, parseSweatDifficulty, tmlToDtape, tmlToKtape } from "../utils";
import { audioExtensions } from "../audio";
import { getSampleRate } from "../ffmpeg";
import UnitConverter from "../../lib/unit-converter";

import { SongDescTemplate } from "../../types/lua/songdesc";
import { Song, MusicTrack, Dance, PictoClip, MotionClip, GoldEffectClip, Karaoke, KaraokeClip, Cinematics, SoundSetClip } from '../../types/godot';
import { Track } from '../../types/lua/trk';
import { Timeline } from "../../types/lua/tml";
import { Dtape } from "../../types/lua/dtape";
import { Ktape } from "../../types/lua/ktape";
import { MainSequence } from "../../types/lua/mainsequence";

type FileEntry = {
    type: string;
    path: string;
    isTrk?: boolean;
    isJd5?: boolean;
    isTimeline?: boolean;
    isDtape?: boolean;
    isKtape?: boolean;
    isMainSequence?: boolean;
};

/**
 * Converts a P4 map folder to JDBest format.
 * @param input Input folder path.
 * @param output Output folder path.
 */
export default async (
    input: string,
    output: string,
) => {
    const resolveInput = (filePath: string) => path.resolve(input, filePath);
    const songDescPath = path.join(input, "SongDesc.tpl");
    const songDescExists = fs.existsSync(songDescPath);

    // Song desc must exist
    if (!songDescExists) {
        throw new Error(`Song descriptor was not found in the input folder.`);
    };

    logger.info("Trying to find the mapName...");

    // Read the Lua SongDesc
    const songDesc: SongDescTemplate = lua(songDescPath);

    // Get the song template data
    const songTemplate = songDesc.params.Actor_Template.COMPONENTS[0].JD_SongDescTemplate;
    const mapName = songTemplate.MapName;
    const title = songTemplate.Title;
    const artist = songTemplate.Artist;
    const difficulty = songTemplate.Difficulty;
    const sweatDifficulty = songTemplate.SweatDifficulty;
    const numCoach = songTemplate.NumCoach;
    const audioPreviews = songTemplate.AudioPreviews;
    const jdVersion = songTemplate.JDVersion;
    const flags = songTemplate.GameModes[0]?.GameModeDesc?.flags;
    const status = songTemplate.GameModes[0]?.GameModeDesc?.status;
    const mode = songTemplate.GameModes[0]?.GameModeDesc?.mode;

    // Map name is required
    if (!mapName) {
        throw new Error(`Map name was not found in the SongDesc.tpl file.`);
    } else logger.info(`Map name found: "${mapName}"`);

    const pictosPath = path.resolve(input, "timeline/pictos");
    const movesPath = path.resolve(input, "timeline/moves");
    const audioPath = path.resolve(input, "Audio", mapName + ".wav");
    const menuArtPath = path.resolve(input, "MenuArt/Textures");
    const requiredFiles = [pictosPath, movesPath, audioPath, menuArtPath];
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    if (missingFiles.length > 0) {
        throw new Error(`Missing required files/folders: ${missingFiles.join(", ")}`);
    };

    // Load rest of the files
    let files: FileEntry[] = [
        {
            type: "trk",
            path: `Audio/${mapName}.trk`,
            isTrk: true
        },
        {
            type: "cinematics",
            path: `Cinematics/${mapName}_MainSequence.tape`,
            isMainSequence: true
        }
    ];
    // If version is JD5 or JD2014, we need to load the timeline.tpl file 
    // to transform it into dtape and ktape files, since we shouldn't handle both tml 
    // and dtape/ktape at the same time to make them meet in the middle.
    if (jdVersion == 5 || jdVersion == 2014) {
        files.push({
            type: "timeline",
            path: `timeline/timeline.tpl`,
            isJd5: true,
            isTimeline: true
        });
    }
    // Other P4 versions should have dtape and ktape files already
    else {
        files.push({
            type: "dtape",
            path: `timeline/${mapName}_TML_Dance.dtape`,
            isDtape: true,
            isTimeline: true
        });
        files.push({
            type: "ktape",
            path: `timeline/${mapName}_TML_Karaoke.ktape`,
            isKtape: true,
            isTimeline: true
        });
    };

    let trk: Track | undefined = undefined;
    let timeline: Timeline | undefined = undefined;
    let dtape: Dtape | undefined = undefined;
    let ktape: Ktape | undefined = undefined;
    let mainSequence : MainSequence | undefined = undefined;

    // Go through files to load them
    for (const file of files) {
        // Load the Track file
        if (file.isTrk) {
            trk = lua(resolveInput(file.path));
        };
        if (file.isTimeline && file.isJd5) {
            timeline = lua(resolveInput(file.path));
        }
        if (file.isTimeline && file.isDtape) {
            dtape = lua(resolveInput(file.path));
        }
        if (file.isTimeline && file.isKtape) {
            ktape = lua(resolveInput(file.path));
        }
        if (file.isMainSequence) {
            mainSequence = lua(resolveInput(file.path));
        }
    };

    // No track, it's required
    if (!trk) {
        throw new Error("Track file could not be loaded.");
    };

    // Get the sample rate
    const sampleRate = getSampleRate(resolveInput(audioPath));
    logger.info(`Sample rate detected: ${sampleRate} Hz`);
    const markers = trk?.structure.MusicTrackStructure.markers.map((m: { VAL: any; }) => m.VAL);
    const unitConverter = new UnitConverter(markers ?? [0], sampleRate, 24);

    // If timeline is loaded, transform it into seperate Dtape and Ktape files
    if (timeline && !dtape && !ktape) {
        dtape = tmlToDtape(timeline, unitConverter);
        ktape = tmlToKtape(timeline, unitConverter);
        // fs.writeFileSync("./ktape-converted.json", JSON.stringify(ktape, null, 2));
    };

    // Find the preview, prefering coverflow
    let preview = audioPreviews.find((a) => a.AudioPreview.name === "coverflow");
    if (!preview) {
        logger.warn(`No coverflow preview values were found, using prelobby preview.`);
        preview = audioPreviews.find((a) => a.AudioPreview.name === "prelobby");
        if (!preview) {
            throw new Error(`No preview values were found in the SongDesc.tpl file.`);
        };
    };

    logger.info("Starting to process the map...");

    // JDBest Song structure
    const song: Song = {
        class: "SongDescriptor",
        mapName: mapName || "",
        originalJDVersion: typeof jdVersion === 'number' ? jdVersion : parseInt(String(jdVersion)) || 0,
        title: title || "",
        artist: artist || "",
        difficulty: parseDifficulty(difficulty),
        sweatDifficulty: parseSweatDifficulty(sweatDifficulty),
        numCoach: parseNumCoach(numCoach),
        flags: parseGameModeFlags(flags),
        status: parseGameModeStatus(status),
        mode: parseGameMode(mode)
    };

    // JDBest MusicTrack structure
    const musicTrack: MusicTrack = {
        class: "MusicTrack",
        markers: trk.structure.MusicTrackStructure.markers.map(m => m.VAL),
        comments: trk.structure.MusicTrackStructure.comments.map(c => c.Comment),
        sections: trk.structure.MusicTrackStructure.sections.map(s => s.MusicSection),
        startBeat: trk.structure.MusicTrackStructure.startBeat,
        endBeat: trk.structure.MusicTrackStructure.endBeat,
        audioPreview: {
            startBeat: preview.AudioPreview.startbeat,
            endBeat: preview.AudioPreview.endbeat
        },
        videoStartTime: trk.structure.MusicTrackStructure.videoStartTime,
        volume: 0
    };

    // JDBest Dance structure
    const dance: Dance = {
        class: "Dance",
        clips: dtape
            ? dtape.params.Tape.Clips.map(clip => {
                if (clip.MotionClip) {
                    return {
                        class: "MotionClip",
                        id: clip.MotionClip.Id,
                        trackId: clip.MotionClip.TrackId,
                        isActive: clip.MotionClip.IsActive,
                        startTime: clip.MotionClip.StartTime,
                        duration: clip.MotionClip.Duration,
                        classifierPath: fixEnginePath(mapName, clip.MotionClip.ClassifierPath, "move"),
                        goldMove: clip.MotionClip.GoldMove,
                        coachId: clip.MotionClip.CoachId,
                        moveType: clip.MotionClip.MoveType
                    }
                } else if (clip.GoldEffectClip) {
                    return {
                        class: "GoldEffectClip",
                        id: clip.GoldEffectClip.Id,
                        trackId: clip.GoldEffectClip.TrackId,
                        isActive: clip.GoldEffectClip.IsActive,
                        startTime: clip.GoldEffectClip.StartTime,
                        duration: clip.GoldEffectClip.Duration,
                        effectType: clip.GoldEffectClip.EffectType
                    }
                } else if (clip.PictogramClip) {
                    return {
                        class: "PictogramClip",
                        id: clip.PictogramClip.Id,
                        trackId: clip.PictogramClip.TrackId,
                        isActive: clip.PictogramClip.IsActive,
                        startTime: clip.PictogramClip.StartTime,
                        duration: 24, // 1 beat = 24 ticks
                        pictoPath: fixEnginePath(mapName, clip.PictogramClip.PictoPath, "picto")
                    }
                }
                return undefined;
            }).filter(Boolean) as (MotionClip | PictoClip | GoldEffectClip)[]
            : [],
        mapName: mapName,
    };

    // JDBest Karaoke structure
    const karaoke: Karaoke = {
        class: "Karaoke",
        clips: ktape?.params.Tape.Clips.map(clip => {
            if (clip.KaraokeClip) {
                return {
                    class: "KaraokeClip",
                    id: clip.KaraokeClip.Id,
                    trackId: clip.KaraokeClip.TrackId,
                    isActive: clip.KaraokeClip.IsActive,
                    startTime: clip.KaraokeClip.StartTime,
                    duration: clip.KaraokeClip.Duration,
                    lyrics: clip.KaraokeClip.Lyrics,
                    isEndOfLine: clip.KaraokeClip.IsEndOfLine,
                    contentType: clip.KaraokeClip.ContentType
                }
            }
            return undefined;
        }).filter(Boolean) as KaraokeClip[] || [],
        mapName: mapName
    };

    const cinematics: Cinematics = {
        class: "Cinematics",
        clips: (mainSequence?.params.Tape.Clips ?? []).map(clip => {
            if (clip.SoundSetClip) {
                return {
                    class: "SoundSetClip",
                    id: clip.SoundSetClip.Id,
                    trackId: clip.SoundSetClip.TrackId,
                    startTime: clip.SoundSetClip.StartTime,
                    duration: clip.SoundSetClip.Duration,
                    soundSetPath: clip.SoundSetClip.SoundSetPath
                }
            }
            return undefined;
        }).filter(Boolean) as SoundSetClip[] || [],
        mapName: mapName
    };

    // Export the files to Best formatted folder
    exporter(output, mapName, song, musicTrack, dance, karaoke, cinematics);

    const ambFolder = path.resolve(input, "Audio/AMB");
    let ambFiles : string[] = [];
    if (fs.existsSync(ambFolder)) {
        ambFiles = fs.readdirSync(ambFolder).filter(amb => audioExtensions.includes(path.extname(amb)));
        ambFiles = ambFiles.map(amb => path.resolve(ambFolder, amb));
    };

    // Return results and pictos, moves and audio path for main script to handle processing.
    return {
        mapName, song, musicTrack, dance, karaoke,
        pictosPath,
        movesPath,
        audioPath,
        menuArtPath,
        ambFiles
    };
};
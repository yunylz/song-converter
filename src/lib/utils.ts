import fs from "fs";
import path from "path";

import logger from "./logger";

import { Difficulty, GameMode, GameModeFlags, GameModeStatus, NumCoach, SweatDifficulty } from "../types/godot";
import { Dtape } from "../types/lua/dtape";
import { Ktape } from "../types/lua/ktape";
import { Block, Layer, Mfe, Picto, Timeline } from "../types/lua/tml";
import UnitConverter from "./unit-converter";

/**
 * Generates a random integer between min and max (inclusive).
 * @param min Minimum value (default: 1,000,000,000).
 * @param max Maximum value (default: 4,294,967,295).
 * @returns Random integer within range.
 */
const generateRandomNumber = (min = 1000000000, max = 4294967295): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param array Array to shuffle.
 * @returns The shuffled array (same reference).
 */
const shuffleArray = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/**
 * Converts file paths to engine-friendly paths under `res://maps/{mapName}/`.
 * @param mapName Name of the map/song.
 * @param filePath Original file path.
 * @param type Asset type ("move", "picto", or "audio").
 * @returns Engine-relative lowercase path.
 */
export const fixEnginePath = (mapName: string, filePath: string, type: "move" | "picto" | "audio"): string => {
    const songBaseFolder = `res://maps/${mapName}/`;
    let finalPath : string;
    switch (type) {
        case "move":
            finalPath = path.join("timeline/moves", path.basename(filePath));
            break;
        case "picto":
            finalPath = path.join("timeline/pictos", path.basename(filePath));
            finalPath = finalPath.replace(".tga", ".png");
            break;
        case "audio":
            finalPath = path.join("audio", path.basename(filePath));
            break;
        default:
            logger.warn(`Unknown asset type "${type}", not fixing path.`);
            finalPath = filePath;
            break;
    };

    return (songBaseFolder + finalPath).toLowerCase();
}

/**
 * Parses difficulty from string or enum notation.
 * @param value Raw difficulty string (e.g. "SongDifficulty.Hard", "2").
 * @returns Numeric difficulty (defaults to Normal).
 */
export const parseDifficulty = (value: string | null): number => {
    if (!value) return Difficulty.Normal;
    if (value.includes('.')) {
        const difficultyName = value.split('.')[1];
        switch (difficultyName) {
            case 'Easy': return Difficulty.Easy;
            case 'Normal': return Difficulty.Normal;
            case 'Hard': return Difficulty.Hard;
            case 'Extreme': return Difficulty.Extreme;
            default: return Difficulty.Normal;
        }
    }
    return parseInt(value) || Difficulty.Normal;
};

/**
 * Parses number of coaches.
 * @param value Raw coach string (e.g. "NumCoach.Duo", "2").
 * @returns Numeric coach count (defaults to Solo).
 */
export const parseNumCoach = (value: string | null): number => {
    if (!value) return NumCoach.Solo;
    if (value.includes('.')) {
        const coachType = value.split('.')[1];
        switch (coachType) {
            case 'Solo': return NumCoach.Solo;
            case 'Duo': return NumCoach.Duo;
            case 'Trio': return NumCoach.Trio;
            case 'Quatuor': return NumCoach.Quatuor;
            default: return NumCoach.Solo;
        }
    }
    return parseInt(value) || NumCoach.Solo;
};

/**
 * Parses sweat difficulty level.
 * @param value Raw sweat difficulty string (e.g. "SweatDifficulty.Medium", "2").
 * @returns Numeric sweat difficulty (defaults to Low).
 */
export const parseSweatDifficulty = (value: string | null): number => {
    if (!value) return SweatDifficulty.Low;
    if (value.includes('.')) {
        const sweatDifficultyName = value.split('.')[1];
        switch (sweatDifficultyName) {
            case 'Low': return SweatDifficulty.Low;
            case 'Medium': return SweatDifficulty.Medium;
            case 'High': return SweatDifficulty.High;
            default: return SweatDifficulty.Low;
        }
    }
    return parseInt(value) || SweatDifficulty.Low;
};

/**
 * Parses game mode flags.
 * @param value Raw flag string (e.g. "GameModeFlags.Mashup", "4").
 * @returns Numeric game mode flag (defaults to None).
 */
export const parseGameModeFlags = (value: string | null): number => {
    if (!value) return GameModeFlags.Classic;
    if (value.includes('.')) {
        const flagsName = value.split('.')[1];
        switch (flagsName) {
            case 'Classic': return GameModeFlags.Classic;
            case 'Mashup': return GameModeFlags.Mashup;
            case 'PartyMaster': return GameModeFlags.PartyMaster;
            case 'Sweat': return GameModeFlags.Sweat;
            case 'Battle': return GameModeFlags.Battle;
            case 'OnStage': return GameModeFlags.OnStage;
            case 'MusicMotion': return GameModeFlags.MusicMotion;
            default: return GameModeFlags.None;
        }
    }
    return parseInt(value) || GameModeFlags.None;
};

/**
 * Parses game mode status.
 * @param value Raw status string (e.g. "GameModeStatus.Hidden", "2").
 * @returns Numeric game mode status (defaults to Unavailable).
 */
export const parseGameModeStatus = (value: string | null): number => {
    if (!value) return GameModeStatus.Available;
    if (value.includes('.')) {
        const statusName = value.split('.')[1];
        switch (statusName) {
            case 'Unavailable': return GameModeStatus.Unavailable;
            case 'Hidden': return GameModeStatus.Hidden;
            case 'Locked': return GameModeStatus.Locked;
            case 'Available': return GameModeStatus.Available;
            default: return GameModeStatus.Unavailable;
        }
    }
    return parseInt(value) || GameModeStatus.Unavailable;
};

/**
 * Parses game mode.
 * @param value Raw mode string (e.g. "GameMode.Mashup", "3").
 * @returns Numeric game mode (defaults to Classic).
 */
export const parseGameMode = (value: string | null): number => {
    if (!value) return GameMode.Classic;
    if (value.includes('.')) {
        const gameModeName = value.split('.')[1];
        switch (gameModeName) {
            case 'Classic': return GameMode.Classic;
            case 'Mashup': return GameMode.Mashup;
            case 'PartyMaster': return GameMode.PartyMaster;
            case 'Sweat': return GameMode.Sweat;
            case 'Battle': return GameMode.Battle;
            case 'OnStage': return GameMode.OnStage;
            case 'MusicMotion': return GameMode.MusicMotion;
            default: return GameMode.Classic;
        }
    }
    return parseInt(value) || GameMode.Classic;
};

/**
 * Converts a TML (timeline) to a DTape structure for motion/picto playback.
 * @param tml Parsed timeline object.
 * @param unitConverter Unit converter for beat <-> ticks conversion.
 * @returns DTape object with Clips and metadata.
 */
export const tmlToDtape = (tml: Timeline, unitConverter: UnitConverter): Dtape => {
    let moveTrackIds = Object.fromEntries([...Array(7).keys()].map(i => [i, generateRandomNumber()]));
    
    const allMoves = [
        ...(tml.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.moves ?? []),
        ...(tml.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.movesKinect ?? []),
    ];

    const moves = allMoves.map((move: Mfe) => ({
        NAME: "MotionClip",
        MotionClip: {
            Id: generateRandomNumber(),
            TrackId: moveTrackIds[move.MoveClip.layerID ?? 0] || generateRandomNumber(),
            IsActive: 0,
            StartTime: unitConverter.ticksFromBeat(move.MoveClip.startPosition),
            Duration: unitConverter.ticksFromBeat(move.MoveClip.stopPosition - move.MoveClip.startPosition),
            ClassifierPath: move.MoveClip.classifierPath,
            GoldMove: move.MoveClip.goldMove ?? 0,
            CoachId: move.MoveClip.layerID ?? 0,
            MoveType: move.MoveClip.classifierPath.endsWith(".gesture") ? 1 : 0,
            Color: "0xFFE21F30",
            MotionPlatformSpecifics: []
        }
    }));

    const pictosTrackId = generateRandomNumber();
    const pictos = tml.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.pictos.map((picto: Picto) => ({
        NAME: "PictogramClip",
        PictogramClip: {
            Id: generateRandomNumber(),
            TrackId: pictosTrackId,
            IsActive: 0,
            StartTime: unitConverter.ticksFromBeat(picto.PictoClip.position),
            Duration: 24, // 1 beat = 24 ticks
            PictoPath: picto.PictoClip.texturePath,
            CoachCount: 0
        }
    }));

    const goldMoveLayerTypes = [12];
    const goldMoveLayers = tml.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.layers
        .filter((layer : Layer) => goldMoveLayerTypes.includes(layer.TimelineLayer.layerType));
    const goldMoveBlocks = tml.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.Block
        .filter((block: Block) => goldMoveLayers.some(layer => layer.TimelineLayer.layerID === block.TimelineBlock.layerID));

    const goldMoves = goldMoveBlocks.map((block: Block) => ({
        NAME: "GoldEffectClip",
        GoldEffectClip: {
            Id: generateRandomNumber(),
            TrackId: generateRandomNumber(),
            IsActive: 0,
            StartTime: unitConverter.ticksFromBeat(block.TimelineBlock.startPosition),
            Duration: 24,
            EffectType: block.TimelineBlock.modelName.toLowerCase() == "goldmovecascade" ? 2 : 0
        }
    }));

    return {
        params: {
            NAME: "Tape",
            Tape: {
                Clips: shuffleArray([
                    ...moves,
                    ...pictos,
                    ...goldMoves
                ]),
                Tracks: [],
                TapeClock: 0,
                TapeBarCount: 0,
                FreeResourcesAfterPlay: 0,
                MapName: "",
                SoundwichEvent: ""
            }
        }
    }
};

/**
 * Converts a TML (timeline) to a KTape structure for karaoke/lyrics playback.
 * @param tml Parsed timeline object.
 * @param unitConverter Unit converter for beat <-> ticks conversion.
 * @returns KTape object with Clips and metadata.
 */
export const tmlToKtape = (tml: Timeline, unitConverter: UnitConverter): Ktape => {
    return {
        params: {
            NAME: "Tape",
            Tape: {
                Clips: shuffleArray([
                    ...tml.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.lyrics.map(lyric => ({
                        NAME: "KaraokeLyricClip",
                        KaraokeClip: {
                            Id: generateRandomNumber(),
                            TrackId: generateRandomNumber(),
                            IsActive: 1,
                            StartTime: unitConverter.ticksFromBeat(lyric.LyricClip.startPosition),
                            Duration: unitConverter.ticksFromBeat(lyric.LyricClip.stopPosition - lyric.LyricClip.startPosition),
                            Pitch: 8.661958,
                            Lyrics: lyric.LyricClip.text,
                            IsEndOfLine: lyric.LyricClip.isLineEnding ?? 0,
                            ContentType: 1,
                            StartTimeTolerance: 4,
                            EndTimeTolerance: 4,
                            SemitoneTolerance: 5
                        }
                    })),
                ]),
                Tracks: [],
                TapeClock: 0,
                TapeBarCount: 0,
                FreeResourcesAfterPlay: 0,
                MapName: "",
                SoundwichEvent: ""
            }
        }
    };
};

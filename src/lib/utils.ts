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

/** Generic parser for enum values */
const parseEnum = <T extends number>(value: string | null, enumType: any, defaultValue: T): T => {
  if (!value) return defaultValue;

  // Only keep numeric values
  const numericValues = Object.values(enumType).filter(v => typeof v === "number") as number[];

  // If numeric string, return the number if it's in enum
  const num = parseInt(value);
  if (!isNaN(num) && numericValues.includes(num)) return num as T;

  // Otherwise, take the part after dot (if any) and lookup enum by key
  const key = value.includes('.') ? value.split('.')[1] : value;
  return (enumType[key] ?? defaultValue) as T;
};

/** ---------------- Specific parsers ---------------- */
export const parseNumCoach = (value: string | null) =>
  parseEnum(value, NumCoach, NumCoach.Solo);

export const parseSweatDifficulty = (value: string | null) =>
  parseEnum(value, SweatDifficulty, SweatDifficulty.Low);

export const parseGameModeFlags = (value: string | null) =>
  parseEnum(value, GameModeFlags, GameModeFlags.Classic);

export const parseGameModeStatus = (value: string | null) =>
  parseEnum(value, GameModeStatus, GameModeStatus.Available);

export const parseGameMode = (value: string | null) =>
  parseEnum(value, GameMode, GameMode.Classic);

export const parseDifficulty = (value: string | null) =>
  parseEnum(value, Difficulty, Difficulty.Normal);

export const assureJDVersion = (value: number | null) : number => {
    if (value === 5) return 2014;
    else return value || 2018; // default to 2018, (idk why)
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

export const fixSoundSetPath = (path: string) => {
    if (path.endsWith(".tpl")) path = path.replace(".tpl", ".ogg");
    if (path.includes("set_")) path = path.replace("set_", "");
    return path;
};
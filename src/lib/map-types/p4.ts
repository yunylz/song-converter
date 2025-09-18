import fs from "fs";
import path from "path";

import logger from "../logger";
import lua from "../lua";
import exporter from "../exporter";
import {
  fixEnginePath,
  parseDifficulty,
  parseGameMode,
  parseGameModeFlags,
  parseGameModeStatus,
  parseNumCoach,
  parseSweatDifficulty,
  tmlToDtape,
  tmlToKtape,
} from "../utils";
import { audioExtensions } from "../audio";
import { getSampleRate } from "../ffmpeg";
import UnitConverter from "../../lib/unit-converter";

import { SongDescTemplate } from "../../types/lua/songdesc";
import {
  BackgroundType,
  Difficulty,
  LyricsType,
} from "../../types/godot";
import { Track } from "../../types/lua/trk";
import { Timeline } from "../../types/lua/tml";
import { Dtape } from "../../types/lua/dtape";
import { Ktape } from "../../types/lua/ktape";
import { MainSequence } from "../../types/lua/mainsequence";
import best from "../best";

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
export default async (input: string, output: string) => {
  const resolveInput = (filePath: string) => path.resolve(input, filePath);

  /** ---------------- Song Descriptor ---------------- */
  const songDescPath = path.join(input, "SongDesc.tpl");
  if (!fs.existsSync(songDescPath)) {
    throw new Error(`Song descriptor was not found in the input folder.`);
  }

  logger.info("Trying to find the mapName...");
  const songDesc: SongDescTemplate = lua(songDescPath);
  const songTemplate = songDesc.params.Actor_Template.COMPONENTS[0].JD_SongDescTemplate;

  let isJD5 = false;

  const {
    MapName: mapName,
    Title: title,
    Artist: artist,
    Difficulty: difficulty,
    SweatDifficulty: sweatDifficulty,
    NumCoach: numCoach,
    AudioPreviews: audioPreviews,
    JDVersion: jdVersion,
    GameModes,
    Status,
    Mode,
    BackgroundType,
    LyricsType,
    LocaleID,
    MojoValue,
  } = songTemplate;

  const flags = GameModes?.[0]?.GameModeDesc?.flags ?? null;
  const status = Status || (GameModes?.[0]?.GameModeDesc?.status ?? null);
  const mode = Mode || (GameModes?.[0]?.GameModeDesc?.mode ?? null);
  const backgroundType: BackgroundType = (BackgroundType ?? 0);
  const lyricsType: LyricsType = (LyricsType ?? 0);
  const localeID = LocaleID || 4294967295; // default biggest 32 bit number
  const mojoValue = MojoValue || 0;

  if (!mapName) {
    throw new Error(`Map name was not found in the SongDesc.tpl file.`);
  }
  logger.info(`Map name found: "${mapName}"`);

  /** ---------------- Required Files ---------------- */
  const pictosPath = path.resolve(input, "timeline/pictos");
  const movesPath = path.resolve(input, "timeline/moves");
  const audioPath = path.resolve(input, "Audio", mapName + ".wav");
  const menuArtPath = path.resolve(input, "MenuArt/Textures");

  const requiredFiles = [pictosPath, movesPath, audioPath, menuArtPath];
  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files/folders: ${missingFiles.join(", ")}`);
  }

  /** ---------------- File Setup ---------------- */
  const files: FileEntry[] = [
    { type: "trk", path: `Audio/${mapName}.trk`, isTrk: true },
    { type: "cinematics", path: `Cinematics/${mapName}_MainSequence.tape`, isMainSequence: true },
  ];

  if (jdVersion == 5 || jdVersion == 2014) {
    isJD5 = true;
    files.push({ type: "timeline", path: `timeline/timeline.tpl`, isJd5: true, isTimeline: true });
  } else {
    files.push(
      { type: "dtape", path: `timeline/${mapName}_TML_Dance.dtape`, isDtape: true, isTimeline: true },
      { type: "ktape", path: `timeline/${mapName}_TML_Karaoke.ktape`, isKtape: true, isTimeline: true }
    );
  }

  /** ---------------- Load Files ---------------- */
  let trk: Track | undefined;
  let timeline: Timeline | undefined;
  let dtape: Dtape | undefined;
  let ktape: Ktape | undefined;
  let mainSequence: MainSequence | undefined;

  for (const file of files) {
    const filePath = resolveInput(file.path);
    if (file.isTrk) trk = lua(filePath);
    if (file.isTimeline && file.isJd5) timeline = lua(filePath);
    if (file.isTimeline && file.isDtape) dtape = lua(filePath);
    if (file.isTimeline && file.isKtape) ktape = lua(filePath);
    if (file.isMainSequence) mainSequence = lua(filePath);
  }

  if (!trk) throw new Error("Track file could not be loaded.");

  /** ---------------- Audio & Unit Converter ---------------- */
  const sampleRate = getSampleRate(resolveInput(audioPath));
  logger.info(`Sample rate detected: ${sampleRate} Hz`);

  const markers = trk?.structure.MusicTrackStructure.markers.map((m: { VAL: any }) => m.VAL);
  const unitConverter = new UnitConverter(markers ?? [0], sampleRate, 24);

  if (timeline && !dtape && !ktape) {
    dtape = tmlToDtape(timeline, unitConverter);
    ktape = tmlToKtape(timeline, unitConverter);
  }

  /** ---------------- Preview ---------------- */
  let preview = {
    entry: 0,
    loopStart: 30,
    loopEnd: 60,
  };

  // Try to find the preview values

  // If the track has them, use them
  if (trk.structure.MusicTrackStructure.previewEntry && trk.structure.MusicTrackStructure.previewLoopStart && trk.structure.MusicTrackStructure.previewLoopEnd) {
    preview = {
      entry: trk.structure.MusicTrackStructure.previewEntry,
      loopStart: trk.structure.MusicTrackStructure.previewLoopStart,
      loopEnd: trk.structure.MusicTrackStructure.previewLoopEnd,
    };
  }
  // If track doesnt have them, it means they might be in songDesc.
  else if (audioPreviews?.length > 0) {
    // Find coverflow
    const coverFlow = audioPreviews?.find(a => a.AudioPreview.name === "coverflow");
    const preLobby = audioPreviews?.find(a => a.AudioPreview.name === "prelobby");
    const data = coverFlow ?? preLobby;
    if (!data) {
      logger.warn(`Neither coverflow nor prelobby preview values were found, using default preview values.`);
    }
    else {
      logger.info(`Found "${data.AudioPreview.name}" preview values.`);
      preview = {
        entry: data.AudioPreview.startbeat,
        loopStart: data.AudioPreview.startbeat,
        loopEnd: data.AudioPreview.endbeat,
      };
    }
  }

  logger.info("Starting to process the map...");

  // Convert imported map into Best format
  const { song, musicTrack, dance, karaoke } = best({
    mapName,
    outputMapFolder: output,
    jdVersion: 5,
    songDesc: {
      class: "SongDescriptor",
      mapName: mapName,
      originalJDVersion: jdVersion ?? 2018,
      localeID: localeID,
      title: (title ?? ""),
      artist: (artist ?? ""),
      difficulty: parseDifficulty(difficulty) ?? Difficulty.Normal,
      sweatDifficulty: parseSweatDifficulty(sweatDifficulty),
      numCoach: parseNumCoach(numCoach),
      backgroundType: backgroundType,
      lyricsType: lyricsType,
      mojoValue: mojoValue ?? 0,
      flags: parseGameModeFlags(typeof flags === "string" ? flags : ""),
      status: parseGameModeStatus(typeof status === "string" ? status : null),
      mode: parseGameMode(typeof mode === "string" ? mode : null),
    },
    trk,
    audioPreview: preview,
    dtape,
    ktape,
    mainSequence
  });

  // Collect AMB files if they exist and pass them to main handler
  const ambFolder = path.resolve(input, "Audio/AMB");
  let ambFiles: string[] = [];
  if (fs.existsSync(ambFolder)) {
    ambFiles = fs
      .readdirSync(ambFolder)
      .filter((amb) => audioExtensions.includes(path.extname(amb)))
      .map((amb) => path.resolve(ambFolder, amb));
  };

  const videosCoachFolder = path.resolve(input, "VideosCoach");
  let foundVideo;

  if (fs.existsSync(videosCoachFolder)) {
    const videosCoachFiles = fs.readdirSync(videosCoachFolder).map(f => f.toLowerCase());

    const acceptedFiles = [
      `${mapName}.hd.webm`,
      `${mapName}_ultra.hd.webm`,
      `${mapName}.webm`,
    ].map(f => f.toLowerCase());

    foundVideo = videosCoachFiles.find(f => acceptedFiles.includes(f));

    if (!foundVideo) {
      logger.warn(`No video file was found in the VideosCoach folder.`);
    } else {
      logger.info(`Found the best video file: ${foundVideo}`);
    };
  };

  const videoPath = foundVideo ? path.resolve(videosCoachFolder, foundVideo) : null;

  return {
    mapName,
    song,
    musicTrack,
    dance,
    karaoke,
    pictosPath,
    movesPath,
    audioPath,
    menuArtPath,
    ambFiles,
    videoPath
  };
};
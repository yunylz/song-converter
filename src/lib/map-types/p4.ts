import fs from "fs";
import path from "path";
import logger from "../logger";
import lua from "../lua";
import { getSampleRate } from "../ffmpeg";
import { SongDescTemplate } from "../../types/lua/songdesc";
import { Track } from "../../types/lua/trk";
import { MainSequence } from "../../types/lua/mainsequence";
import best from "../best";
import {
  parseDifficulty,
  parseGameMode,
  parseGameModeFlags,
  parseGameModeStatus,
  parseNumCoach,
  parseSweatDifficulty,
  tmlToDtape,
  tmlToKtape,
} from "../utils";
import UnitConverter from "../../lib/unit-converter";
import { Dtape } from "../../types/lua/dtape";
import { Ktape } from "../../types/lua/ktape";

export default async (input: string, output: string, version: number, skipExport: boolean = false) => {
  const resolveInput = (filePath: string) => path.resolve(input, filePath);

  const songDescPath = path.join(input, "SongDesc.tpl");
  if (!fs.existsSync(songDescPath)) {
    throw new Error("Song descriptor was not found in the input folder.");
  }

  const songDesc: SongDescTemplate = lua(songDescPath);
  const songTemplate = songDesc.params.Actor_Template.COMPONENTS[0].JD_SongDescTemplate;

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
    BackgroundType: bgType,
    LyricsType: lType,
    LocaleID,
    MojoValue,
    DefaultColors
  } = songTemplate;

  if (!mapName) throw new Error("Map name was not found in SongDesc.tpl");

  // --- FIX: Parse Color Correctly ---
  // Default to Red if missing
  let lyricsColor = "#FF0000"; 

  if (DefaultColors && Array.isArray(DefaultColors)) {
    const lyricsEntry = DefaultColors.find((entry) => entry.KEY?.toLowerCase() === "lyrics");
    
    if (lyricsEntry && lyricsEntry.VAL) {
      // 1. Remove 0x or #
      let rawHex = lyricsEntry.VAL.replace(/^0x|^#/, "");

      // 2. Handle ARGB (8 chars) -> RGB (6 chars)
      // Lua colors are often 0xAARRGGBB. We want RRGGBB.
      if (rawHex.length === 8) {
        rawHex = rawHex.substring(2); 
      }

      // 3. Ensure we have exactly 6 chars now, otherwise fallback
      if (rawHex.length === 6) {
        lyricsColor = `#${rawHex.toUpperCase()}`;
      }
    }
  }

  const audioPath = path.resolve(input, "Audio", mapName + ".wav");
  const trkPath = resolveInput(`Audio/${mapName}.trk`);
  const mainSequencePath = resolveInput(`Cinematics/${mapName}_MainSequence.tape`);

  let trk: Track;
  let mainSequence: MainSequence;

  if (!fs.existsSync(trkPath)) {
    logger.warn(`Track file is missing. Please make sure the track file is present in the input folder.`);
    process.exit(1);
  } else {
    trk = lua(trkPath);
  }

  if (!fs.existsSync(mainSequencePath)) {
    logger.warn(`Main sequence file is missing. Default values will be used.`);
    mainSequence = {
      params: {
        NAME: "Tape",
        Tape: {
          Clips: [],
          Tracks: []
        }
      }
    }
  } else {
    mainSequence = lua(mainSequencePath);
  }

  if (!trk || !trk.structure || !trk.structure.MusicTrackStructure) {
    throw new Error("Track file is missing required MusicTrackStructure.");
  }

  let songResult = null;
  let musicTrackResult = trk; 

  if (!skipExport) {
    logger.info("Starting to process the map...");
    const sampleRate = getSampleRate(audioPath);
    
    const markers = trk.structure.MusicTrackStructure.markers.map((m: any) => m.VAL);
    const unitConverter = new UnitConverter(markers, sampleRate, 24);

    let dtape: Dtape, ktape: Ktape;
    const timelinePath = resolveInput("timeline/timeline.tpl");
    if (fs.existsSync(timelinePath)) {
        const timeline = lua(timelinePath);
        dtape = tmlToDtape(timeline, unitConverter);
        ktape = tmlToKtape(timeline, unitConverter);
    } else {
      logger.info("No timeline file found. Will try to look for UAF LUA files.");

      const dtapePath = path.join(input, `timeline/${mapName}_TML_Dance.dtape`);
      const ktapePath = path.join(input, `timeline/${mapName}_TML_Karaoke.ktape`);

      if (!fs.existsSync(dtapePath)) {
        logger.warn(`No DTape file found at ${dtapePath}. Please make sure the UAF LUA files are present in the input folder.`);
        process.exit(1);
      } else {
        logger.success(`Found DTape file at ${dtapePath}`);
        dtape = lua(dtapePath);
      }

      if (!fs.existsSync(ktapePath)) {
        logger.warn(`No KTape file found at ${ktapePath}. Please make sure the UAF LUA files are present in the input folder.`);
        process.exit(1);
      } else {
        logger.success(`Found KTape file at ${ktapePath}`);
        ktape = lua(ktapePath);
      }
    }

    const trackStructure = trk.structure.MusicTrackStructure;
    let preview = {
      entry: trackStructure.previewEntry || 0,
      loopStart: trackStructure.previewLoopStart || 30,
      loopEnd: trackStructure.previewLoopEnd || 60,
    };

    const processed = best({
      mapName,
      outputMapFolder: output,
      jdVersion: jdVersion || 2018,
      songDesc: {
        class: "SongDescriptor",
        mapName,
        version,
        localeID: LocaleID || 0,
        title: title || "",
        artist: artist || "",
        difficulty: parseDifficulty(difficulty) || 1,
        sweatDifficulty: parseSweatDifficulty(sweatDifficulty),
        numCoach: parseNumCoach(numCoach),
        backgroundType: bgType || 0,
        lyricsType: lType || 0,
        mojoValue: MojoValue || 0,
        flags: parseGameModeFlags(GameModes?.[0]?.GameModeDesc?.flags || ""),
        status: parseGameModeStatus(Status || GameModes?.[0]?.GameModeDesc?.status || null),
        mode: parseGameMode(Mode || GameModes?.[0]?.GameModeDesc?.mode || null),
        lyricsColor: lyricsColor
      },
      trk,
      audioPreview: preview,
      dtape,
      ktape,
      mainSequence
    });
    
    songResult = processed.song;
    // Ensure color is patched in if 'best' didn't add it
    if (songResult) (songResult as any).lyricsColor = lyricsColor;

    musicTrackResult = processed.musicTrack;
  }
  else {
      // Stub for when skipping export
      songResult = {
          mapName,
          title: title || "",
          artist: artist || "",
          originalJDVersion: jdVersion,
          numCoach: parseNumCoach(numCoach),
          difficulty: parseDifficulty(difficulty) || 1,
          sweatDifficulty: parseSweatDifficulty(sweatDifficulty),
          lyricsColor: lyricsColor
      };
  }

  const pictosPath = path.resolve(input, "timeline/pictos");
  const movesPath = path.resolve(input, "timeline/moves");
  const menuArtPath = path.resolve(input, "MenuArt/Textures");
  const ambFolder = path.resolve(input, "Audio/AMB");
  const ambFiles = fs.existsSync(ambFolder) ? fs.readdirSync(ambFolder).map(f => path.resolve(ambFolder, f)) : [];

  const videosCoachFolder = path.resolve(input, "VideosCoach");
  let videoPath = null;
  if (fs.existsSync(videosCoachFolder)) {
    const videoFiles = fs.readdirSync(videosCoachFolder);
    const found = videoFiles.find(f => f.toLowerCase().includes(mapName.toLowerCase()) && f.endsWith(".webm"));
    if (found) videoPath = path.resolve(videosCoachFolder, found);
  }

  return {
    mapName,
    song: songResult,
    musicTrack: musicTrackResult,
    ambFiles,
    videoPath,
    mainSequence,
    pictosPath,
    movesPath,
    audioPath,
    menuArtPath
  };
};
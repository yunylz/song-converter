import fs from "fs";
import path from "path";
import logger from "../logger";
import lua from "../lua";
import { getSampleRate } from "../ffmpeg";
import { SongDescTemplate } from "../../types/lua/songdesc";
import { BackgroundType, Difficulty, LyricsType } from "../../types/godot";
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
  } = songTemplate;

  if (!mapName) throw new Error("Map name was not found in SongDesc.tpl");

  const audioPath = path.resolve(input, "Audio", mapName + ".wav");
  const trkPath = resolveInput(`Audio/${mapName}.trk`);
  const mainSequencePath = resolveInput(`Cinematics/${mapName}_MainSequence.tape`);

  // Load these early as they are needed for both workflows
  const trk: Track = lua(trkPath);
  const mainSequence: MainSequence = lua(mainSequencePath);

  if (!trk || !trk.structure || !trk.structure.MusicTrackStructure) {
    throw new Error("Track file is missing required MusicTrackStructure.");
  }

  let songResult = null;
  let musicTrackResult = trk; 

  if (!skipExport) {
    logger.info("Starting to process the map...");
    const sampleRate = getSampleRate(audioPath);
    
    // Fixed: Ensure markers access matches the structure
    const markers = trk.structure.MusicTrackStructure.markers.map((m: any) => m.VAL);
    const unitConverter = new UnitConverter(markers, sampleRate, 24);

    let dtape, ktape;
    const timelinePath = resolveInput("timeline/timeline.tpl");
    if (fs.existsSync(timelinePath)) {
        const timeline = lua(timelinePath);
        dtape = tmlToDtape(timeline, unitConverter);
        ktape = tmlToKtape(timeline, unitConverter);
    }

    // Fixed: Properly handle the preview logic that was crashing
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
      },
      trk,
      audioPreview: preview, // Added this back as best() likely needs it
      dtape,
      ktape,
      mainSequence
    });
    
    songResult = processed.song;
    musicTrackResult = processed.musicTrack;
  }

  // File discovery for sc.ts
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
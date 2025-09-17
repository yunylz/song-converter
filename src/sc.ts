import fs from "fs";

import cli from "./cli";
import logger from "./lib/logger";
import detectMapType from "./lib/map-detector";
import p4 from "./lib/map-types/p4";
import pictos from "./lib/pictos";
import { checkPrerequisites } from "./lib/prerequisites";

import { Dance, Karaoke, MapType, MusicTrack, Song } from "./types/godot";
import menuart from "./lib/menuart";
import audio from "./lib/audio";
import movespace from "./lib/movespace";

let project: { version: string };

(async () => {
  project = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

  const options = cli(project);

  const input = options.input;
  const output = options.output;
  const skipPictos = !options.pictos;
  const skipMoves = !options.moves;
  const skipAudio = !options.audio;
  const skipMenuart = !options.menuart;

  checkPrerequisites();

  console.log(`SongConverter - made for JDBest`);
  console.log(`----------------------------------`);
  console.log(``);

  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  console.log(``);

  logger.info(`Detecting map type...`);

  const mapType = await detectMapType(input);

  let mapResult: {
    mapName: string;
    song: Song;
    musicTrack: MusicTrack;
    dance: Dance;
    karaoke: Karaoke;
    pictosPath: string;
    movesPath: string;
    menuArtPath: string;
    audioPath: string;
    ambFiles: string[];
  };

  switch (mapType) {
    case MapType.P4:
      mapResult = await p4(input, output,);
      break;
    case MapType.UAF:
      logger.warn(`Converting UAF map type is not supported yet.`);
      process.exit(1);
      break;
    case MapType.NOW:
      logger.warn(`Converting NOW map type is not supported yet.`);
      process.exit(1);
      break;
    default:
      logger.error(`Could not detect map type.`);
      process.exit(1);
  };

  logger.success(`Done! Files were converted successfully.`);
  logger.info(`Pictos, Moves and Audio will be processed...`);

  if (!skipPictos) {
    const pictosResult = await pictos(mapResult.pictosPath, output);
    if (pictosResult.success > 0) {
      logger.success(`Pictos processed: ${pictosResult.success} successful, ${pictosResult.failed} failed.`);
    } else {
      logger.warn(`No pictos were processed.`);
    };
  } else {
    logger.warn(`Pictos processing was skipped.`);
  };

  if (!skipMoves) {
    const movesResult = await movespace(mapResult.movesPath, output);
    if (movesResult.success > 0) {
      logger.success(`Moves processed: ${movesResult.success} successful, ${movesResult.failed} failed.`);
      if (movesResult.movespace > 0) {
        logger.info(` - Movespace files: ${movesResult.movespace}`);
      };
      if (movesResult.gesture > 0) {
        logger.info(` - Gesture files: ${movesResult.gesture}`);
      };
    } else {
      logger.warn(`No moves were processed.`);
    };
  };

  if (!skipMenuart) {
    const menuArtResult = await menuart(mapResult.menuArtPath, output);
    if (menuArtResult.success > 0) {
      logger.success(`Menuart processed: ${menuArtResult.success} successful, ${menuArtResult.failed} failed.`);
    } else {
      logger.warn(`No menuart were processed.`);
    };
  }
  else {
    logger.warn(`Menuart processing was skipped.`);
  }

  if (!skipAudio) {
    const audioResult = await audio.convert(mapResult.audioPath, output);
    if (audioResult) {
      logger.success(`Main audio processed successfully!`);
    } else {
      logger.warn(`No audio were processed.`);
    };

    if (mapResult.ambFiles.length > 0) {
      logger.info(`Processing ${mapResult.ambFiles.length} amb files...`);
      for (const ambFile of mapResult.ambFiles) {
        const ambResult = await audio.convert(ambFile, output, true);
        if (ambResult) {
          logger.success(`AMB audio processed successfully!`);
        } else {
          logger.warn(`No AMB audio were processed.`);
        };
      };
      logger.success(`All AMB audio processed successfully!`);
    };
  }
  else {
    logger.warn(`Audio processing was skipped.`);
  };
})();
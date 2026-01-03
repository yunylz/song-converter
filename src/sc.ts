import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import inquirer from "inquirer";
import * as cliProgress from "cli-progress"; 

dotenv.config();

import cli, { Workflow, PreviewMode } from "./cli";
import logger from "./lib/logger";
import checkPrerequisites from "./lib/prerequisites"; 

import detectMapType from "./lib/map-detector";
import p4 from "./lib/map-types/p4";
import pictos from "./lib/pictos";
import menuart from "./lib/menuart";
import movespace from "./lib/movespace";
import video from "./lib/video";
import dash from "./lib/dash";
import zip from "./lib/zip";
import strapi from "./lib/strapi";
import { uploadSong, uploadDash, checkDashExists, checkPreviewExists } from "./lib/s3";
import { processFromMap, processFromDash, processFromVideo } from "./lib/preview";

(async () => {
  try {
    const options = await cli();
    const { input, workflow, mapName, previewMode } = options;

    logger.info(`Starting Workflow: ${workflow}`);

    // --- WORKFLOW: CHECK MISSING DASH ---
    if (workflow === Workflow.CHECK_MISSING_DASH) {
        logger.info("Fetching song list from Strapi...");
        const songs = await strapi.getAllSongs();
        if (songs.length === 0) process.exit(0);

        logger.info(`Checking ${songs.length} songs for DASH streams...`);
        const missing: string[] = [];
        const bar = new cliProgress.SingleBar({ format: 'Checking |{bar}| {percentage}% | {value}/{total}', hideCursor: true });
        bar.start(songs.length, 0);

        for (const song of songs) {
            const exists = await checkDashExists(song.mapName);
            if (!exists) missing.push(song.mapName);
            bar.increment();
        }
        bar.stop();
        console.log("");
        if (missing.length > 0) {
            logger.warn(`Found ${missing.length} songs missing DASH streams:`);
            missing.forEach(n => console.log(` - ${n}`));
        } else {
            logger.success("All songs have DASH streams available!");
        }
        process.exit(0);
    }

    // --- WORKFLOW: CHECK MISSING PREVIEWS ---
    if (workflow === Workflow.CHECK_MISSING_PREVIEW) {
        logger.info("Fetching song list from Strapi...");
        const songs = await strapi.getAllSongs();
        if (songs.length === 0) process.exit(0);

        logger.info(`Checking ${songs.length} songs for Video Previews...`);
        const missing: string[] = [];
        const bar = new cliProgress.SingleBar({ format: 'Checking |{bar}| {percentage}% | {value}/{total}', hideCursor: true });
        bar.start(songs.length, 0);

        for (const song of songs) {
            const exists = await checkPreviewExists(song.mapName);
            if (!exists) missing.push(song.mapName);
            bar.increment();
        }
        bar.stop();
        console.log("");
        if (missing.length > 0) {
            logger.warn(`Found ${missing.length} songs missing Video Previews:`);
            missing.forEach(n => console.log(` - ${n}`));
        } else {
            logger.success("All songs have Video Previews available!");
        }
        process.exit(0);
    }

    // --- WORKFLOW: CREATE PREVIEW ---
    if (workflow === Workflow.CREATE_PREVIEW) {
        const PREVIEW_WORK_DIR = "./tmp_preview";
        if (fs.existsSync(PREVIEW_WORK_DIR)) fs.removeSync(PREVIEW_WORK_DIR);
        fs.ensureDirSync(PREVIEW_WORK_DIR);

        if (previewMode === PreviewMode.FROM_MAP) {
            await processFromMap(input, PREVIEW_WORK_DIR);
        } 
        else if (previewMode === PreviewMode.FROM_DASH) {
            if (!mapName) throw new Error("Map Name required");
            await processFromDash(mapName, PREVIEW_WORK_DIR);
        } 
        else if (previewMode === PreviewMode.FROM_VIDEO) {
            await processFromVideo(PREVIEW_WORK_DIR);
        }

        logger.info("Cleaning up preview workspace...");
        fs.removeSync(PREVIEW_WORK_DIR);
        logger.success("Preview creation and upload finished.");
        process.exit(0);
    }

    // --- SHARED SETUP FOR MAIN WORKFLOWS ---
    const WORK_DIR = (workflow === Workflow.PROCESS_MAP) 
        ? "./tmp_map_process" 
        : "./tmp_video_process";

    let resumeMode = false;

    // Only allow resume for VIDEO workflows. 
    if (workflow !== Workflow.PROCESS_MAP && fs.existsSync(WORK_DIR) && fs.readdirSync(WORK_DIR).length > 0) {
      const { resume } = await inquirer.prompt([{
          type: "confirm", 
          name: "resume", 
          message: "⚠️  Found previous unfinished files. Resume from upload?", 
          default: true,
      }]);
      resumeMode = resume;
    }

    if (!resumeMode) {
      if (fs.existsSync(WORK_DIR)) fs.removeSync(WORK_DIR);
      fs.ensureDirSync(WORK_DIR);
    } else {
        logger.info("Resuming previous session...");
    }

    const version = Date.now();


    // --- WORKFLOW: FULL PROCESS (MAP ONLY - NO VIDEO) ---
    if (workflow === Workflow.PROCESS_MAP) {
      let mapResult = await p4(input, WORK_DIR, version, true);
      mapResult = await p4(input, WORK_DIR, version, false);

      logger.info("Processing map components...");
      await pictos(mapResult.pictosPath, WORK_DIR);
      await movespace(mapResult.movesPath, WORK_DIR);
      await menuart(mapResult.menuArtPath, WORK_DIR);

      if (!mapResult.song) throw new Error("Song data missing.");

      const zipPath = path.resolve(WORK_DIR, `bundle.zip`);
      logger.info("Zipping bundle...");
      await zip(WORK_DIR, zipPath);
      
      logger.info("Uploading to CDN...");
      await uploadSong(mapResult.song, WORK_DIR);

      await strapi.syncSong(mapResult.song, version);

      logger.info("Cleaning up temporary workspace...");
      fs.removeSync(WORK_DIR);
    } 


    // --- WORKFLOW: CONVERT VIDEO (AMB MIXING -> DASH) ---
    else if (workflow === Workflow.CONVERT_VIDEO) {
      const mapResult = await p4(input, WORK_DIR, version, true);
      const dashOutputDir = path.join(WORK_DIR, "dash_out");
      const mixedVideoPath = path.join(WORK_DIR, `${mapResult.mapName}_Mixed.webm`);

      if (!resumeMode) {
        if (mapResult.videoPath) {
          logger.info(`Mixing AMBs and Syncing Video for ${mapResult.mapName}...`);
          const videoSuccess = await video.process({
            ambFiles: mapResult.ambFiles,
            audioPath: mapResult.audioPath,
            videoPath: mapResult.videoPath,
            musicTrack: mapResult.musicTrack,
            mainSequence: mapResult.mainSequence,
            output: mixedVideoPath
          });
          if (!videoSuccess) throw new Error("Video mixing failed.");

          const dashSuccess = await dash.processDash(mapResult.mapName, mixedVideoPath, dashOutputDir, true);
          if (!dashSuccess) throw new Error("DASH conversion failed.");

        } else {
          throw new Error("No video file detected in input folder.");
        }
      }

      if (fs.existsSync(dashOutputDir) && fs.readdirSync(dashOutputDir).length > 0) {
        logger.info("Uploading DASH stream to Private S3...");
        await uploadDash(mapResult.mapName, dashOutputDir);
        logger.info("Cleaning up temporary workspace...");
        fs.removeSync(WORK_DIR);
      } else {
        logger.error("DASH output not found. Cannot resume upload.");
        process.exit(1);
      }
    }


    // --- WORKFLOW: CONVERT VIDEO DIRECT (RAW FILE -> DASH) ---
    else if (workflow === Workflow.CONVERT_VIDEO_DIRECT) {
        if (!mapName) throw new Error("Map Name is missing.");
        const dashOutputDir = path.join(WORK_DIR, "dash_out");

        if (!resumeMode) {
            logger.info(`Starting Direct DASH conversion for ${mapName}...`);
            const success = await dash.processDash(mapName, input, dashOutputDir, true);
            if (!success) throw new Error("DASH conversion failed.");
        }

        if (fs.existsSync(dashOutputDir) && fs.readdirSync(dashOutputDir).length > 0) {
            logger.info("Uploading DASH stream to Private S3...");
            await uploadDash(mapName, dashOutputDir);
            logger.info("Cleaning up temporary workspace...");
            fs.removeSync(WORK_DIR);
        } else {
            logger.error("DASH output not found. Cannot resume upload.");
            process.exit(1);
        }
    }

    logger.success("All tasks finished successfully.");

  } catch (error: any) {
    logger.error(`Fatal Error: ${error.message}`);
    process.exit(1);
  }
})();
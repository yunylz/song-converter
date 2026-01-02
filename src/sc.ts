import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import inquirer from "inquirer"; // Added for the resume prompt
dotenv.config();

import cli, { Workflow } from "./cli";
import logger from "./lib/logger";
import detectMapType from "./lib/map-detector";
import p4 from "./lib/map-types/p4";
import pictos from "./lib/pictos";
import menuart from "./lib/menuart";
import movespace from "./lib/movespace";
import video from "./lib/video";
import dash from "./lib/dash";
import zip from "./lib/zip";
import strapi from "./lib/strapi";
import { uploadSong, uploadDash } from "./lib/s3";
import { checkPrerequisites } from "./lib/prerequisites";

(async () => {
  try {
    checkPrerequisites();

    const options = await cli();
    const { input, workflow } = options;
    
    // Define workspace based on workflow
    const WORK_DIR = workflow === Workflow.PROCESS_MAP ? "./tmp_map_process" : "./tmp_video_process";

    logger.info(`Starting Workflow: ${workflow}`);

    const mapType = await detectMapType(input);
    const version = Date.now();

    // --- RESUME LOGIC ---
    let resumeMode = false;
    if (fs.existsSync(WORK_DIR) && fs.readdirSync(WORK_DIR).length > 0) {
      const { resume } = await inquirer.prompt([
        {
          type: "confirm",
          name: "resume",
          message: "⚠️  Found previous unfinished files. Skip processing and resume upload?",
          default: true,
        },
      ]);
      resumeMode = resume;
    }

    if (!resumeMode) {
      // Clean slate if not resuming
      if (fs.existsSync(WORK_DIR)) fs.removeSync(WORK_DIR);
      fs.ensureDirSync(WORK_DIR);
    } else {
      logger.info("Resuming previous session...");
    }

    // 1. Get Metadata (Always needed for S3/Strapi paths)
    // We use skipExport=true so we don't overwrite existing JSONs in tmp if resuming
    const mapResult = await p4(input, WORK_DIR, version, true);


    // --- WORKFLOW 1: FULL PROCESS (NO VIDEO) ---
    if (workflow === Workflow.PROCESS_MAP) {
      
      // Only generate files if NOT resuming
      if (!resumeMode) {
        // Re-run p4 to actually write the JSON files to WORK_DIR
        await p4(input, WORK_DIR, version, false);

        logger.info("Processing map components...");
        await pictos(mapResult.pictosPath, WORK_DIR);
        await movespace(mapResult.movesPath, WORK_DIR);
        await menuart(mapResult.menuArtPath, WORK_DIR);
      }

      // --- Upload Stage (Runs for both New and Resume) ---
      
      const zipPath = path.resolve(WORK_DIR, `bundle.zip`);
      
      // If resuming, check if zip exists. If missing, create it.
      if (!fs.existsSync(zipPath)) {
        logger.info("Zipping bundle...");
        await zip(WORK_DIR, zipPath);
      } else {
        logger.info("Using existing bundle.zip");
      }
      
      logger.info("Uploading to CDN...");
      await uploadSong(mapResult.song, WORK_DIR);

      await strapi.syncSong(mapResult.song, version);

      logger.info("Cleaning up temporary workspace...");
      fs.removeSync(WORK_DIR);
    } 

    // --- WORKFLOW 2: CONVERT VIDEO -> DASH -> S3 PRIVATE ---
    else if (workflow === Workflow.CONVERT_VIDEO) {
      
      const dashOutputDir = path.join(WORK_DIR, "dash_out");
      const mixedVideoPath = path.join(WORK_DIR, `${mapResult.mapName}_Mixed.webm`);

      if (!resumeMode) {
        if (mapResult.videoPath) {
          // 1. Mix Video
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

          // 2. Convert DASH
          const dashSuccess = await dash.processDash(mapResult.mapName, mixedVideoPath, dashOutputDir);
          if (!dashSuccess) throw new Error("DASH conversion failed.");

        } else {
          throw new Error("No video file detected.");
        }
      }

      // --- Upload Stage ---
      // Verify DASH files exist before trying to upload
      if (fs.existsSync(dashOutputDir) && fs.readdirSync(dashOutputDir).length > 0) {
        logger.info("Uploading DASH stream to Private S3...");
        await uploadDash(mapResult.mapName, dashOutputDir);

        logger.info("Cleaning up temporary video workspace...");
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
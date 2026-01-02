import fs from "fs";
import path from "path";
import logger from "./logger";

/**
 * Copies movespace/gestures files from input to JDBest moves folder.
 * If moves folder has multiple console folders, it grabs by *.msm files only.
 * Gesture files (*.gesture) are skipped.
 * @param inputFolder Input of the moves folder
 * @param outputFolder Output of JDBest map folder
 * @returns 
 */
const movespace = (inputFolder: string, outputFolder: string) => {
    outputFolder = path.resolve(outputFolder, "dance/classifiers");
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    const consoles = new Set(["durango", "ps3", "wii", "wiiu", "x360", "orbis"]);
    if (!fs.existsSync(inputFolder)) {
        logger.warn("Movespace folder does not exist.");
        return { success: 0, failed: 0, movespace: 0 };
    }
    const entries = fs.readdirSync(inputFolder, { withFileTypes: true });

    if (entries.length === 0) {
        logger.warn(`No moves found in "${inputFolder}"`);
        return {
            success: 0,
            failed: 0,
            movespace: 0
        };
    }

    let success = 0;
    let failed = 0;
    let movespace = 0;

    const handleFile = (src: string, dest: string) => {
        try {
            fs.copyFileSync(src, dest);
            success++;

            if (src.toLowerCase().endsWith(".msm")) {
                movespace++;
            }
        } catch (err) {
            failed++;
            logger.error(`Failed to copy "${src}" → "${dest}": ${err}`);
        }
    };

    for (const entry of entries) {
        const fullPath = path.resolve(inputFolder, entry.name);

        if (entry.isDirectory()) {
            const folderName = entry.name.toLowerCase();

            if (consoles.has(folderName)) {
                // Handle console sub-folder (case-insensitive)
                const consoleEntries = fs.readdirSync(fullPath, { withFileTypes: true });
                for (const subEntry of consoleEntries) {
                    if (!subEntry.isFile()) continue; // skip subfolders
                    if (subEntry.name.toLowerCase().endsWith(".gesture")) continue; // 🚫 skip gesture files

                    const moveInput = path.resolve(fullPath, subEntry.name);
                    const moveOutput = path.resolve(outputFolder, subEntry.name.toLowerCase());
                    handleFile(moveInput, moveOutput);
                }
                continue; // skip normal handling
            }

            // ⛔ skip non-console folders entirely
            continue;
        }

        if (entry.isFile()) {
            if (entry.name.toLowerCase().endsWith(".gesture")) continue; // 🚫 skip gesture files

            // Handle normal move files in root
            const moveOutput = path.resolve(outputFolder, entry.name.toLowerCase());
            handleFile(fullPath, moveOutput);
        }
    }

    return { success, failed, movespace };
};

export default movespace;

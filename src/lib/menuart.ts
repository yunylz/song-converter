import fs from "fs";
import path from "path";

import logger from "./logger";
import config from "../config";
import image from "./image";

const menuartExtensions = [".png", ".jpg", ".jpeg", ".tga", ".bmp", ".gif"];

/**
 * Converts given MenuArt folder's images to JDBest foramt.
 * @param inputFolder Input Menuart folder
 * @param outputFolder Output path
 * @returns 
 */
const menuArt = async (inputFolder: string, outputFolder: string) => {
    const menuArtOutput = path.resolve(outputFolder, "assets/menuart");
    if (!fs.existsSync(menuArtOutput)) {
        fs.mkdirSync(menuArtOutput, { recursive: true });
    };

    const textures = fs.readdirSync(inputFolder).filter(texture => menuartExtensions.includes(path.extname(texture)));
    let results = {
        success: 0,
        failed: 0
    };

    if (textures.length == 0) {
        logger.warn(`No menuart found in "${inputFolder}"`);
        return results;
    };

    const areAllTga = textures.every(texture => path.parse(texture).ext === ".tga");
    if (areAllTga) {
        logger.info(`All menuart are in TGA format, Imagemagick will be used.`);
    };

    for (const texture of textures) {
        const { ext, name } = path.parse(texture);
        
        let size = [];

        if (name.toLowerCase().includes("coach_")) {
            size = config.COACH_SIZE;
        } else if (name.toLowerCase().includes("cover_albumcoach")) {
            size = config.ALBUMCOACH_SIZE;
        } else if (name.toLowerCase().includes("cover_albumbkg")) {
            size = config.ALBUMBKG_SIZE;
        } else if (name.toLowerCase().includes("cover_generic")) {
            size = config.COVER_GENERIC_SIZE;
        } else if (name.toLowerCase().includes("banner_bkg")) {
            size = config.BANNER_BKG_SIZE;
        } else if (name.toLowerCase().includes("map_bkg")) {
            size = config.MAP_BKG_SIZE;
        }
        else continue; // Skip unsupported menuart

        const textureInput = path.resolve(inputFolder, texture);
        const textureOutput = path.resolve(menuArtOutput, `${name.toLowerCase()}.png`);

        if (fs.existsSync(textureOutput)) {
            logger.warn(`Menuart file already exists, it will be overwritten!`);
        };

        const imageResults = await image(
            textureInput,
            textureOutput,
            ["-resize", `${size[0]}x${size[1]}!`]
        );
        results.success += imageResults.success;
        results.failed += imageResults.failed;
    };

    return results;
};

export default menuArt;
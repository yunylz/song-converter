import fs from "fs";
import path from "path";

import logger from "./logger";
import config from "../config";
import image from "./image";

const pictosExtensions = [".png", ".jpg", ".jpeg", ".tga", ".bmp", ".gif"];

/**
 * Converts given pictos folder's images to JDBest foramt.
 * @param inputFolder Input of the moves folder
 * @param outputFolder Output of JDBest map folder
 * @returns 
 */
const pictos = async (inputFolder: string, outputFolder: string) => {
    const pictosOutput = path.resolve(outputFolder, "timeline/pictos");
    if (!fs.existsSync(pictosOutput)) {
        fs.mkdirSync(pictosOutput, { recursive: true });
    };

    const pictos = fs.readdirSync(inputFolder).filter(picto => pictosExtensions.includes(path.extname(picto)));
    let results = {
        success: 0,
        failed: 0
    };

    if (pictos.length == 0) {
        logger.warn(`No pictos found in "${inputFolder}"`);
        return results;
    };

    const areAllTga = pictos.every(picto => path.parse(picto).ext === ".tga");
    if (areAllTga) {
        logger.info(`All pictos are in TGA format, Imagemagick will be used.`);
    };

    for (const picto of pictos) {
        const { ext, name } = path.parse(picto);

        const pictoInput = path.resolve(inputFolder, picto);
        const pictoOutput = path.resolve(pictosOutput, `${name.toLowerCase()}.png`);
        const imageResults =await image(
            pictoInput, 
            pictoOutput, 
            ["-resize", `${config.PICTOS_SIZE[0]}x${config.PICTOS_SIZE[1]}!`]
        );
        results.success += imageResults.success;
        results.failed += imageResults.failed;
    };

    return results;
};

export default pictos;
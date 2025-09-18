import fs from "fs";
import path from "path";
import sharp from "sharp";
import imagemagick from "imagemagick";

/**
 * Converts an image to PNG format using either Sharp or ImageMagick.
 * @param input Input image file
 * @param output Output path
 * @param options ImageMagick options
 * @returns 
 */
const image = async (input: string, output: string, options : any = []) => {
    // Convert images to png
    const { ext, name } = path.parse(input);
    const results = {
        success: 0,
        failed: 0
    };

    // TGA files arent supported by sharp.
    if (ext === ".tga") {
        await new Promise((resolve, reject) => {
            imagemagick.convert([input, ...options, output], (err) => {
                if (err) {
                    reject(err);
                    results.failed++;
                } else {
                    resolve(true);
                    results.success++;
                }
            });
        });
    }
    // Other formats are supported by sharp
    else {
        await new Promise((resolve, reject) => {
            sharp(input)
                .png()
                .toFile(output, (err) => {
                    if (err) {
                        reject(err);
                        results.failed++;
                    } else {
                        resolve(true);
                        results.success++;
                    }
                });
        });
    };

    return results;
};

export default image;
// src/lib/pictos.ts
import fs from "fs";
import path from "path";
import sharp from "sharp";
import imagemagick from "imagemagick";
import { promisify } from "util";
import logger from "./logger";
import config from "../config";

const pictosExtensions = [".png", ".jpg", ".jpeg", ".tga", ".bmp", ".gif"];
const convert = promisify(imagemagick.convert);

// Helper to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

/**
 * Process image using ImageMagick (for TGA files)
 */
async function processWithImageMagick(inputPath: string, outputPath: string): Promise<Buffer> {
  const tempPath = outputPath + '.temp.png';
  
  await convert([
    inputPath,
    '-resize', `${config.PICTOS_SIZE[0]}x${config.PICTOS_SIZE[1]}!`,
    tempPath
  ]);
  
  const buffer = fs.readFileSync(tempPath);
  fs.unlinkSync(tempPath); // Clean up temp file
  
  return buffer;
}

/**
 * Process image using Sharp (for PNG, JPG, JPEG, BMP, GIF)
 */
async function processWithSharp(inputPath: string): Promise<Buffer> {
  return await sharp(inputPath)
    .resize(config.PICTOS_SIZE[0], config.PICTOS_SIZE[1])
    .png()
    .toBuffer();
}

/**
 * Converts given pictos folder to a randomized PNG atlas + JSON.
 */
const pictos = async (inputFolder: string, outputFolder: string) => {
  const assetsOutput = path.resolve(outputFolder, "assets");
  const pictosOutput = path.resolve(outputFolder, "dance/pictos");

  if (!fs.existsSync(assetsOutput)) fs.mkdirSync(assetsOutput, { recursive: true });
  if (!fs.existsSync(pictosOutput)) fs.mkdirSync(pictosOutput, { recursive: true });

  let files = fs.readdirSync(inputFolder)
    .filter(f => pictosExtensions.includes(path.extname(f).toLowerCase()));

  if (!files.length) {
    logger.warn(`No pictos found in "${inputFolder}"`);
    return { success: 0, failed: 0 };
  }

  // Shuffle files to randomize order
  files = shuffleArray(files);

  // Resize all pictos and convert to PNG
  const resizedImages: { buffer: Buffer, name: string }[] = [];
  let failed = 0;

  for (const file of files) {
    const inputPath = path.join(inputFolder, file);
    const name = path.parse(file).name.toLowerCase();
    const outputPath = path.join(pictosOutput, `${name}.png`);
    const extension = path.extname(file).toLowerCase();

    try {
      let buffer: Buffer;

      if (extension === '.tga') {
        // Use ImageMagick for TGA files
        buffer = await processWithImageMagick(inputPath, outputPath);
      } else {
        // Use Sharp for other formats
        buffer = await processWithSharp(inputPath);
      }

      fs.writeFileSync(outputPath, buffer);
      resizedImages.push({ buffer, name });
      
    } catch (err) {
      logger.error(`Failed to process ${file}:`, err);
      failed++;
    }
  }

  if (!resizedImages.length) {
    logger.warn("No pictos were successfully resized.");
    return { success: 0, failed: files.length };
  }

  logger.info("Generating randomized pictos atlas...");

  // Create atlas
  const columns = Math.ceil(Math.sqrt(resizedImages.length)); // square-ish layout
  const rows = Math.ceil(resizedImages.length / columns);
  const width = config.PICTOS_SIZE[0] * columns;
  const height = config.PICTOS_SIZE[1] * rows;

  const composite: sharp.OverlayOptions[] = [];
  const coordinates: Record<string, any> = {};

  resizedImages.forEach((img, i) => {
    const x = (i % columns) * config.PICTOS_SIZE[0];
    const y = Math.floor(i / columns) * config.PICTOS_SIZE[1];

    composite.push({ input: img.buffer, left: x, top: y });
    coordinates[`${img.name}.png`] = { x, y, width: config.PICTOS_SIZE[0], height: config.PICTOS_SIZE[1] };
  });

  const atlasBuffer = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(composite)
    .png()
    .toBuffer();

  const atlasPath = path.join(assetsOutput, "pictos-atlas.png");
  fs.writeFileSync(atlasPath, atlasBuffer);

  const jsonPath = path.join(assetsOutput, "pictos-atlas.json");
  fs.writeFileSync(jsonPath, JSON.stringify(coordinates, null, 2));

  logger.info(`Atlas generated: ${atlasPath}`);
  logger.info(`JSON generated: ${jsonPath}`);

  // Cleanup individual pictos
  fs.rmSync(pictosOutput, { recursive: true, force: true });

  return { success: resizedImages.length, failed };
};

export default pictos;
import { execSync } from "child_process";

/**
 * Checks if ImageMagick is installed.
 * @returns True if ImageMagick is installed and accessible via PATH, false otherwise.
 */
export const imageMagickExists = () => {
    try {
        execSync("convert -version", { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Checks if FFmpeg is installed.
 * @returns True if FFmpeg is installed and accessible via PATH, false otherwise.
 */
export const ffmpegExists = () => {
    try {
        execSync("ffmpeg -version", { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Checks if all prerequisites are installed.
 */
export const checkPrerequisites = () => {
    if (!imageMagickExists()) {
        throw new Error("ImageMagick is not installed or not found in PATH. Please install it from https://imagemagick.org/script/download.php");
    }
    if (!ffmpegExists()) {
        throw new Error("FFmpeg is not installed or not found in PATH. Please install it from https://ffmpeg.org/download.html");
    }
}
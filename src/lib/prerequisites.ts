import { execSync } from "child_process";

export const imageMagickExists = () => {
    try {
        execSync("convert -version", { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
};

export const ffmpegExists = () => {
    try {
        execSync("ffmpeg -version", { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
};

export const checkPrerequisites = () => {
    if (!imageMagickExists()) {
        throw new Error("ImageMagick is not installed or not found in PATH. Please install it from https://imagemagick.org/script/download.php");
    }
    if (!ffmpegExists()) {
        throw new Error("FFmpeg is not installed or not found in PATH. Please install it from https://ffmpeg.org/download.html");
    }
}
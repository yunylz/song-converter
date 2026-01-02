import fs from "fs";
import path from "path";
import archiver from "archiver";
import os from "os";

import logger from "./logger";

/**
 * Zip a file or directory with maximum compression.
 * Writes to a tmp file first, then moves to final output.
 */
const zipFolder = async (input: string, output: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // tmp file path (outside input dir, avoids self-zip issue)
    const tmpZip = path.join(
      os.tmpdir(),
      `bundle-${Date.now()}.zip`
    );

    const outputStream = fs.createWriteStream(tmpZip);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 🔥 max compression
    });

    outputStream.on("close", () => {
      try {
        // ensure target dir exists
        const targetDir = path.dirname(output);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // move tmp -> final
        fs.renameSync(tmpZip, output);
        logger.info(`Created zip at ${output} (${archive.pointer()} bytes)`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    archive.on("error", (err) => {
      // cleanup tmp if fail
      if (fs.existsSync(tmpZip)) {
        fs.unlinkSync(tmpZip);
      }
      reject(err);
    });

    archive.pipe(outputStream);

    const stats = fs.statSync(input);
    if (stats.isDirectory()) {
      archive.directory(input, false); // only contents, not parent folder
    } else {
      archive.file(input, { name: path.basename(input) });
    }

    void archive.finalize();
  });
};

export default zipFolder;

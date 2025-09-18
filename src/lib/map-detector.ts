import path from "path";
import { glob } from "glob";
import logger from "./logger";
import { MapType } from "../types/godot";

/**
 * Detects the map type based on the files present in the input folder.
 * Proceeds if at least one signature file is found.
 * Priority order: P4 > UAF > NOW
 * @param input - Path to the input map folder.
 * @returns {Promise<MapType|null>} The detected {@link MapType} or `null` if not found.
 */
const mapDetector = async (input: string): Promise<MapType | null> => {
  const files: Record<MapType, string[]> = {
    [MapType.P4]: [
      "SongDesc.tpl",
      "timeline/timeline.tpl",
      "Timeline/*.dtape",
      "Timeline/*.ktape",
      "Audio/*.trk"
    ],
    [MapType.UAF]: [
      "songdesc.tpl.ckd",
      "timeline/*.dtape.ckd",
      "timeline/*.ktape.ckd",
      "audio/*_musictrack.tpl.ckd",
    ],
    [MapType.NOW]: [
      "metadata.json",
      "songMetadata.zip",
      "assets/web/pictos-atlas.json",
      "assets/web/pictos-atlas.png",
      "assets/web/pictos-sprite.png",
      "assets/web/pictos-sprite.css"
    ]
  };

  const detected: MapType[] = [];

  for (const [mapType, filePatterns] of Object.entries(files) as [MapType, string[]][]) {
    for (const pattern of filePatterns) {
      const fullPattern = path.join(input, pattern);
      const matches = await glob(fullPattern);

      if (matches.length > 0) {
        detected.push(mapType);
        break; // one match is enough to count the type
      }
    }
  }

  if (detected.length === 0) {
    logger.error("Could not detect map type (no matching files)");
    return null;
  }

  // Pick highest priority
  const priority: MapType[] = [MapType.P4, MapType.UAF, MapType.NOW];
  const chosen = priority.find(type => detected.includes(type)) ?? null;

  if (chosen) {
    logger.success(`Detected "${chosen}" map type!`);
    return chosen;
  }

  logger.error("Ambiguous or unsupported map type.");
  return null;
};

export default mapDetector;

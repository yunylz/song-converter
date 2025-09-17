import path from "path";
import { glob } from "glob";
import logger from "./logger";
import { MapType } from "../types/godot";

export default async (input: string): Promise<MapType | null> => {
  const files: Record<MapType, string[]> = {
    [MapType.P4]: [
      "SongDesc.tpl",
      "timeline/timeline.tpl",
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

  let bestMatch: { type: MapType | null; percentage: number } = { type: null, percentage: 0 };

  for (const [mapType, filePatterns] of Object.entries(files) as [MapType, string[]][]) {
    let foundCount = 0;

    for (const pattern of filePatterns) {
      const fullPattern = path.join(input, pattern);
      const matches = await glob(fullPattern);

      if (matches.length > 0) {
        foundCount++;
      }
    }

    const percentage = Math.round((foundCount / filePatterns.length) * 100);

    if (percentage > bestMatch.percentage) {
      bestMatch = { type: mapType, percentage };
    }
  }

  if (bestMatch.percentage === 100) {
    logger.success(`Detected "${bestMatch.type}" map type! (${bestMatch.percentage}%)`);
    return bestMatch.type;
  } else if (bestMatch.percentage > 0) {
    logger.info(`Best guess: "${bestMatch.type}" map type (${bestMatch.percentage}%), can't process multiple formatted maps.`);
    return null;
  } else {
    logger.error("Could not detect map type (0%)");
    return null;
  }
};
import fs from 'fs';
import path from 'path';

import { Song, MusicTrack, Dance, Karaoke, Cinematics } from '../types/godot';

import logger from './logger';

export default (
    output: string, mapName: string, 
    song: Song, musicTrack: MusicTrack,
    dance: Dance, karaoke: Karaoke,
    cinematics: Cinematics
) => {
    if (!fs.existsSync(output)) {
        logger.warn(`Output folder does not exist, creating it...`);
        fs.mkdirSync(output, { recursive: true });
    }

    const resolvePath = (filePath: string) => {
        const resolvedPath = path.resolve(output, filePath.toLowerCase());
        const dirName = path.dirname(resolvedPath);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        };
        return resolvedPath;
    }

    fs.writeFileSync(
        resolvePath("songdesc.json"),
        JSON.stringify(song, null, 4)
    )
    logger.success(`Exported song descriptor!`);

    fs.writeFileSync(
        resolvePath(`audio/${mapName}_musictrack.json`),
        JSON.stringify(musicTrack, null, 4)
    )
    logger.success(`Exported music track!`);

    fs.writeFileSync(
        resolvePath(`timeline/${mapName}_dance.json`),
        JSON.stringify(dance, null, 4)
    )
    logger.success(`Exported dance file!`);

    fs.writeFileSync(
        resolvePath(`timeline/${mapName}_karaoke.json`),
        JSON.stringify(karaoke, null, 4)
    )
    logger.success(`Exported karaoke file!`);

    fs.writeFileSync(
        resolvePath(`cinematics/${mapName}_mainsequence.json`),
        JSON.stringify(cinematics, null, 4)
    )
    logger.success(`Exported cinematics file!`);
};
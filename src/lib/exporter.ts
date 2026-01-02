import fs from 'fs';
import path from 'path';

import { Song, MusicTrack, Dance, Karaoke, Cinematics } from '../types/godot';

import logger from './logger';
import config from '../config';
import { randomUUID } from 'crypto';

/**
 * Exports all necessary files to the map output folder.
 * @param output Output folder
 * @param mapName map name
 * @param song Song descriptor
 * @param musicTrack Music track
 * @param dance Dance
 * @param karaoke Karaoke
 * @param cinematics Cinematics
 */
const exporter = (
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
        const resolvedPath = path.resolve(output, filePath);
        const dirName = path.dirname(resolvedPath);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        };
        return resolvedPath;
    };

    const saveFile = (filePath: string, data: any, minifyJson = config.MINIFY_JSON) => {
        const resolvedPath = resolvePath(filePath);
        fs.writeFileSync(resolvedPath, minifyJson ? JSON.stringify(data) : JSON.stringify(data, null, 2));
        logger.success(`Exported file: ${resolvedPath}`);
    };

    const folders = [
        "assets",
        "dance",
        "dance/classifiers"
    ]

    for (const folder of folders) {
        const folderPath = path.resolve(output, folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        };
    };

    const songData = {
        ...song,
        musicTrack: musicTrack,
        karaoke: karaoke,
        cinematics: cinematics
    }

    saveFile("songData.json", songData);

    saveFile(`dance/${mapName}_dance.json`, dance);

    // fs.writeFileSync(
    //     resolvePath(`audio/${mapName}_musictrack.json`),
    //     JSON.stringify(musicTrack, null, 4)
    // )
    // logger.success(`Exported music track!`);

    // fs.writeFileSync(
    //     resolvePath(`timeline/${mapName}_dance.json`),
    //     JSON.stringify(dance, null, 4)
    // )
    // logger.success(`Exported dance file!`);

    // fs.writeFileSync(
    //     resolvePath(`timeline/${mapName}_karaoke.json`),
    //     JSON.stringify(karaoke, null, 4)
    // )
    // logger.success(`Exported karaoke file!`);

    // fs.writeFileSync(
    //     resolvePath(`cinematics/${mapName}_mainsequence.json`),
    //     JSON.stringify(cinematics, null, 4)
    // )
    // logger.success(`Exported cinematics file!`);
};

export default exporter;
import dash from "../lib/dash";
import path from "path";
import fs from "fs";
import { Cinematics, MusicTrack } from "../types/godot";
import UnitConverter from "../lib/unit-converter";
import { getSampleRate } from "../lib/ffmpeg";

(async () => {
    const mapName = "MakeTheParty";
    const mapNameLower = mapName.toLowerCase();
    const video = "/Users/batin/Documents/_Projects/JDBEST/tools/song-converter/input/MakeTheParty.hd.webm";
    const audio = "/Users/batin/Documents/_Projects/JDBEST/tools/song-converter/input/MakeTheParty/Audio/MakeTheParty.wav";
    const outputFile = path.resolve("./src/tests/dash/master.mpd");

    await dash.processDash(
        mapName,
        video,
        audio,
        outputFile
    )
})()
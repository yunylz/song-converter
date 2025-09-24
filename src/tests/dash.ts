import dash from "../lib/dash";
import path from "path";
import fs from "fs";
import { Cinematics, MusicTrack } from "../types/godot";
import UnitConverter from "../lib/unit-converter";
import { getSampleRate } from "../lib/ffmpeg";

(async () => {
    const mapName = "FantasticBaby";
    const mapNameLower = mapName.toLowerCase();
    const video = "./input/FantasticBaby/VideosCoach/fantasticbaby.webm";
    const audio = "./input/FantasticBaby/Audio/FantasticBaby.wav";
    const outputFile = path.resolve("./src/tests/dash/master.mpd");

    const cinematicsPath = `./output/${mapNameLower}/cinematics/${mapNameLower}_mainsequence.json`;
    const cinematics : Cinematics = JSON.parse(fs.readFileSync(cinematicsPath, "utf-8"));

    const musicTrackPath = `./output/${mapNameLower}/audio/${mapNameLower}_musictrack.json`;
    const musicTrack : MusicTrack = JSON.parse(fs.readFileSync(musicTrackPath, "utf-8"));

    const sampleRate = getSampleRate(audio);
    const unitConverter = new UnitConverter(musicTrack.markers, sampleRate, 24);

    const ambFiles = cinematics.clips.sort((a, b) => a.startTime - b.startTime).map(c => ({
        time: unitConverter.timeFromTicks(c.startTime),
        duration: unitConverter.timeFromTicks(c.duration),
        path: c.soundSetPath
    }));

    return

    await dash.processDash(
        "AllIWant",
        video,
        audio,
        outputFile
    )
})()
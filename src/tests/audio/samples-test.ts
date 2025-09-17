import fs from "fs";
import path from "path";
import { Track } from "../../types/lua/trk";
import { Timeline } from "../../types/lua/tml";
import UnitConverter from "../../lib/unit-converter";
import lua from "../../lib/lua";
import { getSampleRate, extractBeatMarkers } from "../../lib/ffmpeg";

const audioPath = path.resolve("./input/DanceDeBakoon/Audio/DanceDeBakoon.wav");
const trkPath = path.resolve("./input/DanceDeBakoon/Audio/DanceDeBakoon.trk");
const tmlPath = path.resolve("./input/DanceDeBakoon/Timeline/timeline.tpl");

const sampleRate = getSampleRate(audioPath); // 48000
const trk = lua(trkPath);
const trkMarkers = trk?.structure.MusicTrackStructure.markers.map((m: { VAL: any; }) => m.VAL); // Samples, no * 48
const tml = lua(tmlPath);
const examplePicto = tml?.params.Actor_Template.COMPONENTS[0].JD_Timeline_Template.pictos[4].PictoClip;

console.log("Sample Rate:", sampleRate);
console.log("TRK Markers:", trkMarkers); // First 10
console.log("Example Picto:", examplePicto);

const unitConverter = new UnitConverter(trkMarkers ?? [0], sampleRate, 24); // 24 ticks/beat

const pictoStartTicks = examplePicto?.position !== undefined
  ? unitConverter.ticksFromBeat(examplePicto.position)
  : 0;

console.log("Picto Start (Ticks):", pictoStartTicks);

// Construct dtape
const dtape = {
  __class: "Tape",
  Id: "DanceTapeFile.dtape",
  MapName: "DanceDeBakoon",
  TapeClock: "TapeClock_ConductorGameplay",
  Tracks: [
    {
      __class: "PictoTrack",
      Id: examplePicto?.layerID ?? 1,
      Name: "Pictos",
    },
    // Add MoveTrack, GoldEffectTrack as needed
  ],
  Clips: [
    {
      __class: "PictogramClip",
      Id: 1,
      TrackId: examplePicto?.layerID ?? 1,
      IsActive: 1,
      StartTime: pictoStartTicks,
      Duration: 24, // 1 beat = 24 ticks
      PictoPath: examplePicto?.texturePath.replace("world/jd5", "world/maps") ?? "",
      CoachCount: 4294967295,
    },
    // Add MotionClip, GoldEffectClip
  ],
};

console.log("Dtape:", JSON.stringify(dtape, null, 2));
fs.writeFileSync("DanceTapeFile.dtape", JSON.stringify(dtape, null, 2));
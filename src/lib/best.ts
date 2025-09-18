import {
    AudioPreview,
    Cinematics,
    Dance,
    GoldEffectClip,
    Karaoke,
    KaraokeClip,
    MotionClip,
    MusicTrack,
    PictoClip,
    Song,
    SoundSetClip,
} from "../types/godot";
import { Dtape } from "../types/lua/dtape";
import { Ktape } from "../types/lua/ktape";
import { MainSequence } from "../types/lua/mainsequence";
import { Track } from "../types/lua/trk";
import {
    assureJDVersion,
    fixEnginePath,
    fixSoundSetPath,
    parseDifficulty,
    parseGameMode,
    parseGameModeFlags,
    parseGameModeStatus,
    parseNumCoach,
    parseSweatDifficulty,
} from "./utils";
import exporter from "./exporter";
import logger from "./logger";

interface BestArgs {
    mapName: string;
    outputMapFolder: string;
    jdVersion: number;
    songDesc: Song;
    trk: Track;
    audioPreview: AudioPreview;
    dtape?: Dtape;
    ktape?: Ktape;
    mainSequence?: MainSequence;
    isJD5?: boolean;
}

const best = ({
    mapName,
    outputMapFolder,
    jdVersion,
    songDesc,
    trk,
    audioPreview,
    dtape,
    ktape,
    mainSequence,
    isJD5
}: BestArgs) => {
    const { title, artist, difficulty, sweatDifficulty, numCoach, flags, status, mode, backgroundType, lyricsType, localeID, mojoValue } = songDesc;
    /** ---------------- Song ---------------- */
    const song: Song = {
        class: "SongDescriptor",
        mapName,
        originalJDVersion: assureJDVersion(typeof jdVersion === "number" ? jdVersion : parseInt(String(jdVersion)) || 0),
        title: title || "",
        artist: artist || "",
        difficulty: parseDifficulty(typeof difficulty === "string" ? difficulty : ""),
        sweatDifficulty: parseSweatDifficulty(typeof sweatDifficulty === "string" ? sweatDifficulty : ""),
        numCoach: parseNumCoach(typeof numCoach === "string" ? numCoach : ""),
        flags: parseGameModeFlags(typeof flags === "string" ? flags : ""),
        status: parseGameModeStatus(typeof status === "string" ? status : null),
        mode: parseGameMode(typeof mode === "string" ? mode : null),
        backgroundType: backgroundType,
        lyricsType: lyricsType,
        localeID: localeID,
        mojoValue: mojoValue
    };

    /** ---------------- MusicTrack ---------------- */
    const musicTrack: MusicTrack = {
        class: "MusicTrack",
        markers: Array.isArray(trk.structure.MusicTrackStructure?.markers)
            ? trk.structure.MusicTrackStructure.markers.map((m) => m.VAL)
            : [],
        comments: Array.isArray(trk.structure.MusicTrackStructure?.comments)
            ? trk.structure.MusicTrackStructure.comments.map((c) => c.Comment)
            : [],
        sections: Array.isArray(trk.structure.MusicTrackStructure?.sections)
            ? trk.structure.MusicTrackStructure.sections.map((s) => s.MusicSection)
            : [],
        startBeat: trk.structure.MusicTrackStructure.startBeat,
        endBeat: trk.structure.MusicTrackStructure.endBeat,
        audioPreview: {
            entry: audioPreview.entry,
            loopStart: audioPreview.loopStart,
            loopEnd: audioPreview.loopEnd,
        },
        videoStartTime: trk.structure.MusicTrackStructure.videoStartTime,
        volume: trk.structure.MusicTrackStructure.volume ?? 0,
    };

    if (musicTrack.markers.length === 0) {
        logger.error(`No markers were found in the track, cancelling processing.`);
        process.exit(1);
    };

    /** ---------------- Dance ---------------- */
    const dance: Dance = {
        class: "Dance",
        clips: dtape
            ? dtape.params.Tape.Clips.map((clip) => {
                if (clip.MotionClip) {
                    return {
                        class: "MotionClip",
                        id: clip.MotionClip.Id,
                        trackId: clip.MotionClip.TrackId,
                        isActive: clip.MotionClip.IsActive,
                        startTime: clip.MotionClip.StartTime,
                        duration: clip.MotionClip.Duration,
                        classifierPath: fixEnginePath(mapName, clip.MotionClip.ClassifierPath, "move"),
                        goldMove: clip.MotionClip.GoldMove || 0,
                        coachId: clip.MotionClip.CoachId || 0,
                        moveType: clip.MotionClip.MoveType || 0,
                    };
                }
                if (clip.GoldEffectClip) {
                    return {
                        class: "GoldEffectClip",
                        id: clip.GoldEffectClip.Id,
                        trackId: clip.GoldEffectClip.TrackId,
                        isActive: clip.GoldEffectClip.IsActive,
                        startTime: clip.GoldEffectClip.StartTime,
                        duration: clip.GoldEffectClip.Duration,
                        effectType: clip.GoldEffectClip.EffectType,
                    };
                }
                if (clip.PictogramClip) {
                    return {
                        class: "PictogramClip",
                        id: clip.PictogramClip.Id,
                        trackId: clip.PictogramClip.TrackId,
                        isActive: clip.PictogramClip.IsActive,
                        startTime: clip.PictogramClip.StartTime,
                        duration: 24, // 1 beat = 24 ticks
                        pictoPath: fixEnginePath(mapName, clip.PictogramClip.PictoPath, "picto"),
                    };
                }
                return undefined;
            }).filter(Boolean) as (MotionClip | PictoClip | GoldEffectClip)[]
            : [],
        mapName,
    };

    /** ---------------- Karaoke ---------------- */
    const karaoke: Karaoke = {
        class: "Karaoke",
        clips:
            ktape?.params.Tape.Clips
                .map((clip) =>
                    clip.KaraokeClip
                        ? {
                            class: "KaraokeClip",
                            id: clip.KaraokeClip.Id,
                            trackId: clip.KaraokeClip.TrackId,
                            isActive: clip.KaraokeClip.IsActive,
                            startTime: clip.KaraokeClip.StartTime,
                            duration: clip.KaraokeClip.Duration,
                            lyrics: clip.KaraokeClip.Lyrics,
                            isEndOfLine: clip.KaraokeClip.IsEndOfLine,
                            contentType: clip.KaraokeClip.ContentType,
                        }
                        : undefined
                )
                .filter(Boolean) as KaraokeClip[] || [],
        mapName,
    };

    /** ---------------- Cinematics ---------------- */
    const cinematics: Cinematics = {
        class: "Cinematics",
        clips:
            (mainSequence?.params.Tape.Clips ?? [])
                .map((clip) =>
                    clip.SoundSetClip
                        ? {
                            class: "SoundSetClip",
                            id: clip.SoundSetClip.Id,
                            trackId: clip.SoundSetClip.TrackId,
                            startTime: clip.SoundSetClip.StartTime,
                            duration: clip.SoundSetClip.Duration,
                            soundSetPath: fixSoundSetPath(clip.SoundSetClip.SoundSetPath),
                        }
                        : undefined
                )
                .filter(Boolean) as SoundSetClip[] || [],
        mapName
    };

    /** ---------------- Export ---------------- */
    exporter(outputMapFolder, mapName, song, musicTrack, dance, karaoke, cinematics);

    return {
        song,
        musicTrack,
        dance,
        karaoke,
        cinematics
    };
};

export default best;

import { Comment, MusicSection } from "./lua/trk";

export enum MapType {
  P4 = "p4",
  UAF = "uaf",
  NOW = "now"
};

export enum GameModeFlags {
  None = 0,
  Classic,
  Mashup,
  PartyMaster,
  Sweat,
  Battle,
  OnStage,
  MusicMotion,
}

export enum GameModeStatus {
  Unavailable = 0,
  Hidden,
  Locked,
  Available,
  Max
}

export enum GameMode {
  Classic = 0,
  Mashup,
  PartyMaster,
  Sweat,
  Battle,
  OnStage,
  MusicMotion,
}

export enum Difficulty {
  NA = 0,
  Easy,
  Normal,
  Hard,
  Extreme,
  Max
}

export enum SweatDifficulty {
  Low = 1,
  Medium = 2,
  High = 3
}

export enum NumCoach {
  NA = 0,
  Solo,
  Duo,
  Trio,
  Quatuor,
  Quintet,
  Sextet,
  Max
}

export enum LyricsType {
  None             =   -1,
  OldSystem		=	0,
  Classic			=	1,
  OnStage			=	2,
  WorldDanceFloor	=	3
}

export enum BackgroundType {
  OldSystem  =	0,
  Graph	  = 1,
  OnStage	  =	2,
  Sweat	  =	3,
  Extreme	  =	4,	
  CMU	      =	5	
}
export interface Song {
  class: "SongDescriptor";
  originalJDVersion: number;
  mapName: string;
  title: string;
  artist: string;
  difficulty: Difficulty;
  sweatDifficulty: SweatDifficulty;
  numCoach: NumCoach;
  flags: GameModeFlags;
  status: GameModeStatus;
  mode: GameMode;
  backgroundType: BackgroundType;
  lyricsType: LyricsType;
  localeID: number;
  mojoValue: number;
};

export interface AudioPreview {
  entry: number;
  loopStart: number;
  loopEnd: number;
}

export interface MusicTrack {
  class: "MusicTrack";
  markers: number[];
  comments: Comment[];
  sections: MusicSection[];
  startBeat: number;
  endBeat: number;
  audioPreview: AudioPreview,
  videoStartTime: number;
  volume: number;
};

export interface Dance {
  class: "Dance";
  clips: (MotionClip | PictoClip | GoldEffectClip)[];
  mapName: string;
}

export interface MotionClip {
  class: "MotionClip";
  id: number;
  trackId: number;
  isActive: number;
  startTime: number;
  duration: number;
  classifierPath: string;
  goldMove: number;
  coachId: number;
  moveType: number;
}

export interface PictoClip {
  class: "PictogramClip";
  id: number;
  trackId: number;
  isActive: number;
  startTime: number;
  duration: number;
  pictoPath: string;
};

export interface GoldEffectClip {
  class: "GoldEffectClip";
  id: number;
  trackId: number;
  isActive: number;
  startTime: number;
  duration: number;
  effectType: number;
}

export interface Karaoke {
  class: "Karaoke";
  clips: (KaraokeClip)[];
  mapName: string;
}

export interface KaraokeClip {
  class: "KaraokeClip";
  id: number;
  trackId: number;
  isActive: number;
  startTime: number;
  duration: number;
  lyrics: string;
  isEndOfLine: number;
  contentType: number;
}

export interface Cinematics {
  class: "Cinematics";
  clips: SoundSetClip[];
  mapName: string;
}

export interface SoundSetClip {
  class: "SoundSetClip";
  id: number;
  trackId: number;
  startTime: number;
  duration: number;
  soundSetPath: string;
}
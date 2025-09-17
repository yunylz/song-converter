export interface Dtape {
  params: Params
}

export interface Params {
  NAME: string
  Tape: Tape
}

export interface Tape {
  Clips: Clip[]
  Tracks: Track[]
  TapeClock: number
  TapeBarCount: number
  FreeResourcesAfterPlay: number
  MapName: string
  SoundwichEvent: string
}

export interface Clip {
  NAME: string
  MotionClip?: MotionClip
  GoldEffectClip?: GoldEffectClip
  PictogramClip?: PictogramClip
}

export interface MotionClip {
  Id: number
  TrackId: number
  IsActive: number
  StartTime: number
  Duration: number
  ClassifierPath: string
  GoldMove: number
  CoachId: number
  MoveType: number
  Color: string
  MotionPlatformSpecifics: MotionPlatformSpecific[]
}

export interface MotionPlatformSpecific {
  KEY: string
  VAL: Val
}

export interface Val {
  MotionPlatformSpecific: MotionPlatformSpecific2
}

export interface MotionPlatformSpecific2 {
  ScoreScale: number
  ScoreSmoothing: number
  LowThreshold: any
  HighThreshold: number
}

export interface GoldEffectClip {
  Id: number
  TrackId: number
  IsActive: number
  StartTime: number
  Duration: number
  EffectType: GoldEffectType
}

export interface PictogramClip {
  Id: number
  TrackId: number
  IsActive: number
  StartTime: number
  Duration: number
  PictoPath: string
  CoachCount: number
}

export interface Track {
  NAME: string
  MoveTrack?: MoveTrack
  PictoTrack?: PictoTrack
  GoldEffectTrack?: GoldEffectTrack
}

export interface MoveTrack {
  Id: number
  Name: string
  CoachId: number
  MoveType: MoveType
}

export interface PictoTrack {
  Id: number
  Name: string
}

export interface GoldEffectTrack {
  Id: number
  Name: string
}

export enum MoveType {
  MoveType_HandOnly,  // wiimote, psMove
  MoveType_FullBody,  // kinect
};

export enum GoldEffectType {
  GoldEffect_Auto, 		// obsolete
  GoldEffect_Classic = 1,
  GoldEffect_Cascade
};
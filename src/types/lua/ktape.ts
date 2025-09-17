export interface Ktape {
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
  KaraokeClip: KaraokeClip
}

export interface KaraokeClip {
  Id: number
  TrackId: number
  IsActive: number
  StartTime: number
  Duration: number
  Pitch: number
  Lyrics: string
  IsEndOfLine: number
  ContentType: number
  StartTimeTolerance: number
  EndTimeTolerance: number
  SemitoneTolerance: number
}

export interface Track {
  TapeTrack: TapeTrack
}

export interface TapeTrack {
  Id: number
  Name: string
}

export enum KaraokeContentType {
  KaraokeContent_Singing,
  KaraokeContent_Rap,
  KaraokeContent_LyricsOnly,
};

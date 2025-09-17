
export interface MusicMarker {
  VAL: number;
}

export interface MusicSignature {
  beats: number;
  marker: number;
  comment: string;
}

export interface MusicSignatureWrapper {
  MusicSignature: MusicSignature;
}

export enum MusicSectionType {
  INTRO = 0,
  MAIN = 1,
  OUTRO = 2,
  BRIDGE = 3,
  CHORUS = 4,
  VERSE = 5
}

export interface MusicSection {
  sectionType: MusicSectionType | number;
  marker: number;
  comment: string;
}

export interface MusicSectionWrapper {
  MusicSection: MusicSection;
}

export type CommentType = "Video" | "FX" | "Audio" | "Gameplay" | "Sync";

export interface Comment {
  marker: number;
  comment: string;
  commentType: CommentType;
}

export interface CommentWrapper {
  Comment: Comment;
}

export interface MusicTrackStructure {
  markers: MusicMarker[];
  signatures: MusicSignatureWrapper[];
  sections: MusicSectionWrapper[];
  comments: CommentWrapper[];
  startBeat: number;
  endBeat: number;
  videoStartTime: number;
}

export interface Track {
  structure: {
    MusicTrackStructure: MusicTrackStructure;
  };
}

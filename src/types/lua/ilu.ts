// sound-descriptor.d.ts

export type LimiterMode =
  | "LimiterMode.RejectNew"
  | "LimiterMode.StopOldest"
  | "LimiterMode.StopLowestVolume"
  | "LimiterMode.OnlyOnePlaying";

export type PlayMode =
  | "PlayMode.PlayFirst"
  | "PlayMode.Random"
  | "PlayMode.RandomRememberLast"
  | "PlayMode.RandomSequence"
  | "PlayMode.Sequence"
  | "PlayMode.Input_OBSOLETE"
  | "PlayMode.Serie"
  | "PlayMode.Count"
  | "PlayMode.Invalid";

export interface SoundParams {
  numChannels: number;
  loop: number;
  playMode: PlayMode;
  randomVolMin: number;
  randomVolMax: number;
  randomPitchMin: number;
  randomPitchMax: number;
  fadeInTime: number;
  fadeOutTime: number;
}

export interface DescriptorParams {
  SoundParams: SoundParams;
}

export interface SoundFile {
  VAL: string;
}

export interface SoundDescriptorTemplate {
  name: string;
  volume: number;
  category: string;
  limitMode: LimiterMode;
  params: DescriptorParams;
  files: SoundFile[];
}

export interface DescriptorEntry {
  SoundDescriptor_Template: SoundDescriptorTemplate;
}

export interface SoundDescriptorFile {
  DESCRIPTOR: DescriptorEntry[];
}

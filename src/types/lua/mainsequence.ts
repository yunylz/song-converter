export interface MainSequence {
  params: Params
}

export interface Params {
  NAME: string
  Tape: Tape
}

export interface Tape {
  Clips: Clip[]
  Tracks: Track[]
}

export interface Clip {
  NAME: string
  TranslationClip?: TranslationClip
  AlphaClip?: AlphaClip
  ColorClip?: ColorClip
  TapeReferenceClip?: TapeReferenceClip
  SizeClip?: SizeClip
  RotationClip?: RotationClip
  SoundSetClip?: SoundSetClip
}

export interface TranslationClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  ActorPaths: ActorPath[]
  CurveX?: CurveX
  CurveY?: CurveY
  CurveZ?: CurveZ
}

export interface ActorPath {
  VAL: string
}

export interface CurveX {
  BezierCurveFloat: BezierCurveFloat
}

export interface BezierCurveFloat {
  Keys: Key[]
}

export interface Key {
  KeyFloat?: KeyFloat
}

export interface KeyFloat {
  NormalOut: any
  Value: any
  NormalIn: any
}

export interface CurveY {
  BezierCurveFloat: BezierCurveFloat2
}

export interface BezierCurveFloat2 {
  Keys: Key2[]
}

export interface Key2 {
  KeyFloat: KeyFloat2
}

export interface KeyFloat2 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface CurveZ {
  BezierCurveFloat: BezierCurveFloat3
}

export interface BezierCurveFloat3 {
  Keys: Key3[]
}

export interface Key3 {
  KeyFloat?: KeyFloat3
}

export interface KeyFloat3 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface AlphaClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  ActorPaths: ActorPath2[]
  Curve: Curve
}

export interface ActorPath2 {
  VAL: string
}

export interface Curve {
  BezierCurveFloat: BezierCurveFloat4
}

export interface BezierCurveFloat4 {
  Keys: Key4[]
}

export interface Key4 {
  KeyFloat?: KeyFloat4
}

export interface KeyFloat4 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface ColorClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  ActorPaths: ActorPath3[]
  CurveRed: CurveRed
  CurveGreen: CurveGreen
  CurveBlue: CurveBlue
}

export interface ActorPath3 {
  VAL: string
}

export interface CurveRed {
  BezierCurveFloat: BezierCurveFloat5
}

export interface BezierCurveFloat5 {
  Keys: Key5[]
}

export interface Key5 {
  KeyFloat?: KeyFloat5
}

export interface KeyFloat5 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface CurveGreen {
  BezierCurveFloat: BezierCurveFloat6
}

export interface BezierCurveFloat6 {
  Keys: Key6[]
}

export interface Key6 {
  KeyFloat: KeyFloat6
}

export interface KeyFloat6 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface CurveBlue {
  BezierCurveFloat: BezierCurveFloat7
}

export interface BezierCurveFloat7 {
  Keys: Key7[]
}

export interface Key7 {
  KeyFloat?: KeyFloat7
}

export interface KeyFloat7 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface TapeReferenceClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  Path: string
  Loop?: number
}

export interface SizeClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  ActorPaths: ActorPath4[]
  CurveX: CurveX2
  CurveY: CurveY2
}

export interface ActorPath4 {
  VAL: string
}

export interface CurveX2 {
  BezierCurveFloat: BezierCurveFloat8
}

export interface BezierCurveFloat8 {
  Keys: Key8[]
}

export interface Key8 {
  KeyFloat: KeyFloat8
}

export interface KeyFloat8 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface CurveY2 {
  BezierCurveFloat: BezierCurveFloat9
}

export interface BezierCurveFloat9 {
  Keys: Key9[]
}

export interface Key9 {
  KeyFloat: KeyFloat9
}

export interface KeyFloat9 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface RotationClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  ActorPaths: ActorPath5[]
  CurveZ: CurveZ2
}

export interface ActorPath5 {
  VAL: string
}

export interface CurveZ2 {
  BezierCurveFloat: BezierCurveFloat10
}

export interface BezierCurveFloat10 {
  Keys: Key10[]
}

export interface Key10 {
  KeyFloat: KeyFloat10
}

export interface KeyFloat10 {
  Value: any
  NormalIn: any
  NormalOut: any
}

export interface SoundSetClip {
  Id: number
  TrackId: number
  StartTime: number
  Duration: number
  SoundSetPath: string
}

export interface Track {
  TapeTrack: TapeTrack
}

export interface TapeTrack {
  id: number
  name: string
}

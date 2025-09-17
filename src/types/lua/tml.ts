export interface Timeline {
  params: Params
}

export interface Params {
  NAME: string
  Actor_Template: ActorTemplate
}

export interface ActorTemplate {
  TAGS: Tags[]
  COMPONENTS: Components[]
}

export interface Tags {
  VAL: string
}

export interface Components {
  NAME: string
  JD_Timeline_Template: JdTimelineTemplate
}

export interface JdTimelineTemplate {
  song: string
  SongGeneralData: SongGeneralData
  KaraokeScoringData: KaraokeScoringData
  pictos: Picto[]
  moves: Mfe[],
  movesKinect?: Mfe[]
  lyrics: Lyric[]
  Block: Block[]
  layers: Layer[]
  moveModels: MoveModel[]
  BlockModel: BlockModel[]
  PictoModel: PictoModel[]
}

export interface SongGeneralData {
  TimelineGeneralData: TimelineGeneralData
}

export interface TimelineGeneralData {
  jdVersion: number
  firstSignatureBeat: number
}

export interface KaraokeScoringData {
  TimelineKaraokeScoringData: TimelineKaraokeScoringData
}

export interface TimelineKaraokeScoringData {
  params: Params2
  vect: Vect[]
}

export interface Params2 {
  LiveSignalAnalyzerParameters: LiveSignalAnalyzerParameters
}

export interface LiveSignalAnalyzerParameters {
  windowSize: number
  windowHop: number
  RMSThreshold: number
  slidingMeanVariationThreshold: number
}

export interface Vect {
  SignalAnnotation: SignalAnnotation
}

export interface SignalAnnotation {
  startTime: number
  endTime: number
  pitch: number
  tolerance: Tolerance
}

export interface Tolerance {
  TolerancePitchTime: TolerancePitchTime
}

export interface TolerancePitchTime {
  startTime: number
  endTime: number
  pitchLow: number
  pitchHigh: number
  semitoneTolerance: number
}

export interface Picto {
  PictoClip: PictoClip
}

export interface PictoClip {
  position: number
  pictoname: string
  layerID: number
  texturePath: string
}

export interface Mfe {
  MoveClip: MoveClip
}

export interface MoveClip {
  moveName: string
  layerID: number
  classifierPath: string
  startPosition: number
  stopPosition: number
  goldMove?: number
}

export interface Lyric {
  LyricClip: LyricClip
}

export interface LyricClip {
  text: string
  layerID: number
  startPosition: number
  stopPosition: number
  isLineEnding?: number
}

export interface Block {
  TimelineBlock: TimelineBlock
}

export interface TimelineBlock {
  startPosition: number
  stopPosition: number
  layerID: number
  modelName: string
  color: number
  Parameters?: Parameter[]
}

export interface Parameter {
  NAME: string
  BlockParameterString: BlockParameterString
}

export interface BlockParameterString {
  value: string
}

export interface Layer {
  TimelineLayer: TimelineLayer
}

export interface TimelineLayer {
  layerType: number
  layerName: string
  layerPosition: number
  layerID: number
  layerColor: number
}

export interface MoveModel {
  TimelineModelMove: TimelineModelMove
}

export interface TimelineModelMove {
  name: string
  lengthInSubdivisions: number
  subdivisionsInBeat: number
  color: number
  slack: number
  slackPS3: number
  slackWiiU: number
  capacity: number
  stability: number
}

export interface BlockModel {
  TimelineModelBlock: TimelineModelBlock
}

export interface TimelineModelBlock {
  name: string
  subdivisionsInBeat: number
  sizeInModel: number
  parameterType: ParameterType[]
}

export interface ParameterType {
  TimelineParameterType: TimelineParameterType
}

export interface TimelineParameterType {
  parameterName: string
  parameterTypeAndDefaultValue: ParameterTypeAndDefaultValue
}

export interface ParameterTypeAndDefaultValue {
  NAME: string
  BlockParameterString: BlockParameterString2
}

export interface BlockParameterString2 {
  value: string
}

export interface PictoModel {
  TimelineModelPicto: TimelineModelPicto
}

export interface TimelineModelPicto {
  pictoname: string
}

class UnitConverter {

  markers: any;
  sampleRate: number;
  ticksPerBeat: number;
  beatDurations: number[];

  constructor(markers: string | any[], sampleRate = 48000, ticksPerBeat = 24) {
    this.markers = markers; // Sample positions from .trk
    this.sampleRate = sampleRate;
    this.ticksPerBeat = ticksPerBeat;
    this.beatDurations = [];
    for (let i = 1; i < markers.length; i++) {
      this.beatDurations.push((markers[i] - markers[i - 1]) / sampleRate);
    }
    this.beatDurations.push(this.beatDurations[this.beatDurations.length - 1] || 0.4);
  };

  timeFromBeat(beatNumber: number) {
    const floorBeat = Math.floor(beatNumber);
    const fractionalBeat = beatNumber - floorBeat;
    if (floorBeat < 0) {
      return beatNumber * this.beatDurations[0];
    }
    if (floorBeat >= this.markers.length - 1) {
      const lastMarkerTime = this.markers[this.markers.length - 1] / this.sampleRate;
      return lastMarkerTime + (beatNumber - (this.markers.length - 1)) * this.beatDurations[this.beatDurations.length - 1];
    }
    const startMarker = this.markers[floorBeat] / this.sampleRate;
    const beatDuration = this.beatDurations[floorBeat];
    return startMarker + fractionalBeat * beatDuration;
  };

  ticksFromBeat(beatNumber: number) {
    return Math.floor(beatNumber * this.ticksPerBeat);
  };

  beatFromTime(timeInSeconds: number) {
    if (timeInSeconds < 0) {
      return timeInSeconds / this.beatDurations[0];
    }
    let prevMarker = 0;
    let prevBeat = 0;
    for (let i = 0; i < this.markers.length; i++) {
      const markerTime = this.markers[i] / this.sampleRate;
      if (markerTime > timeInSeconds) {
        const beatDuration = this.beatDurations[i - 1] || this.beatDurations[0];
        return prevBeat + (timeInSeconds - prevMarker) / beatDuration;
      }
      prevMarker = markerTime;
      prevBeat = i;
    }
    const lastBeatDuration = this.beatDurations[this.beatDurations.length - 1];
    return prevBeat + (timeInSeconds - prevMarker) / lastBeatDuration;
  };

  getBPM() {
    const avgBeatDuration = this.beatDurations.reduce((a, b) => a + b, 0) / this.beatDurations.length;
    return 60 / avgBeatDuration;
  };
};

export default UnitConverter;
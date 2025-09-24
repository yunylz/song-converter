/**
 * UnitConverter class to handle conversions between beats, time (seconds), and ticks.
 */
class UnitConverter {
  markers: any;
  sampleRate: number;
  ticksPerBeat: number;
  beatDurations: number[];

  /**
   * UnitConverter constructor to initialize the converter with markers, sample rate, and ticks per beat.
   * @param markers Array of sample positions indicating beat markers.
   * @param sampleRate Sample rate of the audio (default is 48000 Hz).
   * @param ticksPerBeat Number of ticks per beat (default is 24).
   */
  constructor(markers: string | any[], sampleRate = 48000, ticksPerBeat = 24) {
    this.markers = markers; // Sample positions from .trk
    this.sampleRate = sampleRate;
    this.ticksPerBeat = ticksPerBeat;
    this.beatDurations = [];

    for (let i = 1; i < markers.length; i++) {
      this.beatDurations.push((markers[i] - markers[i - 1]) / sampleRate);
    }
    
    this.beatDurations.push(this.beatDurations[this.beatDurations.length - 1] || 0.4);
  }

  /**
   * Converts a beat number (can be fractional) to time in seconds.
   * @param beatNumber Beat number to convert (can be fractional)
   * @returns Time in seconds
   */
  timeFromBeat(beatNumber: number): number {
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
  }

  /**
   * Converts a beat number (can be fractional) to ticks.
   * @param beatNumber Beat number to convert (can be fractional)
   * @returns Ticks corresponding to the given beat number
   */
  ticksFromBeat(beatNumber: number): number {
    return Math.floor(beatNumber * this.ticksPerBeat);
  }

  /**
   * Converts ticks to a beat number (can be fractional).
   * @param ticks Number of ticks to convert
   * @returns Beat number corresponding to the given ticks
   */
  beatFromTicks(ticks: number): number {
    return ticks / this.ticksPerBeat;
  }

  /**
   * Converts ticks to time in seconds.
   * @param ticks Number of ticks to convert
   * @returns Time in seconds corresponding to the given ticks
   */
  timeFromTicks(ticks: number): number {
    const beatNumber = this.beatFromTicks(ticks);
    return this.timeFromBeat(beatNumber);
  }

  /**
   * Converts a time in seconds to a beat number (can be fractional).
   * @param timeInSeconds Time in seconds to convert
   * @returns Beat from the given time in seconds
   */
  beatFromTime(timeInSeconds: number): number {
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
  }

  /**
   * Converts time in seconds to ticks.
   * @param timeInSeconds Time in seconds to convert
   * @returns Ticks corresponding to the given time
   */
  ticksFromTime(timeInSeconds: number): number {
    const beatNumber = this.beatFromTime(timeInSeconds);
    return this.ticksFromBeat(beatNumber);
  }

  /**
   * Gets the average BPM (Beats Per Minute) of the song.
   * @returns Average BPM calculated from the beat durations.
   */
  getBPM(): number {
    const avgBeatDuration = this.beatDurations.reduce((a, b) => a + b, 0) / this.beatDurations.length;
    return 60 / avgBeatDuration;
  }
}

export default UnitConverter;
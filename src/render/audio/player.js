

// ## suiAudioPlayer
// Play the music, ja!
class suiAudioPlayer {

    static set playing(val) {
        suiAudioPlayer._playing = val;
    }

    static get instanceId() {
        if (typeof(suiAudioPlayer._instanceId) == 'undefined') {
            suiAudioPlayer._instanceId = 0;
        }
        return suiAudioPlayer._instanceId;
    }
    static incrementInstanceId() {
        var id = suiAudioPlayer.instanceId + 1;
        suiAudioPlayer._instanceId = id;
        return id;
    }
    static get playing() {
        if (typeof(suiAudioPlayer._playing) == 'undefined') {
            suiAudioPlayer._playing = false;
        }
        return suiAudioPlayer._playing;
    }

    static pausePlayer() {
        if (suiAudioPlayer._playingInstance) {
            var a = suiAudioPlayer._playingInstance;
            a.paused = true;
        }
        suiAudioPlayer.playing = false;
    }
    static stopPlayer() {
        if (suiAudioPlayer._playingInstance) {
            var a = suiAudioPlayer._playingInstance;
            a.paused = false;
        }
        suiAudioPlayer.playing = false;
    }

    static get playingInstance() {
        if (!suiAudioPlayer._playingInstance) {
            return null;
        }
        return suiAudioPlayer._playingInstance;
    }

    // the oscAr contains an oscillator for each pitch in the chord.
    // each inner oscillator is a promise, the combined promise is resolved when all
    // the beats have completed.
    static _playChord(oscAr) {
        var par = [];
        oscAr.forEach((osc) => {
            par.push(osc.play());
        });

        return Promise.all(par);
    }

    _createOscillatorsFromMusicData(ar) {
        var rv = [];
        ar.forEach((soundData) => {
            var osc = new suiOscillator({frequency:soundData.frequency,duration:soundData.duration,gain:soundData.gain});
            rv.push(osc);
        });
        return rv;
    }
    _playArrayRecurse(ix,keys,notesToPlay) {
        if (!suiAudioPlayer.playing ||
          suiAudioPlayer.instanceId != this.instanceId) {
               this.tracker.clearMusicCursor();
              return;
          }
        var self = this;
        var key = keys[ix];
        var curTime = parseInt(key);
        var proto = notesToPlay[key];
        var oscs = this._createOscillatorsFromMusicData(proto);

        // Follow the top-staff note in this tick for the cursor
        if (proto[0].selector.staff == 0) {
            this.tracker.musicCursor(proto[0].selector.measure,proto[0].selector.tick);
        }
        if (ix < keys.length - 1) {
            var diff = parseInt(keys[ix+1]);
            var delay = (diff - curTime);
            setTimeout(function() {
                self._playArrayRecurse(ix+1,keys,notesToPlay);
            },delay);
        } else {
            self.tracker.clearMusicCursor();
        }
        suiAudioPlayer._playChord(oscs);
    }
    _playPlayArray() {
        var startTimes = Object.keys(this.sounds).sort((a,b) => {return a < b;});
        this._playArrayRecurse(0,startTimes,this.sounds);
    }
    _populatePlayArray() {
        var maxGain = 0.5/this.score.staves.length;
        this.sounds = {};
        this.score.staves.forEach((staff)  => {
            var accumulator = 0;
            var slurObj = [];
            for (var i = this.startIndex;i<staff.measures.length;++i) {
                var measure=staff.measures[i];
                var voiceIx = 0;
                measure.voices.forEach((voice) => {
                    var prevObj = null;
                    var tick = 0;
                    voice.notes.forEach((note) => {
                        var tempo = measure.getTempo();
                        tempo = tempo ? tempo : new SmoTempoText();
                        var bpm = tempo.bpm;
                        var beats = note.tickCount/4096;
                        var duration = (beats / bpm) * 60000;

                        // adjust if bpm is over something other than 1/4 note
                        duration = duration * (4096/tempo.beatDuration);
                        var selector = {staff:measure.measureNumber.staffId,measure:measure.measureNumber.measureIndex,voice:voiceIx,tick:tick}
                        var startSlurs = staff.getSlursStartingAt(selector);

                        var gain = maxGain/note.pitches.length;
                        if (note.noteType == 'n') {
                            note.pitches.forEach((pitch) => {
                                var frequency = suiAudioPitch.smoPitchToFrequency(pitch);
                                var obj = {
                                    duration:duration,
                                    frequency: frequency,
                                    gain:gain,
                                    selector:selector,
                                    note:note,
                                    measure:measure,
                                    staff:staff
                                };
                                if (this.sounds[accumulator]) {
                                    this.sounds[accumulator].push(obj);
                                } else {
                                    this.sounds[accumulator]=[obj];
                                }
                            });
                        }
                        accumulator += Math.round(duration);
                        tick += 1;
                    });
                    voiceIx += 1;
                });
            }
        });
    }

    play() {
        if (suiAudioPlayer.playing) {
            return;
        }
        suiAudioPlayer._playingInstance = this;
        this._populatePlayArray();
        suiAudioPlayer.playing = true;
        this._playPlayArray();
    }

    constructor(parameters) {
        this.instanceId = suiAudioPlayer.incrementInstanceId();
        suiAudioPlayer.playing=false;
        this.paused = false;
        this.startIndex = parameters.startIndex;
        this.playIndex = 0;
        this.tracker = parameters.tracker;
        this.score = parameters.score;
        this._populatePlayArray();
    }
}

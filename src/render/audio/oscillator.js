
var AudioContext = window.AudioContext || window.webkitAudioContext;

class suiAudioPitch {
    // ### _frequencies
    // Compute the equal-temperment frequencies of the notes.
    static get _frequencies() {
        var map={};
        var letter='a';
        const octaves=[1,2,3,4,5,6,7];
        const letters = ["cn","c#", "dn", "d#","en", "fn", "f#","gn","g#","an", "a#","bn"];
        const lindex = [0,1,2,3,4,5,6];
       
        const just = Math.pow(2,(1.0/12));
        const baseFrequency=(440/16) * Math.pow(just,3);
        
        var aaccum = baseFrequency;
        
        octaves.forEach((octave) => {
            var oint = parseInt(octave);
            var base = baseFrequency*Math.pow(2,oint);
            var lix = 0;
            letters.forEach((letter) => {
                var freq = base*Math.pow(just,lix);
                var enharmonics = smoMusic.getEnharmonics(letter);
                enharmonics.forEach((en) => {
                    map[en+octave.toString()] = freq;
                });
                lix += 1; 
            });
        });
        
        return map;        
    }
    
    static get pitchFrequencyMap() {
        suiAudioPitch._pmMap = typeof(suiAudioPitch['_pmMap']) == 'undefined' ? suiAudioPitch._frequencies : suiAudioPitch._pmMap;
        return suiAudioPitch._pmMap;
    }
    
    static smoPitchToFrequency(smoPitch) {
        var vx = smoPitch.letter.toLowerCase() + smoPitch.accidental + smoPitch.octave.toString();
        return suiAudioPitch.pitchFrequencyMap[vx];
    }
}

class suiAudioPlayer {
    static get playingMode() {
        return {
            note:0,fromStart:1,fromSelection:2,range:3
        }
    }
    static set playing(val) {
        suiAudioPlayer._playing = val;
    }
    static get playing() {
        if (typeof(suiAudioPlayer._playing) == 'undefined') {
            suiAudioPlayer._playing = false;            
        }
        return suiAudioPlayer._playing;
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
    
    // A single voice-measure.
    static _playVoice(voiceOsc) {
        var measureCompletePromise = new Promise((resolve) => {
            var recursePlayer = (ix,oscAr) => {
                return suiAudioPlayer._playChord(voiceOsc[ix]).then(() =>{
                    if (suiAudioPlayer.playing && voiceOsc.length - 1 > ix) {
                        recursePlayer(ix+1,voiceOsc);
                    } else {
                        resolve();
                    }
                });
            }
            recursePlayer(0,voiceOsc);                
        });
        return measureCompletePromise;
    }
    
    static _playMeasure(measureOsc) {
       var par = [];
       measureOsc.forEach((voiceOsc) => {
           par.push(suiAudioPlayer._playVoice(voiceOsc));
       });
       
       return Promise.all(par);
    }
    
    static _playMeasureAllStaffs(measureIx,staffList) {
        var par = [];
        staffList.forEach((staffOsc) => {
            var measureOsc = staffOsc[measureIx];
            par.push(suiAudioPlayer._playMeasure(measureOsc));
        });
        
        return par;
    }
    

       
    
    static _createOscillatorsForMeasure(staff,measure) {
         var tempo = measure.getTempo();
        tempo = tempo ? tempo : new SmoTempoText();
        var tickTime = 60000/tempo.bpm;
        var voiceOsc = [];
        measure.voices.forEach((voice) => {
            var ix = 0;
            var pitchOsc = [];
            voiceOsc.push(pitchOsc);
            voice.notes.forEach((note) => {
                // TODO: selector isn't really used here.
                var ss={
                    staff:staff.staffId,measure:ix,tick:ix
                };
                ss.tick=ix;
                var nsel = new SmoSelection({
									selector: ss,
									_staff: staff,
									_measure: measure,
									_note: note,
									_pitches: [],
								});
                
                pitchOsc.push(suiOscillator.fromSelection(nsel));
                ix += 1;
            });
        });
        
        return voiceOsc;        
    }
    
    
    static _createOscillatorsAllStaffs(score,measureIx) {
        measureIx = measureIx ? measureIx : 0;
        var staffList = [];

        score.staves.forEach((staff) => {
            var measureList = [];
            var measures = staff.measures.filter((mm) => mm.measureNumber.measureIndex >= measureIx);
            measures.forEach((measure) => {
                measureList.push( suiAudioPlayer._createOscillatorsForMeasure(staff,measure));
            });
            staffList.push(measureList);
        });        
        return staffList;
    }
    play() {
                
        var playRecurse = (oscillators,ix) => {
            Promise.all(suiAudioPlayer._playMeasureAllStaffs(ix,oscillators)).then(() => {
                if (suiAudioPlayer.playing && ix < oscillators[0].length - 1) {
                    playRecurse(oscillators,ix+1);
                } else {
                    suiAudioPlayer.playing = false;
                }
            });
        }
        
        suiAudioPlayer.playing = true;
        playRecurse(this.oscillators,0);
    }
    
    constructor(parameters) {
        suiAudioPlayer.playing=false;
        this.score = parameters.score;
        this.oscillators=suiAudioPlayer._createOscillatorsAllStaffs(this.score,parameters.startIndex);
    }
    
}
class suiOscillator {
    static get defaults() {
        
        var obj = {            
            duration:1000,
            frequency:440,
            attackEnv:0.05,
            decayEnv:0.15,
            sustainEnv:0.7,
            releaseEnv:0.1,
            sustainLevel:0.5,
            releaseLevel:0.2,
            waveform:'triangle',
            gain:0.4
        };
        
        var wavetable = {
            real:[0,1],
            imaginary:[0,0]
        }
        obj.wavetable = wavetable;
        return obj;
    }
    
    static playSelectionNow(selection) {
        setTimeout(function() {
        var ar = suiOscillator.fromSelection(selection);
        ar.forEach((osc) => {
            osc.play();
        });
        },1);
    }
    
    // AR contains an array of arrays of oscillators.
    // The outer array contains an array for each tick/note in a measure.
    // the inner array contains an oscillator for each note in the chord.
    static playOscillatorArray(ar) {
        function playIx(ix,oscAr) {
            var par = [];
            oscAr.forEach((osc) => {
                par.push(osc.play());
            });
            ix += 1;
            Promise.all(par).then(() => {
                if (ix < ar.length) {
                    playIx(ix,ar[ix]);
                }
            });
        }
        playIx(0,ar[0]);
    }
    static playMeasureNow(score,selection) {
        var player = new suiAudioPlayer({score:score,startIndex:selection.selector.measure});
        player.play();
        /* setTimeout(function() {
        var voices = suiOscillator.measureOscillators(selection);
        voices.forEach((voice) => {
            suiOscillator.playOscillatorArray(voice);
        });
        },1);  */
    }
    static measureOscillators(selection) {
        var measure = selection.measure;
        var tempo = measure.getTempo();
        tempo = tempo ? tempo : new SmoTempoText();
        var tickTime = 60000/tempo.bpm;
        var voiceOsc = [];
        selection.measure.voices.forEach((voice) => {
            var ix = 0;
            var rv = [];
            voiceOsc.push(rv);
            voice.notes.forEach((note) => {
                var ss=JSON.parse(JSON.stringify(selection.selector));
                ss.tick=ix;
                var nsel = new SmoSelection({
									selector: ss,
									_staff: selection.staff,
									_measure: selection.measure,
									_note: note,
									_pitches: [],
								});
                
                rv.push(suiOscillator.fromSelection(nsel));
                ix += 1;
            });
        });
        
        return voiceOsc;
    }
    static fromSelection(selection) {
        var tempo = selection.measure.getTempo();
        tempo = tempo ? tempo : new SmoTempoText();
        var bpm = tempo.bpm;
        var beats = selection.note.tickCount/4096;
        var duration = (beats / bpm) * 60000;
        
        var ar = [];
        var gain = 0.5/selection.note.pitches.length; 
        selection.note.pitches.forEach((pitch) => {
            var frequency = suiAudioPitch.smoPitchToFrequency(pitch);
            var osc = new suiOscillator({frequency:frequency,duration:duration,gain:gain});
            ar.push(osc);
        });
        
        return ar;
    }
    
    static get attributes() {
        return ['duration','frequency','pitch','attackEnv','sustainEnv','decayEnv','releaseEnv','sustainLevel','releaseLevel','waveform','wavetable','gain'];
    }
    
    static get audio() {
        if (typeof (suiOscillator['_audio']) == 'undefined') {
            suiOscillator._audio = new AudioContext();
        }
        return suiOscillator._audio;
    }
    
    _playPromise(osc,duration,gain) {
        var audio = suiOscillator.audio;
        var promise = new Promise((resolve) => {
            osc.start(0);
            
        

        setTimeout(function() {
           // gain.gain.setTargetAtTime(0, audio.currentTime, 0.015);
            resolve();
            osc.stop(0);
            osc.disconnect(gain);
            gain.disconnect(audio.destination);
        }, duration);
        });
        
        return promise;
    }
    
    static toFloatArray(ar) {
        var rv = new Float32Array(ar.length);
        for (var i=0;i<ar.length;++i) {
            rv[i] = ar[i];
        }
        
        return rv;
    }
    
    play() {
        
        var audio = suiOscillator.audio;
        var gain = audio.createGain();
        var osc = audio.createOscillator();

        gain.connect(audio.destination);
        gain.gain.setValueAtTime(0, audio.currentTime);
        var attack = this.attack / 1000;
        var decay = this.decay/1000;
        var sustain = this.sustain/1000;
        var release = this.release/1000;
        gain.gain.linearRampToValueAtTime(this.gain, audio.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(this.sustainLevel*this.gain, audio.currentTime + attack + decay);
        gain.gain.exponentialRampToValueAtTime(this.releaseLevel*this.gain,audio.currentTime + attack + decay + sustain );
        gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime + attack + decay + sustain + release);
        if (this.waveform != 'custom') {
            osc.type = this.waveform;
        } else {
            var wave = audio.createPeriodicWave(suiOscillator.toFloatArray(this.wavetable.real), suiOscillator.toFloatArray(this.wavetable.imaginary), 
               {disableNormalization: true});
            osc.setPeriodicWave(wave);
        }
        osc.frequency.value = this.frequency;
        osc.connect(gain);
        gain.connect(audio.destination);
        return this._playPromise(osc,this.duration,gain);
    }

   
    constructor(parameters) {
        parameters = parameters ? parameters : {};
		smoMusic.serializedMerge(suiOscillator.attributes, suiOscillator.defaults, this);
		smoMusic.serializedMerge(suiOscillator.attributes, parameters, this);
        this.attack = this.attackEnv*this.duration;
        this.decay = this.decayEnv*this.duration;
        this.sustain = this.sustainEnv*this.duration;
        this.release = this.releaseEnv*this.duration;
        
        // Note: having some trouble with FloatArray and wavetable on some browsers, so I'm not using it 
        // use built-in instead        
        if (parameters.waveform && parameters.waveform != 'custom') {
            this.waveform = parameters.waveform;
        } else {
            this.waveform='custom';
        }       
    }
}
VF = Vex.Flow;
Vex.Xform = (typeof (Vex.Xform)=='undefined' ? {} : Vex.Xform);
VX = Vex.Xform;

VX.groupCounter = 1;

// ## Description:
//   Create a staff and draw music on it.
//
// ##  Options:
//  clef:'treble',
//  num_beats:num_beats,
//  timeSignature: '4/4'

class StaffMeasure {
    constructor(context,options) {
        this.context = context;
        this.timeSignature='4/4';
        this.keySignature = "G";
        Vex.Merge(this, options);
        this.notes = [];
        this.meterNumbers=this.timeSignature.split('/').map(number => parseInt(number,10));
        this.groupName = 'staffGroup-' + VX.groupCounter;
        VX.groupCounter += 1;
    }


    drawNotes(notes) {
        if (this.notes.length) {
            $(this.context.svg).find('#vf-' + this.notes[0].attrs.id).closest('g.measure').remove();
        }
        this.notes = notes;

        var group = this.context.openGroup();
        group.classList.add(this.groupName);
        group.classList.add('measure');

        // Create a stave of width 400 at position 10, 40 on the canvas.
        var stave = new VF.Stave(10, 40, 400);

        // Add a clef and time signature.
        stave.addClef(this.clef).addTimeSignature(this.timeSignature).addKeySignature(this.keySignature);

        // Connect it to the rendering context and draw!
        stave.setContext(this.context).draw();

        // console.log(JSON.stringify(notes));
        // Create a voice in 4/4 and add above notes
        var voice = new VF.Voice({
            num_beats: this.num_beats
        });
        voice.addTickables(notes);

        // var beams = VF.Beam.generateBeams(notes);
        this.createBeamGroups(voice, notes);

        var km = new VF.KeyManager(this.keySignature);
        var canon = VF.Music.canonical_notes;
        notes.forEach(function(note) {
            if (note.dots > 0) {
                note.addDotToAll();
            }
            for (var i = 0; i < note.keys.length;++i) {
                var prop = note.keyProps[i];
                var key = prop.key.toLowerCase();
                if (km.scale.indexOf(canon.indexOf(key)) < 0) {
                    if (!prop.accidental)
                        prop.accidental = 'n';
                    note.addAccidental(0, new VF.Accidental(prop.accidental));
                }
            }
        });
        // Format and justify the notes to 400 pixels.
        var formatter = new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave);

        // Render voice
        voice.draw(this.context, stave);
        this.drawBeams();

        this.drawTuplets(notes, this.context);
        this.context.closeGroup();

        return {
            group: group,
            voice: voice,
            staff: stave,
            notes: notes,
            beams: this.beams,
            keySignature:this.keySignature
        };
    }

    drawBeams() {
        var self = this;
        this.beams.forEach(function (b) {
            b.setContext(self.context).draw()
        });
    }
    createBeamGroups(voice, notes) {

        var rv = [];
        var duration = 0;
        var startRange = 0;
        var beamBeats = 2*2048;
        if (this.meterNumbers[0] % 3 == 0) {
            beamBeats = 3*2048;
        }
        var beamLogic = function (iterator, notes, note) {
            duration += iterator.delta;
            if (note.tupletStack.length) {
                //todo: when does stack have more than 1?
                var tuplen = note.tupletStack[0].notes.length;

                // Get an array of tuplet notes, and skip to the end of the tuplet
                var tupNotes = iterator.skipNext(tuplen);

                if (iterator.delta < 4096) {
                rv.push(new VF.Beam(tupNotes));
                }
                return;
            }
            // don't beam > 1/4 note in 4/4 time
            if (iterator.delta >= beamBeats) {
                duration = 0;
                startRange = iterator.index + 1;
                // iterator.resetRange();
                return;
            }
            if (duration == beamBeats) {

                rv.push(new VF.Beam(notes.slice(startRange, iterator.index + 1)));
                startRange = iterator.index + 1;
                duration = 0;
                return;
            }

            // If this does not align on a beat, don't beam it
            if (duration > beamBeats ||
                ((iterator.totalDuration - duration) % beamBeats != 0)) {
                duration = 0;
                startRange = iterator.index + 1;
                return;
            }
        }
        VX.ITERATE(beamLogic, notes, {voice:voice,timeSignature:this.timeSignature});
        this.beams = rv;
    }

    drawTuplets(notes, context) {
        var self = this;
        VX.ITERATE(function (iterator, notes, note) {
            note.tupletStack.forEach(function (tuplet) {
                tuplet.setContext(self.context).draw();
            });
        }, notes);
    }

}


class Tracker {
  constructor(music, context,staffMeasure) {
    this.modNote = 0;
    this.staffMeasure = staffMeasure;
    this.music = music;
    this.context = context;
    this.drawRect(music.notes[0]);
    var self = this;

    $('#left').off('click').on('click', function() {
      self.leftHandler();
    });

    $('#right').off('click').on('click', function() {
      self.rightHandler();
    });
      $('#up').off('click').on('click', function() {
          self.upHandler();
      });
      $('#down').off('click').on('click', function() {
          self.downHandler();
      });
      $('#upOctave').off('click').on('click', function() {
          self.offsetHandler(12);
      });
      $('#downOctave').off('click').on('click', function() {
          self.offsetHandler(-12);
      });
      $('#noteGroup button').off('click').on('click', function() {
          var note = $(this).attr('id')[0].toLowerCase();
          self.anoteHandler(note);
      });
  }

  drawRect(note) {
    $(this.context.svg).find('g.vf-note-box').remove();
    var bb = note.getBoundingBox();
    var grp = this.context.openGroup('note-box', 'box-' + note.attrs.id);
    this.context.rect(bb.x, bb.y, bb.w + 3, bb.h + 3, {
      stroke: '#fc9',
      'stroke-width': 2,
      'fill': 'none'
    });
    this.context.closeGroup(grp);
  }
  leftHandler() {
    var len = this.music.notes.length;
    this.modNote = (this.modNote + len - 1) % len;
    this.drawRect(this.music.notes[this.modNote]);

  }
  rightHandler() {
    var len = this.music.notes.length;
    this.modNote = (this.modNote + 1) % len;
    this.drawRect(this.music.notes[this.modNote]);

  }
    offsetHandler(offset) {
        var note = this.music.notes[this.modNote];
        var keys = [];
        var canon = VF.Music.canonical_notes;
        for (var i = 0; i < note.keys.length;++i) {
            var prop = note.keyProps[i];
            var key = prop.key.toLowerCase();
            var index = (canon.indexOf(key) + canon.length+offset) % canon.length;
            var octave = prop.octave;
            if (Math.abs(offset) >= 12) {
                offset = Math.sign(offset) * Math.round(Math.abs(offset) / 12);
                octave += offset;
            }
            if (canon[index] == 'b')
                octave -= 1;
            key = canon[index] + '/' + octave;
            console.log('push ' + key);
            keys.push(key);
        }
        this.music.notes = VX.SETPITCH(music.notes, this.modNote,keys);
        this.music = this.staffMeasure.drawNotes(this.music.notes);

  }
    downHandler() {
      this.offsetHandler(-1);     
    }
  upHandler() {
    this.offsetHandler(1);
  }
  anoteHandler(pitch) {
      var km = new VF.KeyManager(this.staffMeasure.keySignature);
      var noteType = 'n';
      if (pitch.toLowerCase() == 'r') {
          noteType = 'r';
          pitch = 'c';
      }
      pitch = km.scaleMap[pitch];
      var note = this.music.notes[this.modNote];
      var oldType = note.noteType;
      var keys = [];
      var canon = VF.Music.canonical_notes;
      var prop = note.keyProps[0];
      var key = pitch+'/'+prop.octave;
      if (noteType == oldType) {
          this.music.notes = VX.SETPITCH(music.notes, this.modNote, [key]);
      } else {
          this.music.notes = VX.SETNOTETYPE(music.notes, this.modNote, noteType);
      }
      this.music = this.staffMeasure.drawNotes(this.music.notes);
  }
}
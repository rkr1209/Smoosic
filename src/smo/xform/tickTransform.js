
VF = Vex.Flow;
Vex.Xform = (typeof(Vex.Xform) == 'undefined' ? {}
     : Vex.Xform);
VX = Vex.Xform;

// ## SmoTickTransformer
//  Transform a note (tick) array for a measure into another note array.  The new array may have fewer or
//  additional notes.
//
//
// ## Usage:
//  A number of actors act on the existing notes and create new notes.  The notes are only
//  pitches and durations - no modifiers, since modifiers can be added to existing notes.
//
//  Because of the way tuplets and beam groups interact in VF, transformations need to be done
//  in a certain order.
//  1) actors that change the pitch, durations remain the same
//  2) actors that change the duration.   ** Note:  Even if you are not changing the
//     duration of any notes, you need to run a duration transformation to create the tuplet
//     groups
class SmoTickTransformer {
    constructor(measure, actors, options) {
        this.notes = measure.notes;
        this.measure = measure;
        this.vxNotes = [];
        this.actors = actors ? actors : [];
        this.keySignature = 'C';
        this.accidentalMap = [];
        Vex.Merge(this, options);
    }
    static nullActor(note) {
        return note;
    }

    // ## transformNote
    // call the actors for each note, and put the result in the note array.
    // The note from the original array is copied and sent to each actor.
    //
    // Because the resulting array can have a different number of notes than the existing
    // array, the actors communicate with the transformer in the following, jquery-ish
    // but somewhat unintuitive way:
    //
    // 1. if the actor returns null, the next actor is called and the results of that actor are used
    // 2. if all the actors return null, the copy is used.
    // 3. if a note object is returned, that is used for the current tick and no more actors are called.
    // 4. if an array of notes is returned, it is concatenated to the existing note array and no more actors are called.
    //     Note that *return note;* and *return [note];* produce the same result.
    // 5. if an empty array [] is returned, that copy is not added to the result.  The note is effectively deleted.
    transformTick(iterator, note) {
        var self = this;
       
        for (var i = 0; i < this.actors.length; ++i) {
			var actor=this.actors[i];
            var newNote = actor.transformTick(note, iterator, iterator.accidentalMap);
            if (newNote == null) {
				this.vxNotes.push(note); // no change
                continue;
            }
            if (Array.isArray(newNote)) {
                if (newNote.length === 0) {
                    return;
                }
                this.vxNotes = this.vxNotes.concat(newNote);
                return;
            }
            this.vxNotes.push(newNote);
            return;
        }
    }

    run() {
        var self = this;
        var iterator = new smoTickIterator(this.measure);
        iterator.iterate((iterator, note, accidentalMap) => {
            self.transformTick(iterator, note, accidentalMap);
        });

        this.notes = this.vxNotes;
        return this.vxNotes;
    }
}

// ## A note transformer is just a function that modifies a note in some way.
// Any number of transformers can be applied to a note.
class TickTransformBase {
    constructor() {}
    transformTick(note, iterator, accidentalMap) {
        return note;
    }
}

class SmoTransposePitchActor extends TickTransformBase {
    constructor(parameters) {
		super();
		Vex.Merge(this,parameters);        
    }
    transformTick(note, iterator, accidentalMap) {
        var index = iterator.index;
        if (this.selections.pitchArray(index).length === 0) {
            return null;
        }
        return note.transpose(this.selections.pitchArray(iterator.index),this.offset);
    }
}

class SmoSetNoteTypeActor extends TickTransformBase {
    constructor(measure, selections, noteType) {
		super();
        this.keySignature = measure.keySignature;
        this.tickArray = selection.tickArray();
        this.selections = selections;
        this.offset = offset;
    }
    transformTick(note, iterator, accidentalMap) {
        var index = iterator.index;
        if (this.tickArray().indexOf(index) < 0) {
            return null;
        }
		note.noteType=this.noteType;
        return note;
    }

}

class SmoSetPitchActor extends TickTransformBase {
    constructor(parameters) {
		super();
		Vex.Merge(this,parameters);
    }
    transformTick(note, iterator, accidentalMap) {
        var index = iterator.index;
        if (this.selection !== index) {
            return null;
        }
	    // TODO: fix this.
		note.keys=this.keys;
		return note;
    }

}
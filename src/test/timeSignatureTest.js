
class TimeSignatureTest {
    
    static CommonTests() {
		var score = SmoScore.getDefaultScore({},{timeSignature:'6/8',clef:'treble'});
		var layout = smrfSimpleLayout.createScoreLayout(document.getElementById("boo"),score);
		var measure = score.getMeasureAtSelection({measureIndex:0});
		
        var timeTest = () => {
            const promise = new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve();
                    },
                        500);
                });
            return promise;
        }
		
		var signalComplete = () => {
			return timeTest();
		}

        var drawDefaults = () => {
            // music.notes = VX.APPLY_MODIFIERS (music.notes,staffMeasure.keySignature);
			score.applyModifiers();
            layout.render();
            return timeTest();
        }
		
		var stretchTest = () => {
            var tickmap = measure.tickmap();
        var actor = new SmoStretchNoteActor({
				 startIndex: 0,
                tickmap: tickmap,
				newTicks:6144
			});
            SmoTickTransformer.applyTransform(measure,actor);
            layout.render();
            return timeTest();
		}
		
		var contractTest = () => {
            var tickmap = measure.tickmap();
            var actor = new SmoContractNoteActor({
				 startIndex: 0,
                tickmap: tickmap,
				newTicks:6144/3
			});
            SmoTickTransformer.applyTransform(measure,actor);
            layout.render();
            return timeTest();
		}
		
        var makeDupletTest = () => {
            var tickmap = measure.tickmap();
            var actor = new SmoMakeTupletActor({
                    index: 0,
                    totalTicks: 6144,
                    numNotes: 2,
                    measure: measure
                });
            SmoTickTransformer.applyTransform(measure,actor);
            layout.render();
            return timeTest();
        }
		
		var unmakeTupletTest = () => {
            // maybe just need changeIndex?
            var actor = new SmoUnmakeTupletActor({
                    startIndex:0,
				    endIndex:1,
                    measure: measure
                });
            SmoTickTransformer.applyTransform(measure,actor);
            layout.render();
            return timeTest();
        }

		
        return drawDefaults().then(stretchTest).then(contractTest).then(makeDupletTest).then(unmakeTupletTest).then(signalComplete);
		
    }
}


class VoiceTest {

    static CommonTests() {
		var score = SmoScore.getDefaultScore();
		var layout = smrfSimpleLayout.createScoreLayout(document.getElementById("boo"),score);

		var measure = score.getMeasureAtSelection({measureIndex:0});
		var voice2=SmoMeasure.defaultVoice44;
		measure.voices.push({notes:voice2});
		
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
            // measure.applyModifiers();
            layout.render();
			console.log(JSON.stringify(score,null,' '));
            return timeTest();
        }
		var accidentalTest = () => {
			var target = measure.getSelection(
			0,1,[0]);
			if (target) {
				target.note.transpose([0],-1);
			}
			smoModifierFactory.applyModifiers(measure);
            layout.render();
            return timeTest();
        }
		
		var serializeTest = () => {
			layout.unrender();
			$('#boo').html('');
			score = SmoScore.deserialize(JSON.stringify(serializeTestJson.tupletMeasure));
			layout = smrfSimpleLayout.createScoreLayout(document.getElementById("boo"),score);
			layout.render();
		}
		var serialize = () => {
			console.log(JSON.stringify(score,null,' '));
			return timeTest();
		}
		
        return drawDefaults().then(accidentalTest).then(serializeTest).then(signalComplete);
    }
}
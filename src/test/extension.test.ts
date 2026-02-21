import * as assert from 'assert';

import { preprocessVexTabSource } from '../preprocess';

suite('Preprocess', () => {
	test('Leaves .vt input unchanged', () => {
		const input = 'tabstave\nnotes :8 5/6';
		const { text, mapCursor } = preprocessVexTabSource(input, 'song.vt');
		assert.strictEqual(text, input);
		assert.deepStrictEqual(mapCursor({ line: 2, column: 3 }), { line: 2, column: 3 });
	});

	test('Prefixes tabstave options line in .tab', () => {
		const input = 'notation=true tablature=true time=12/8\nnotes :8 5/6';
		const { text, mapCursor } = preprocessVexTabSource(input, 'song.tab');
		assert.strictEqual(text, 'tabstave notation=true tablature=true time=12/8\nnotes :8 5/6');
		assert.deepStrictEqual(mapCursor({ line: 1, column: 0 }), { line: 1, column: 9 });
	});

	test('Treats empty line as tabstave opener in .tab', () => {
		const input = '\nnotes :8 5/6';
		const { text, mapCursor } = preprocessVexTabSource(input, 'song.tab');
		assert.strictEqual(text, 'tabstave\nnotes :8 5/6');
		assert.deepStrictEqual(mapCursor({ line: 2, column: 2 }), { line: 2, column: 2 });
	});

	test('Inserts implicit tabstave before first directive when missing', () => {
		const input = 'tuning=E/5,C/5\nnotes :8 5/6';
		const { text, mapCursor } = preprocessVexTabSource(input, 'song.tab');
		assert.strictEqual(text, 'tabstave\ntuning=E/5,C/5\nnotes :8 5/6');
		assert.deepStrictEqual(mapCursor({ line: 1, column: 0 }), { line: 2, column: 0 });
		assert.deepStrictEqual(mapCursor({ line: 2, column: 1 }), { line: 3, column: 1 });
	});

	test('Preserves document header lines before implicit tabstave in .tab', () => {
		const input = 'title My Title\nsubtitle My Subtitle\nsidenote Left note\nnotes :8 5/6';
		const { text, mapCursor } = preprocessVexTabSource(input, 'song.tab');
		assert.strictEqual(
			text,
			'title My Title\nsubtitle My Subtitle\nsidenote Left note\ntabstave\nnotes :8 5/6'
		);
		assert.deepStrictEqual(mapCursor({ line: 1, column: 2 }), { line: 1, column: 2 });
		assert.deepStrictEqual(mapCursor({ line: 4, column: 0 }), { line: 5, column: 0 });
	});

	test('Does not open tabstave from leading empty lines before document header in .tab', () => {
		const input = '\n\ntitle My Title\nnotes :8 5/6';
		const { text, mapCursor } = preprocessVexTabSource(input, 'song.tab');
		assert.strictEqual(text, '\n\ntitle My Title\ntabstave\nnotes :8 5/6');
		assert.deepStrictEqual(mapCursor({ line: 3, column: 0 }), { line: 3, column: 0 });
		assert.deepStrictEqual(mapCursor({ line: 4, column: 0 }), { line: 5, column: 0 });
	});
});

import { VexTab, Artist, Vex } from 'vextab';

import { preprocessVexTabSource, type CursorLocation } from './preprocess';

type FontMessage = {
  type: 'font';
  url: string;
};

type UpdateMessage = {
  type: 'update';
  text: string;
  fileName?: string;
};

type CursorMessage = {
	type: 'cursor';
	line: number;
	column: number;
};

type ExportMessage = {
	type: 'export';
	format: 'svg';
	text: string;
	fileName?: string;
	fontUrl?: string;
};

type WebviewMessage = UpdateMessage | FontMessage | CursorMessage | ExportMessage;

type ExportResultMessage =
	| { type: 'exportResult'; ok: true; svg: string }
	| { type: 'exportResult'; ok: false; error: string };

const vscode = acquireVsCodeApi();

const scoreElement = (() => {
	const element = document.getElementById('score');
	if (!element) {
		throw new Error('Missing required DOM elements.');
	}
	return element;
})();

const errorElement = (() => {
	const element = document.getElementById('error');
	if (!element) {
		throw new Error('Missing required DOM elements.');
	}
	return element;
})();

function removeFooterBranding(): void {
	const svg = scoreElement.querySelector('svg');
	if (!svg) {
		return;
	}

	for (const anchor of Array.from(svg.querySelectorAll('a'))) {
		const href =
			anchor.getAttribute('href') ??
			anchor.getAttribute('xlink:href') ??
			(anchor as unknown as { href?: { baseVal?: string } }).href?.baseVal ??
			'';
		if (href.toLowerCase().includes('vextab.com')) {
			anchor.remove();
		}
	}

	for (const text of Array.from(svg.querySelectorAll('text'))) {
		const value = (text.textContent ?? '').trim().toLowerCase();
		if (value.includes('vextab.com')) {
			text.remove();
		}
	}
}

function clearRender(): void {
  scoreElement.innerHTML = '';

  errorElement.textContent = '';
  errorElement.hidden = true;
}

function showError(message: string): void {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    errorElement.textContent = '';
    errorElement.hidden = true;
    return;
  }

  errorElement.textContent = trimmed;
  errorElement.hidden = false;
}

// CursorLocation is shared with the preprocessor.

const artist = new Artist(10, 10, 700, { scale: 0.9 });
const tab = new VexTab(artist);

let lastText = '';
let lastFileName: string | null = null;
let lastCursor: CursorLocation | null = null;
let hasParsedOnce = false;
let lastParsedText: string | null = null;

let renderTimeout: number | null = null;

let lastFontUrl: string | null = null;
let fontLoadPromise: Promise<void> | null = null;

function scheduleRender(): void {
	if (renderTimeout !== null) {
		window.clearTimeout(renderTimeout);
	}

	renderTimeout = window.setTimeout(() => {
		renderTimeout = null;
		render(lastText, lastCursor);
	}, 50);
}

function getSvgMarkup(): string | null {
	const svg = scoreElement.querySelector('svg');
	return svg ? svg.outerHTML : null;
}

function render(text: string, cursor: CursorLocation | null): void {
  clearRender();

	const { text: processedText, mapCursor } = preprocessVexTabSource(text, lastFileName);
	const processedCursor = cursor ? mapCursor(cursor) : null;

	try {
		const renderer = new Vex.Flow.Renderer(scoreElement, Vex.Flow.Renderer.Backends.SVG);
		const shouldHighlight = processedCursor !== null;
		const cursorMatchesLastText =
			shouldHighlight && hasParsedOnce && lastParsedText !== null && processedText === lastParsedText;

		if (shouldHighlight && cursorMatchesLastText) {
			// Use notePositions from the previous parse to pick an index up front.
			tab.setHighlightByLocation(processedCursor!.line, processedCursor!.column);
		} else {
			tab.setHighlightNoteIndex(null);
		}

		artist.reset();
		tab.reset();
		tab.parse(processedText);

		if (shouldHighlight && !cursorMatchesLastText) {
			// Build source->note mapping, compute highlight index, then reparse to apply styles.
			tab.setHighlightByLocation(processedCursor!.line, processedCursor!.column);

			artist.reset();
			tab.reset();
			tab.parse(processedText);
		}

		artist.render(renderer);
		removeFooterBranding();

		hasParsedOnce = true;
		lastParsedText = processedText;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		showError(message);
	}
}

async function loadMusicFont(url: string): Promise<void> {
	await Vex.Flow.Font.load('Bravura', url, { display: 'block' });
	Vex.Flow.Metrics.set('fontFamily', 'Bravura, Academico');
}

async function ensureMusicFont(url: string): Promise<void> {
	if (fontLoadPromise) {
		return fontLoadPromise;
	}

	fontLoadPromise = (async () => {
		try {
			await loadMusicFont(url);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showError(message);
			throw error;
		}
	})();

	return fontLoadPromise;
}

window.addEventListener('message', async (event: MessageEvent) => {
	const { data } = event as MessageEvent<WebviewMessage>;
	if (!data) {
		return;
	}

	if (data.type === 'font') {
		lastFontUrl = data.url;
		void ensureMusicFont(data.url).then(() => {
			scheduleRender();
		});
		return;
	}

	if (data.type === 'update') {
		lastText = data.text;
		lastFileName = data.fileName ?? null;
		scheduleRender();
		return;
	}

	if (data.type === 'cursor') {
		lastCursor = { line: data.line, column: data.column };
		scheduleRender();
		return;
	}

	if (data.type === 'export') {
		if (data.fontUrl) {
			lastFontUrl = data.fontUrl;
		}

		const fontUrl = data.fontUrl ?? lastFontUrl;
		if (fontUrl) {
			try {
				await ensureMusicFont(fontUrl);
			} catch {
				vscode.postMessage({ type: 'exportResult', ok: false, error: 'Failed to load music font.' } satisfies ExportResultMessage);
				return;
			}
		}

		lastText = data.text;
		lastFileName = data.fileName ?? null;
		lastCursor = null;

		render(lastText, null);
		const svg = getSvgMarkup();
		if (!svg) {
			vscode.postMessage({ type: 'exportResult', ok: false, error: 'No SVG output produced.' } satisfies ExportResultMessage);
			return;
		}

		vscode.postMessage({ type: 'exportResult', ok: true, svg } satisfies ExportResultMessage);
	}
});

export type CursorLocation = { line: number; column: number };

export type PreprocessResult = {
	text: string;
	mapCursor: (cursor: CursorLocation) => CursorLocation;
};

const TABSTAVE_PREFIX = 'tabstave ';

function isDocumentHeaderLine(trimmedStart: string): boolean {
	return (
		/^title\b/.test(trimmedStart) ||
		/^subtitle\b/.test(trimmedStart) ||
		/^sidenote\b/.test(trimmedStart)
	);
}

function isGlobalOptionsLine(trimmedStart: string): boolean {
	return /^options\b/.test(trimmedStart);
}

function isPreambleLine(trimmedStart: string): boolean {
	return isDocumentHeaderLine(trimmedStart) || isGlobalOptionsLine(trimmedStart);
}

function isShortTabFile(fileName: string | null | undefined): boolean {
	if (!fileName) {
		return false;
	}
	return fileName.toLowerCase().endsWith('.tab');
}

function isCommentLine(trimmedStart: string): boolean {
	return trimmedStart.startsWith('//') || trimmedStart.startsWith('#');
}

function looksLikeKeyValueSequence(trimmedStart: string): boolean {
	// Example: notation=true tablature=true time=12/8
	return /^[A-Za-z][A-Za-z0-9_-]*\s*=/.test(trimmedStart);
}

function shouldTreatAsTabstaveOptionsLine(trimmedStart: string): boolean {
	if (!looksLikeKeyValueSequence(trimmedStart)) {
		return false;
	}

	// VexTab uses a dedicated tuning directive, do not rewrite it.
	if (trimmedStart.startsWith('tuning=')) {
		return false;
	}

	return true;
}

export function preprocessVexTabSource(
	source: string,
	fileName: string | null | undefined
): PreprocessResult {
	if (!isShortTabFile(fileName)) {
		return { text: source, mapCursor: (cursor) => cursor };
	}

	const originalLines = source.split(/\r?\n/);
	const processedLines: string[] = [];
	const processedLineByOriginalLine: number[] = new Array(originalLines.length);
	const columnDeltaByOriginalLine: number[] = new Array(originalLines.length).fill(0);

	let hasOpenedTabstave = false;

	function shouldOpenTabstaveForEmptyLine(originalLineIndex: number): boolean {
		for (let i = originalLineIndex + 1; i < originalLines.length; i += 1) {
			const nextLine = originalLines[i] ?? '';
			const nextTrimmed = nextLine.trim();
			if (nextTrimmed.length === 0) {
				continue;
			}
			const nextLeadingWhitespace = nextLine.match(/^\s*/)?.[0] ?? '';
			const nextTrimmedStart = nextLine.slice(nextLeadingWhitespace.length);
			if (isCommentLine(nextTrimmedStart)) {
				continue;
			}
			return !isPreambleLine(nextTrimmedStart);
		}
		return true;
	}

	for (let i = 0; i < originalLines.length; i += 1) {
		const originalLine = originalLines[i] ?? '';
		const trimmed = originalLine.trim();
		const leadingWhitespace = originalLine.match(/^\s*/)?.[0] ?? '';
		const trimmedStart = originalLine.slice(leadingWhitespace.length);

		if (trimmed.length === 0) {
			if (hasOpenedTabstave || shouldOpenTabstaveForEmptyLine(i)) {
				processedLines.push('tabstave');
				hasOpenedTabstave = true;
			} else {
				processedLines.push('');
			}
			processedLineByOriginalLine[i] = processedLines.length;
			continue;
		}

		if (isCommentLine(trimmedStart)) {
			processedLines.push(originalLine);
			processedLineByOriginalLine[i] = processedLines.length;
			continue;
		}

		if (isPreambleLine(trimmedStart)) {
			processedLines.push(originalLine);
			processedLineByOriginalLine[i] = processedLines.length;
			continue;
		}

		if (/^tabstave\b/.test(trimmedStart)) {
			hasOpenedTabstave = true;
			processedLines.push(originalLine);
			processedLineByOriginalLine[i] = processedLines.length;
			continue;
		}

		if (shouldTreatAsTabstaveOptionsLine(trimmedStart)) {
			hasOpenedTabstave = true;
			processedLines.push(`${leadingWhitespace}${TABSTAVE_PREFIX}${trimmedStart}`);
			processedLineByOriginalLine[i] = processedLines.length;
			columnDeltaByOriginalLine[i] = TABSTAVE_PREFIX.length;
			continue;
		}

		if (!hasOpenedTabstave) {
			processedLines.push('tabstave');
			hasOpenedTabstave = true;
		}

		processedLines.push(originalLine);
		processedLineByOriginalLine[i] = processedLines.length;
	}

	const processedText = processedLines.join('\n');

	return {
		text: processedText,
		mapCursor: (cursor) => {
			const originalLineIndex = cursor.line - 1;
			if (originalLineIndex < 0 || originalLineIndex >= processedLineByOriginalLine.length) {
				return cursor;
			}
			const mappedLine = processedLineByOriginalLine[originalLineIndex];
			const delta = columnDeltaByOriginalLine[originalLineIndex] ?? 0;
			return { line: mappedLine, column: cursor.column + delta };
		}
	};
}

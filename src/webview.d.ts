declare module 'vextab';

declare function acquireVsCodeApi(): {
	postMessage(message: unknown): void;
};

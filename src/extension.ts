import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

const debounceDelayMs = 200;
const cursorDebounceDelayMs = 50;

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('vextab.preview', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('Open a .vt, .vextab, or .tab file to preview.');
			return;
		}

		const document = editor.document;
		if (!isVexTabDocument(document)) {
			vscode.window.showInformationMessage('Open a .vt, .vextab, or .tab file to preview.');
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'vextabPreview',
			`VexTab Preview: ${document.fileName}`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
			}
		);

		panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
		sendFont(panel, context.extensionUri);
		sendUpdate(panel, document);
		sendCursor(panel, editor);

		let timeout: NodeJS.Timeout | undefined;
		let cursorTimeout: NodeJS.Timeout | undefined;
		const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() !== document.uri.toString()) {
				return;
			}

			if (timeout) {
				clearTimeout(timeout);
			}

			timeout = setTimeout(() => {
				sendUpdate(panel, event.document);
			}, debounceDelayMs);
		});

		const selectionSubscription = vscode.window.onDidChangeTextEditorSelection((event) => {
			if (event.textEditor.document.uri.toString() !== document.uri.toString()) {
				return;
			}

			if (cursorTimeout) {
				clearTimeout(cursorTimeout);
			}

			cursorTimeout = setTimeout(() => {
				sendCursor(panel, event.textEditor);
			}, cursorDebounceDelayMs);
		});

		panel.onDidDispose(() => {
			if (timeout) {
				clearTimeout(timeout);
			}
			if (cursorTimeout) {
				clearTimeout(cursorTimeout);
			}
			changeSubscription.dispose();
			selectionSubscription.dispose();
		});
	});

	context.subscriptions.push(disposable);

	const exportDisposable = vscode.commands.registerCommand('vextab.exportPdf', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('Open a .vt, .vextab, or .tab file to export.');
			return;
		}

		const document = editor.document;
		if (!isVexTabDocument(document)) {
			vscode.window.showInformationMessage('Open a .vt, .vextab, or .tab file to export.');
			return;
		}

		await exportPdf(context, document);
	});

	context.subscriptions.push(exportDisposable);
}

function isVexTabDocument(document: vscode.TextDocument): boolean {
	const fileName = document.fileName.toLowerCase();
	return (
		document.languageId === 'vextab' ||
		fileName.endsWith('.vt') ||
		fileName.endsWith('.vextab') ||
		fileName.endsWith('.tab')
	);
}

function sendUpdate(panel: vscode.WebviewPanel, document: vscode.TextDocument): void {
	void panel.webview.postMessage({ type: 'update', text: document.getText(), fileName: document.fileName });
}

function sendCursor(panel: vscode.WebviewPanel, editor: vscode.TextEditor): void {
	const position = editor.selection.active;
	const line = position.line + 1;
	const lineText = editor.document.lineAt(position.line).text;
	const leadingWhitespaceLength = lineText.match(/^\s*/)?.[0]?.length ?? 0;
	const column = Math.max(0, position.character - leadingWhitespaceLength);
	void panel.webview.postMessage({ type: 'cursor', line, column });
}

function sendFont(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
	const fontUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'fonts', 'bravura.woff2')
	);
	void panel.webview.postMessage({ type: 'font', url: fontUri.toString() });
}

type ExportResultMessage =
	| { type: 'exportResult'; ok: true; svg: string }
	| { type: 'exportResult'; ok: false; error: string };

function getDefaultPdfUri(document: vscode.TextDocument): vscode.Uri {
	const parsed = path.parse(document.fileName);
	return vscode.Uri.file(path.join(parsed.dir, `${parsed.name}.pdf`));
}

function parseSvgSizePx(svg: string): { width: number; height: number } | null {
	const viewBoxMatch = svg.match(/\bviewBox="\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"/);
	if (viewBoxMatch) {
		const width = Number(viewBoxMatch[3]);
		const height = Number(viewBoxMatch[4]);
		if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
			return { width, height };
		}
	}

	const widthMatch = svg.match(/\bwidth="\s*([\d.]+)(?:px)?\s*"/);
	const heightMatch = svg.match(/\bheight="\s*([\d.]+)(?:px)?\s*"/);
	if (widthMatch && heightMatch) {
		const width = Number(widthMatch[1]);
		const height = Number(heightMatch[1]);
		if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
			return { width, height };
		}
	}

	return null;
}

async function writePdfFromSvg(svg: string, targetUri: vscode.Uri): Promise<void> {
	const pxToPt = 72 / 96;
	const sizePx = parseSvgSizePx(svg);
	const widthPt = sizePx ? sizePx.width * pxToPt : 595.28;
	const heightPt = sizePx ? sizePx.height * pxToPt : 841.89;

	await new Promise<void>((resolve, reject) => {
		const doc = new PDFDocument({ autoFirstPage: false });
		const stream = fs.createWriteStream(targetUri.fsPath);

		doc.on('error', reject);
		stream.on('error', reject);
		stream.on('finish', () => resolve());

		doc.pipe(stream);
		doc.addPage({ size: [widthPt, heightPt], margin: 0 });
		SVGtoPDF(doc as unknown as any, svg, 0, 0);
		doc.end();
	});
}

async function exportPdf(context: vscode.ExtensionContext, document: vscode.TextDocument): Promise<void> {
	const saveUri = await vscode.window.showSaveDialog({
		filters: { PDF: ['pdf'] },
		defaultUri: getDefaultPdfUri(document)
	});
	if (!saveUri) {
		return;
	}

	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Exporting VexTab to PDF' },
		async () => {
			const panel = vscode.window.createWebviewPanel(
				'vextabExport',
				`VexTab Export: ${document.fileName}`,
				{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
				}
			);

			try {
				panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

				const fontUri = panel.webview.asWebviewUri(
					vscode.Uri.joinPath(context.extensionUri, 'dist', 'fonts', 'bravura.woff2')
				);

				const svg = await new Promise<string>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error('Timed out while generating SVG.'));
					}, 15_000);

					const disposable = panel.webview.onDidReceiveMessage((message: ExportResultMessage) => {
						if (!message || message.type !== 'exportResult') {
							return;
						}
						clearTimeout(timeout);
						disposable.dispose();
						if (message.ok) {
							resolve(message.svg);
						} else {
							reject(new Error(message.error));
						}
					});

					void panel.webview.postMessage({
						type: 'export',
						format: 'svg',
						text: document.getText(),
						fileName: document.fileName,
						fontUrl: fontUri.toString()
					});
				});

				await writePdfFromSvg(svg, saveUri);
				vscode.window.showInformationMessage(`Exported PDF: ${saveUri.fsPath}`);
			} finally {
				panel.dispose();
			}
		}
	);
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>VexTab Preview</title>
	<style>
		body {
			font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
			margin: 0;
			padding: 16px;
			background: #f7f2e9;
			color: #2d2a24;
		}
		#error {
			margin-bottom: 12px;
			padding: 8px 12px;
			border-radius: 6px;
			background: #fff2f2;
			color: #8d2a2a;
			border: 1px solid #e2b8b8;
			white-space: pre-wrap;
		}
		#error[hidden] {
			display: none;
		}
		#score {
			overflow-x: auto;
		}
	</style>
</head>
<body>
	<div id="error" hidden></div>
	<div id="score"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function deactivate() {}

export type MarpPreviewViewTestAccess = {
	applyPreviewZoom(): void;
	loadPreviewSrcdoc(html: string): Promise<void>;
	renderPreviewDocument(html: string): Promise<void>;
	previewContainerEl: HTMLElement | undefined;
	previewIframeEl: HTMLIFrameElement | undefined;
};

export function marpPreviewViewTestAccess(view: unknown): MarpPreviewViewTestAccess {
	// Private methods are intentionally exercised in jsdom preview tests only.
	return view as MarpPreviewViewTestAccess;
}
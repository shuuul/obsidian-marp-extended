import type { Marp } from '@marp-team/marp-core';

export type MarpPreviewViewTestAccess = {
	applyPreviewZoom(): void;
	applyPreviewState(): void;
	commitPreviewRender(revision: number, html: string, comments: string[][]): Promise<void>;
	createMarp(): Marp;
	initializePreviewState(comments: string[][]): void;
	loadPreviewSrcdoc(html: string): Promise<void>;
	registerPreviewScrollTracking(): void;
	renderPreviewDocument(html: string): Promise<void>;
	activeSlideIndex: number;
	displaySlidesRevision: number;
	fragmentRevealCounts: number[];
	fragmentTotals: number[];
	fragmentStatusEl: HTMLElement | undefined;
	presenterComments: string[][];
	presenterNotesEl: HTMLElement | undefined;
	previewSlideEls: HTMLElement[];
	previewContainerEl: HTMLElement | undefined;
	previewIframeEl: HTMLIFrameElement | undefined;
};

export function marpPreviewViewTestAccess(view: unknown): MarpPreviewViewTestAccess {
	// Private methods are intentionally exercised in jsdom preview tests only.
	return view as MarpPreviewViewTestAccess;
}

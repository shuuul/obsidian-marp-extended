import type { Marp } from '@marp-team/marp-core';
import type { MarkdownView, TFile } from 'obsidian';

export type MarpPreviewViewTestAccess = {
	applyPreviewZoom(): void;
	applyPreviewState(): void;
	commitPreviewRender(revision: number, html: string, comments: string[][]): Promise<void>;
	createMarp(): Marp;
	exportFile(type: string): Promise<void>;
	initializePreviewState(comments: string[][]): void;
	invalidatePreviewCaches(): void;
	loadPreviewSrcdoc(html: string): Promise<void>;
	openInternalPreviewLink(linkpath: string, newLeaf: boolean): boolean;
	registerPreviewIframeLinkHandler(): void;
	registerPreviewScrollTracking(): void;
	renderPreviewDocument(html: string): Promise<void>;
	activeSlideIndex: number;
	displaySlidesRevision: number;
	file: TFile | null;
	sourceView: MarkdownView | undefined;
	fragmentRevealCounts: number[];
	fragmentTotals: number[];
	presenterComments: string[][];
	presenterNotesEl: HTMLElement | undefined;
	presenterNotesBodyEl: HTMLElement | undefined;
	presenterNotesResizeEl: HTMLElement | undefined;
	presenterNotesHeight: number | undefined;
	registerPresenterNotesResize(): void;
	applyPresenterNotesHeight(): void;
	previewSlideEls: HTMLElement[];
	previewContainerEl: HTMLElement | undefined;
	previewIframeEl: HTMLIFrameElement | undefined;
};

export function marpPreviewViewTestAccess(view: unknown): MarpPreviewViewTestAccess {
	// Private methods are intentionally exercised in jsdom preview tests only.
	return view as MarpPreviewViewTestAccess;
}

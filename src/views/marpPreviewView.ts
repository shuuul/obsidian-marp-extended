import { ItemView, setIcon, type WorkspaceLeaf, type MarkdownView, type TFile } from 'obsidian';
import type { Marp } from '@marp-team/marp-core'
import { browser, type MarpCoreBrowser } from '@marp-team/marp-core/browser'

import type { MarpExtendedSettings } from '../utilities/settings'
import { FilePath } from '../utilities/filePath'
import { ThemeManager } from '../utilities/themeManager';
import { createMarpEngine } from '../runtime/marpEngine';
import { compileMarkdownForMarp } from '../utilities/marpMarkdown';
import { loadMermaidThemeCssForFile, parseMermaidRenderOptionsFromCss } from '../utilities/mermaidTheme';
import { BUILTIN_THEME_SCALE_CSS } from '../utilities/builtinThemeScale';
import { ThemeAssetCache } from '../utilities/themeAssetCache';
import { exportWithNotice } from '../utilities/marpExport';
import { MARP_EXTENDED_STRUCTURAL_CSS } from '../utilities/marpExtendedStructuralCss';
import {
    PREVIEW_ZOOM_RESET,
    clampPreviewZoom,
    formatPreviewZoom,
    getPreviewZoomFitScale,
    isPreviewZoomWheel,
    zoomPreviewByStep,
    zoomPreviewFromWheel,
} from '../utilities/previewZoom'

export const MARP_PREVIEW_VIEW = 'marp-preview-view';
const PREVIEW_PROFILE_STORAGE_KEY = 'marp-extended-profile';
let marpBrowserPolyfillReady = false;
const PREVIEW_IFRAME_STYLE = `
html,
body {
	background: transparent;
	height: 100%;
	margin: 0;
	min-height: 0;
	overflow: hidden;
	padding: 0;
	width: 100%;
}
#__marp-vscode {
	transform: scale(var(--marp-extended-preview-zoom, 1));
	transform-origin: top left;
	width: max-content;
}
#__marp-vscode > [data-marp-vscode-slide-wrapper] {
	display: block;
}
#__marp-vscode > [data-marp-vscode-slide-wrapper] > svg {
	display: block;
	height: 100%;
	width: 100%;
}
[data-marpit-fragment] { visibility: hidden; }
[data-marpit-fragment][data-marp-extended-revealed="true"] { visibility: visible; }
section .mermaid-diagram-container.mermaid-diagram {
	align-items: center;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 0.35em;
	justify-content: center;
	margin: 0.5rem auto 0;
	max-width: 100%;
	width: fit-content;
}
section .mermaid-diagram-container.mermaid-diagram[data-mermaid-renderer="mermaid"] {
	overflow: hidden;
	width: 100%;
}
section .mermaid-diagram-container.mermaid-diagram img,
section .mermaid-diagram-container.mermaid-diagram svg,
section .mermaid-diagram-container.mermaid-diagram embed {
	display: block;
	height: auto;
	max-height: min(70vh, 640px);
	max-width: 100%;
	width: auto;
}
section .mermaid-diagram-container.mermaid-diagram[data-mermaid-renderer="beautiful-mermaid"] svg path,
section .mermaid-diagram-container.mermaid-diagram[data-mermaid-renderer="beautiful-mermaid"] svg circle,
section .mermaid-diagram-container.mermaid-diagram[data-mermaid-renderer="beautiful-mermaid"] svg ellipse,
section .mermaid-diagram-container.mermaid-diagram[data-mermaid-renderer="beautiful-mermaid"] svg rect,
section .mermaid-diagram-container.mermaid-diagram[data-mermaid-renderer="beautiful-mermaid"] svg polygon {
	stroke-width: 2px;
}
section .mermaid-diagram-container.mermaid-diagram svg text {
	font-weight: 600;
}
section .mermaid-diagram-container.mermaid-diagram figcaption {
	color: currentColor;
	font-size: 0.65em;
	line-height: 1.3;
	opacity: 0.72;
	text-align: center;
}
`;

export class MarpPreviewView extends ItemView  {
    private marpBrowser: MarpCoreBrowser | undefined;
    private previewContainerEl: HTMLElement | undefined;
    private previewIframeEl: HTMLIFrameElement | undefined;
    private previewSlideEls: HTMLElement[] = [];
    private previewMaxSlideWidth = 0;
    private previewResizeObserver: ResizeObserver | undefined;
    private previewIframeZoomDetach: (() => void) | undefined;
    private previewZoom = PREVIEW_ZOOM_RESET;
    private previewZoomFitScale = PREVIEW_ZOOM_RESET;
    private zoomLabelEl: HTMLElement | undefined;
    private syncPreviewButtonEl: HTMLButtonElement | undefined;
    private syncPreviewEnabled = true;
    private activeSlideIndex = 0;
    private fragmentRevealCounts: number[] = [];
    private fragmentTotals: number[] = [];
    private presenterComments: string[][] = [];
    private presenterNotesVisible = false;
    private fragmentPreviousButtonEl: HTMLButtonElement | undefined;
    private fragmentNextButtonEl: HTMLButtonElement | undefined;
    private fragmentResetButtonEl: HTMLButtonElement | undefined;
    private fragmentStatusEl: HTMLElement | undefined;
    private notesToggleButtonEl: HTMLButtonElement | undefined;
    private presenterNotesEl: HTMLElement | undefined;
    private previewScrollDetach: (() => void) | undefined;
    private previewScrollFrame: number | undefined;
    private previewCommitQueue: Promise<void> = Promise.resolve();
    private displaySlidesRevision = 0;
    private previewProfileMeasureCounter = 0;
    private themeAssetCache: ThemeAssetCache;
    private settings : MarpExtendedSettings;
    private pluginDir: string | undefined;

    private file : TFile | null = null;

    constructor(settings: MarpExtendedSettings, leaf: WorkspaceLeaf, pluginDir?: string) {
        super(leaf);

        this.settings = settings;
        this.pluginDir = pluginDir;
        this.themeAssetCache = new ThemeAssetCache(this.app);
    }

    private createMarp(): Marp {
        return createMarpEngine({
            container: { tag: 'div', id: '__marp-vscode' },
            slideContainer: { tag: 'div', 'data-marp-vscode-slide-wrapper': '' },
        });
    }

    private async loadThemeCss(): Promise<string[]> {
        const themeManager = new ThemeManager(this.app);
        return themeManager.loadThemeCss();
    }

    getViewType() {
        return MARP_PREVIEW_VIEW;
    }

    getDisplayText() {
        return 'Deck preview';
    }

    getIcon() {
        return 'slides-preview-marp';
    }

    async onOpen() {
        // console.log("marp slide onopen");

        this.contentEl.empty();
        this.contentEl.addClass('marp-extended-preview-root');
        this.addPreviewToolbar(this.contentEl);
        this.previewContainerEl = this.contentEl.createDiv({ cls: 'marp-extended-preview-content' });
        this.previewIframeEl = this.previewContainerEl.createEl('iframe', {
            cls: 'marp-extended-preview-iframe',
            attr: {
                title: 'Marp slide preview',
                sandbox: 'allow-same-origin',
            },
        });
        this.presenterNotesEl = this.contentEl.createDiv({ cls: 'marp-extended-presenter-notes' });
        this.presenterNotesEl.id = 'marp-extended-presenter-notes';
        this.presenterNotesEl.setAttribute('role', 'region');
        this.presenterNotesEl.setAttribute('aria-label', 'Presenter notes');
        this.registerPreviewScrollTracking();
        this.registerPreviewZoomGesture();
        this.registerPreviewZoomResizeObserver();

        this.addActions();
    }

    async onClose() {
        this.displaySlidesRevision += 1;
        this.previewResizeObserver?.disconnect();
        this.previewResizeObserver = undefined;
        if (this.previewZoomApplyFrame !== undefined) {
            window.cancelAnimationFrame(this.previewZoomApplyFrame);
            this.previewZoomApplyFrame = undefined;
        }
        this.previewIframeZoomDetach?.();
        this.previewIframeZoomDetach = undefined;
        this.previewScrollDetach?.();
        this.previewScrollDetach = undefined;
        if (this.previewScrollFrame !== undefined) window.cancelAnimationFrame(this.previewScrollFrame);
        this.previewScrollFrame = undefined;
        this.previewSlideEls = [];
        this.previewMaxSlideWidth = 0;
        marpBrowserPolyfillReady = false;
        this.marpBrowser = undefined;
        this.previewIframeEl = undefined;
    }

    async onChange(view : MarkdownView) {
        void this.displaySlides(view);
    }

    onLineChanged(slideIndex: number): void {
        const targetSlideIndex = Math.max(0, slideIndex);
        const slide = this.previewSlideEls[targetSlideIndex];

        if (!slide) {
            return;
        }

        this.activeSlideIndex = targetSlideIndex;
        this.applyPreviewState();
        slide.scrollIntoView({ block: 'start', inline: 'nearest' });
	}

    nextFragment(): void {
        const total = this.fragmentTotals[this.activeSlideIndex] ?? 0;
        const count = this.fragmentRevealCounts[this.activeSlideIndex] ?? 0;
        if (count >= total) return;
        this.fragmentRevealCounts[this.activeSlideIndex] = count + 1;
        this.applyPreviewState();
    }

    previousFragment(): void {
        const count = this.fragmentRevealCounts[this.activeSlideIndex] ?? 0;
        if (count <= 0) return;
        this.fragmentRevealCounts[this.activeSlideIndex] = count - 1;
        this.applyPreviewState();
    }

    resetActiveSlideFragments(): void {
        if ((this.fragmentRevealCounts[this.activeSlideIndex] ?? 0) === 0) return;
        this.fragmentRevealCounts[this.activeSlideIndex] = 0;
        this.applyPreviewState();
    }

    togglePresenterNotes(): void {
        this.presenterNotesVisible = !this.presenterNotesVisible;
        this.applyPreviewState();
    }

    isSyncPreviewEnabled() {
        return this.syncPreviewEnabled;
    }

    isDisplayingFile(file: TFile) {
        return this.file?.path === file.path;
    }

    addPreviewToolbar(container: HTMLElement) {
        const toolbar = container.createDiv({ cls: 'marp-extended-preview-toolbar' });
        this.addSyncPreviewToolbarButton(toolbar);
        this.addFragmentToolbarControls(toolbar);
        this.addZoomToolbarControls(toolbar);
        this.addPreviewToolbarButton(toolbar, 'code-glyph', 'Export as HTML', 'html');
        this.addPreviewToolbarButton(toolbar, 'slides-marp-export-pdf', 'Export as PDF', 'pdf');
        this.addPreviewToolbarButton(toolbar, 'slides-marp-export-pptx', 'Export as PPTX', 'pptx');
        this.addPreviewToolbarButton(toolbar, 'slides-marp-slide-present', 'Preview slides', 'preview');
    }

    private addFragmentToolbarControls(toolbar: HTMLElement): void {
        const controls = toolbar.createDiv({ cls: 'marp-extended-preview-fragment-controls' });
        const addButton = (label: string, text: string, action: () => void) => {
            const element = controls.createEl('button', { cls: 'marp-extended-preview-toolbar-button', text,
                attr: { type: 'button', title: label, 'aria-label': label } });
            this.registerDomEvent(element, 'click', action);
            return element;
        };
        this.fragmentPreviousButtonEl = addButton('Previous fragment', '‹', () => this.previousFragment());
        this.fragmentNextButtonEl = addButton('Next fragment', '›', () => this.nextFragment());
        this.fragmentResetButtonEl = addButton('Reset fragments', '↺', () => this.resetActiveSlideFragments());
        this.fragmentStatusEl = controls.createSpan({ cls: 'marp-extended-preview-fragment-status' });
        this.fragmentStatusEl.setAttribute('aria-live', 'polite');
        this.notesToggleButtonEl = addButton('Toggle presenter notes', 'Notes', () => this.togglePresenterNotes());
        this.notesToggleButtonEl.setAttribute('aria-controls', 'marp-extended-presenter-notes');
        this.applyPreviewState();
    }

    private addSyncPreviewToolbarButton(toolbar: HTMLElement) {
        this.syncPreviewButtonEl = toolbar.createEl('button', {
            cls: 'marp-extended-preview-toolbar-button marp-extended-preview-sync-button',
            attr: {
                type: 'button',
            },
        });
        this.syncPreviewButtonEl.addEventListener('click', () => {
            this.syncPreviewEnabled = !this.syncPreviewEnabled;
            this.updateSyncPreviewToolbarButton();
        });
        this.updateSyncPreviewToolbarButton();
    }

    private addZoomToolbarControls(toolbar: HTMLElement): void {
        const zoomControls = toolbar.createDiv({ cls: 'marp-extended-preview-zoom-controls' });
        const zoomOutButton = zoomControls.createEl('button', {
            cls: 'marp-extended-preview-toolbar-button',
            text: '−',
            attr: {
                'aria-label': 'Zoom out',
                title: 'Zoom out',
                type: 'button',
            },
        });
        this.registerDomEvent(zoomOutButton, 'click', () => {
            this.setPreviewZoom(zoomPreviewByStep(this.previewZoom, -1));
        });

        this.zoomLabelEl = zoomControls.createSpan({
            cls: 'marp-extended-preview-zoom-label',
            text: formatPreviewZoom(this.previewZoom),
        });
        this.zoomLabelEl.setAttribute('aria-live', 'polite');

        const zoomInButton = zoomControls.createEl('button', {
            cls: 'marp-extended-preview-toolbar-button',
            text: '+',
            attr: {
                'aria-label': 'Zoom in',
                title: 'Zoom in',
                type: 'button',
            },
        });
        this.registerDomEvent(zoomInButton, 'click', () => {
            this.setPreviewZoom(zoomPreviewByStep(this.previewZoom, 1));
        });

        const fitWidthButton = zoomControls.createEl('button', {
            cls: 'marp-extended-preview-toolbar-button marp-extended-preview-fit-width-button',
            attr: {
                'aria-label': 'Fit to width',
                title: 'Fit to width',
                type: 'button',
            },
        });
        setIcon(fitWidthButton, 'slides-marp-fit-width');
        this.registerDomEvent(fitWidthButton, 'click', () => {
            this.setPreviewZoom(PREVIEW_ZOOM_RESET);
        });

        this.applyPreviewZoom();
    }

    private updateSyncPreviewToolbarButton() {
        if (!this.syncPreviewButtonEl) {
            return;
        }

        const title = this.syncPreviewEnabled ? 'Sync preview: on' : 'Sync preview: off';
        this.syncPreviewButtonEl.empty();
        this.syncPreviewButtonEl.classList.toggle('is-enabled', this.syncPreviewEnabled);
        this.syncPreviewButtonEl.setAttribute('aria-label', title);
        this.syncPreviewButtonEl.setAttribute('aria-pressed', String(this.syncPreviewEnabled));
        this.syncPreviewButtonEl.setAttribute('title', title);
        setIcon(this.syncPreviewButtonEl, this.syncPreviewEnabled ? 'link' : 'unlink');
        this.syncPreviewButtonEl.createSpan({
            cls: 'marp-extended-preview-toolbar-button-label',
            text: this.syncPreviewEnabled ? 'Sync on' : 'Sync off',
        });
    }

    private addPreviewToolbarButton(toolbar: HTMLElement, icon: string, title: string, type: string) {
        const button = toolbar.createEl('button', {
            cls: 'marp-extended-preview-toolbar-button',
            attr: {
                'aria-label': title,
                title,
                type: 'button',
            },
        });
        setIcon(button, icon);
        button.addEventListener('click', () => {
            void this.exportFile(type);
        });
    }

    private applyPreviewZoom(): void {
        if (this.previewContainerEl) {
            this.updatePreviewSlideLayout();

            const availableWidth = this.previewContainerEl.clientWidth;
            const hasLayout = availableWidth > 0 && this.previewMaxSlideWidth > 0;
            if (hasLayout) {
                this.previewZoomFitScale = getPreviewZoomFitScale(availableWidth, this.previewMaxSlideWidth);
            }
            const effectiveZoom = this.previewZoom * this.previewZoomFitScale;
            this.previewContainerEl.style.setProperty('--marp-extended-preview-zoom', String(effectiveZoom));
            this.getPreviewDocument()?.documentElement?.style.setProperty(
                '--marp-extended-preview-zoom',
                String(effectiveZoom),
            );

            if (hasLayout) {
                this.syncPreviewIframeSize(effectiveZoom);
            } else {
                this.schedulePreviewZoomApply();
            }
        }

        if (!this.zoomLabelEl) {
            return;
        }

        const formattedZoom = formatPreviewZoom(this.previewZoom);
        this.zoomLabelEl.setText(formattedZoom);
        this.zoomLabelEl.setAttribute('aria-label', `Preview zoom ${formattedZoom}`);
    }

    private previewZoomApplyFrame: number | undefined;

    private schedulePreviewZoomApply(): void {
        if (this.previewZoomApplyFrame !== undefined) {
            return;
        }
        this.previewZoomApplyFrame = window.requestAnimationFrame(() => {
            this.previewZoomApplyFrame = undefined;
            this.applyPreviewZoom();
        });
    }


    private getPreviewDocument(): Document | null {
        return this.previewIframeEl?.contentDocument ?? null;
    }

    private ensureMarpBrowser(doc: Document): void {
        if (this.marpBrowser) {
            this.marpBrowser.update();
            return;
        }

        if (marpBrowserPolyfillReady) {
            return;
        }

        try {
            this.marpBrowser = browser(doc);
            marpBrowserPolyfillReady = true;
        } catch (error) {
            // marp-core registers its custom elements on the host window's
            // registry, which survives plugin reloads and rejects re-definition.
            // The polyfill is not load-bearing for the iframe preview (sizing is
            // driven by applyPreviewZoom), so suppress the error to keep the
            // render and zoom path running.
            console.warn('Marp Core browser polyfill skipped:', error);
            marpBrowserPolyfillReady = true;
        }
    }

    private async renderPreviewDocument(html: string): Promise<void> {
        const iframe = this.previewIframeEl;
        if (!iframe) {
            return;
        }

        const doc = iframe.contentDocument;
        if (!doc?.getElementById('__marp-vscode')) {
            await this.loadPreviewSrcdoc(html);
            const loadedDoc = iframe.contentDocument;
            if (!loadedDoc) {
                throw new Error('Preview iframe document is unavailable.');
            }
            this.ensureMarpBrowser(loadedDoc);
            return;
        }

        const parsed = new DOMParser().parseFromString(html, 'text/html');
        doc.head.replaceChildren(
            ...Array.from(parsed.head.childNodes, (node) => node.cloneNode(true)),
        );
        doc.body.replaceChildren(
            ...Array.from(parsed.body.childNodes, (node) => node.cloneNode(true)),
        );
        this.ensureMarpBrowser(doc);
    }

    private loadPreviewSrcdoc(html: string): Promise<void> {
        const iframe = this.previewIframeEl;
        if (!iframe) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            const onLoad = () => {
                iframe.removeEventListener('error', onError);
                this.registerPreviewIframeZoomGesture();
                resolve();
            };
            const onError = () => {
                iframe.removeEventListener('load', onLoad);
                reject(new Error('Preview iframe failed to load'));
            };

            iframe.addEventListener('load', onLoad, { once: true });
            iframe.addEventListener('error', onError, { once: true });
            iframe.srcdoc = html;
        });
    }

    private commitPreviewRender(revision: number, html: string, comments: string[][]): Promise<void> {
        const commit = this.previewCommitQueue.catch(() => undefined).then(async () => {
            if (revision !== this.displaySlidesRevision) return;
            await this.measurePreviewStepAsync('renderPreviewDocument', () => this.renderPreviewDocument(html));
            if (revision !== this.displaySlidesRevision) return;
            this.measurePreviewStep('applyPreviewZoom', () => this.applyPreviewZoom());
            if (revision !== this.displaySlidesRevision) return;
            this.initializePreviewState(comments);
        });
        this.previewCommitQueue = commit.catch(() => undefined);
        return commit;
    }

    private syncPreviewIframeSize(effectiveZoom: number): void {
        const iframe = this.previewIframeEl;
        const marpRoot = this.getPreviewDocument()?.getElementById('__marp-vscode');
        if (!iframe || !marpRoot) {
            return;
        }

        const unzoomedWidth = this.previewMaxSlideWidth > 0
            ? this.previewMaxSlideWidth
            : marpRoot.scrollWidth;
        iframe.style.width = `${Math.ceil(unzoomedWidth * effectiveZoom)}px`;
        iframe.style.height = `${Math.ceil(marpRoot.scrollHeight * effectiveZoom)}px`;
    }

    private updatePreviewSlideLayout(): void {
        this.previewSlideEls = [];
        this.previewMaxSlideWidth = 0;

        const previewDocument = this.getPreviewDocument();
        if (!previewDocument) {
            return;
        }

        this.previewSlideEls = Array.from(
            previewDocument.querySelectorAll<HTMLElement>('[data-marp-vscode-slide-wrapper]'),
        );
        this.previewSlideEls.forEach((wrapper) => {
            const viewBox = wrapper.querySelector('svg')?.getAttribute('viewBox');
            const dimensions = viewBox?.trim().split(/\s+/).map(Number);
            if (
                dimensions?.length === 4
                && Number.isFinite(dimensions[2])
                && Number.isFinite(dimensions[3])
                && dimensions[2] > 0
                && dimensions[3] > 0
            ) {
                wrapper.style.width = `${dimensions[2]}px`;
                wrapper.style.height = `${dimensions[3]}px`;
                this.previewMaxSlideWidth = Math.max(this.previewMaxSlideWidth, dimensions[2]);
            }
        });
    }

    private initializePreviewState(comments: string[][]): void {
        this.activeSlideIndex = Math.min(this.activeSlideIndex, Math.max(0, this.previewSlideEls.length - 1));
        this.fragmentTotals = this.previewSlideEls.map((wrapper) => {
            const values = Array.from(wrapper.querySelectorAll<HTMLElement>('[data-marpit-fragment]'))
                .map((fragment) => Number(fragment.dataset.marpitFragment))
                .filter((value) => Number.isFinite(value) && value > 0);
            return values.length === 0 ? 0 : Math.max(...values);
        });
        this.fragmentRevealCounts = this.fragmentTotals.map(() => 0);
        this.presenterComments = this.previewSlideEls.map((_, index) => comments[index] ?? []);
        this.applyPreviewState();
    }

    private applyPreviewState(): void {
        this.previewSlideEls.forEach((wrapper, slideIndex) => {
            const revealCount = this.fragmentRevealCounts[slideIndex] ?? 0;
            wrapper.querySelectorAll<HTMLElement>('[data-marpit-fragment]').forEach((fragment) => {
                const revealed = Number(fragment.dataset.marpitFragment) <= revealCount;
                fragment.dataset.marpExtendedRevealed = String(revealed);
                fragment.setAttribute('aria-hidden', String(!revealed));
            });
        });
        const total = this.fragmentTotals[this.activeSlideIndex] ?? 0;
        const count = this.fragmentRevealCounts[this.activeSlideIndex] ?? 0;
        if (this.fragmentStatusEl) this.fragmentStatusEl.textContent = `Fragment ${count} of ${total}`;
        if (this.fragmentPreviousButtonEl) this.fragmentPreviousButtonEl.disabled = count === 0;
        if (this.fragmentResetButtonEl) this.fragmentResetButtonEl.disabled = count === 0;
        if (this.fragmentNextButtonEl) this.fragmentNextButtonEl.disabled = count >= total;
        this.notesToggleButtonEl?.setAttribute('aria-expanded', String(this.presenterNotesVisible));
        this.notesToggleButtonEl?.setAttribute('aria-pressed', String(this.presenterNotesVisible));
        if (this.presenterNotesEl) {
            this.presenterNotesEl.hidden = !this.presenterNotesVisible;
            this.presenterNotesEl.replaceChildren();
            const comments = this.presenterComments[this.activeSlideIndex] ?? [];
            if (comments.length === 0) {
                this.presenterNotesEl.createDiv({ text: 'No presenter notes for this slide.' });
            } else {
                const list = this.presenterNotesEl.createEl('ol');
                comments.forEach((comment) => {
                    list.createEl('li', { text: comment });
                });
            }
        }
    }

    private registerPreviewScrollTracking(): void {
        const container = this.previewContainerEl;
        if (!container) return;
        const onScroll = () => {
            if (this.previewScrollFrame !== undefined) return;
            this.previewScrollFrame = window.requestAnimationFrame(() => {
                this.previewScrollFrame = undefined;
                const containerTop = container.getBoundingClientRect().top;
                const iframeTop = this.previewIframeEl?.getBoundingClientRect().top ?? containerTop;
                let nearest = 0;
                let distance = Infinity;
                this.previewSlideEls.forEach((slide, index) => {
                    const nextDistance = Math.abs(iframeTop + slide.getBoundingClientRect().top - containerTop);
                    if (nextDistance < distance) { distance = nextDistance; nearest = index; }
                });
                if (this.previewSlideEls.length > 0 && nearest !== this.activeSlideIndex) {
                    this.activeSlideIndex = nearest;
                    this.applyPreviewState();
                }
            });
        };
        container.addEventListener('scroll', onScroll, { passive: true });
        this.previewScrollDetach = () => container.removeEventListener('scroll', onScroll);
    }

    private isPreviewProfilingEnabled(): boolean {
        try {
            return typeof window !== 'undefined'
                && window.localStorage?.getItem(PREVIEW_PROFILE_STORAGE_KEY) === '1'
                && typeof performance !== 'undefined';
        } catch {
            return false;
        }
    }

    private startPreviewMeasure(name: string): string | null {
        if (!this.isPreviewProfilingEnabled()) {
            return null;
        }

        const startMark = `marp-extended:preview:${name}:start:${++this.previewProfileMeasureCounter}`;
        performance.mark(startMark);
        return startMark;
    }

    private endPreviewMeasure(name: string, startMark: string | null): void {
        if (!startMark) {
            return;
        }

        const endMark = startMark.replace(':start:', ':end:');
        try {
            performance.mark(endMark);
            performance.measure(`marp-extended:preview:${name}`, startMark, endMark);
        } finally {
            performance.clearMarks(startMark);
            performance.clearMarks(endMark);
        }
    }

    private measurePreviewStep<T>(name: string, callback: () => T): T {
        const startMark = this.startPreviewMeasure(name);
        try {
            return callback();
        } finally {
            this.endPreviewMeasure(name, startMark);
        }
    }

    private async measurePreviewStepAsync<T>(name: string, callback: () => Promise<T>): Promise<T> {
        const startMark = this.startPreviewMeasure(name);
        try {
            return await callback();
        } finally {
            this.endPreviewMeasure(name, startMark);
        }
    }

    private setPreviewZoom(nextZoom: number, anchor?: { clientX: number; clientY: number }): void {
        const previousZoom = this.previewZoom;
        const previousEffectiveZoom = previousZoom * this.previewZoomFitScale;
        const normalizedZoom = clampPreviewZoom(nextZoom);
        if (normalizedZoom === previousZoom) {
            return;
        }

        let anchoredScroll: {
            container: HTMLElement;
            anchorX: number;
            anchorY: number;
            contentX: number;
            contentY: number;
        } | undefined;
        if (anchor && this.previewContainerEl) {
            const container = this.previewContainerEl;
            const rect = container.getBoundingClientRect();
            const anchorX = anchor.clientX - rect.left;
            const anchorY = anchor.clientY - rect.top;
            anchoredScroll = {
                container,
                anchorX,
                anchorY,
                contentX: container.scrollLeft + anchorX,
                contentY: container.scrollTop + anchorY,
            };
        }

        this.previewZoom = normalizedZoom;
        this.applyPreviewZoom();

        if (anchoredScroll) {
            const effectiveZoom = normalizedZoom * this.previewZoomFitScale;
            const ratio = effectiveZoom / previousEffectiveZoom;
            anchoredScroll.container.scrollLeft = anchoredScroll.contentX * ratio - anchoredScroll.anchorX;
            anchoredScroll.container.scrollTop = anchoredScroll.contentY * ratio - anchoredScroll.anchorY;
        }
    }

    private registerPreviewZoomGesture(): void {
        if (!this.previewContainerEl) {
            return;
        }

        this.registerDomEvent(this.previewContainerEl, 'wheel', (event) => {
            if (!isPreviewZoomWheel(event)) {
                return;
            }

            event.preventDefault();
            this.setPreviewZoom(zoomPreviewFromWheel(this.previewZoom, event.deltaY), event);
        }, { passive: false });
    }

    private registerPreviewIframeZoomGesture(): void {
        const iframe = this.previewIframeEl;
        const contentWindow = iframe?.contentWindow;
        if (!iframe || !contentWindow) {
            return;
        }

        this.previewIframeZoomDetach?.();
        this.previewIframeZoomDetach = undefined;

        const handleWheel = (event: WheelEvent) => {
            if (!isPreviewZoomWheel(event)) {
                return;
            }

            event.preventDefault();
            const rect = iframe.getBoundingClientRect();
            this.setPreviewZoom(
                zoomPreviewFromWheel(this.previewZoom, event.deltaY),
                { clientX: rect.left + event.clientX, clientY: rect.top + event.clientY },
            );
        };
        const options: AddEventListenerOptions = { passive: false };
        contentWindow.addEventListener('wheel', handleWheel, options);
        this.previewIframeZoomDetach = () => {
            contentWindow.removeEventListener('wheel', handleWheel, options);
        };
    }

    private registerPreviewZoomResizeObserver(): void {
        if (!this.previewContainerEl || typeof ResizeObserver === 'undefined') {
            return;
        }

        this.previewResizeObserver?.disconnect();
        this.previewResizeObserver = new ResizeObserver(() => {
            this.schedulePreviewZoomApply();
        });
        this.previewResizeObserver.observe(this.previewContainerEl);
    }

    addActions() {
        this.addAction('code-glyph', 'Export as HTML', () => {
            void this.exportFile('html');
        });

        this.addAction('slides-marp-export-pdf', 'Export as PDF', () => {
            void this.exportFile('pdf');
        });

        this.addAction('slides-marp-export-pptx', 'Export as PPTX', () => {
            void this.exportFile('pptx');
        });

        this.addAction('slides-marp-slide-present', 'Preview slides', () => {
            void this.exportFile('preview');
        });
      }

    private async exportFile(type: string) {
        const file = this.file ?? this.app.workspace.getActiveFile();
        await exportWithNotice(this.settings, this.app, type, file, this.pluginDir);
    }
    
    async displaySlides(view : MarkdownView, markdownOverride?: string) {
        const sourceFile = view.file;
        if (!sourceFile) {
            return;
        }

        const displayRevision = ++this.displaySlidesRevision;
        const displayStartMark = this.startPreviewMeasure('displaySlides');
        this.file = sourceFile;
        try {
            const filePath = new FilePath(this.settings);
            const previewBaseUrl = filePath.getPreviewBaseUrl(sourceFile);
            const markdownText = markdownOverride ?? view.getViewData();
            const themeCss = await this.measurePreviewStepAsync('loadThemeCss', () => this.loadThemeCss());
            if (displayRevision !== this.displaySlidesRevision) {
                return;
            }
            const marp = this.createMarp();
            themeCss.forEach((content) => {
                marp.themeSet.add(content);
            });
            const mermaidThemeCss = await this.measurePreviewStepAsync('loadMermaidThemeCss', () => (
                loadMermaidThemeCssForFile(this.app, sourceFile, markdownText)
            ));
            if (displayRevision !== this.displaySlidesRevision) {
                return;
            }

            const mermaidRenderOptions = parseMermaidRenderOptionsFromCss(mermaidThemeCss);
            const processedMarkdown = await this.measurePreviewStepAsync('compileMarkdownForMarp', () => (
                compileMarkdownForMarp(markdownText, sourceFile, this.app, filePath, {
                    renderMermaidInline: true,
                    mermaidOptions: { renderOptions: mermaidRenderOptions },
                })
            ));
            if (displayRevision !== this.displaySlidesRevision) {
                return;
            }

            this.previewSlideEls = [];
            this.previewMaxSlideWidth = 0;

            const rendered = this.measurePreviewStep('marp.render', () => marp.render(processedMarkdown));
            if (displayRevision !== this.displaySlidesRevision) {
                return;
            }
            let html = rendered.html;
            const css = await this.measurePreviewStepAsync('rewriteThemeAssets', () => (
                this.themeAssetCache.rewriteRemoteAssets(rendered.css)
            ));
            if (displayRevision !== this.displaySlidesRevision) {
                return;
            }

            html = this.measurePreviewStep('rewriteBackgroundUrls', () => (
                html.replace(/(?!background-image:url\(&quot;http)background-image:url\(&quot;/g, `background-image:url(&quot;${previewBaseUrl}`)
            ));

            const htmlFile = `<!DOCTYPE html>
<html>
<head>
<base href="${previewBaseUrl}">
<style id="__marp-vscode-style">${css}\n${mermaidThemeCss}\n${BUILTIN_THEME_SCALE_CSS}\n${MARP_EXTENDED_STRUCTURAL_CSS}</style>
<style id="__marp-extended-preview-style">${PREVIEW_IFRAME_STYLE}</style>
</head>
<body>${html}</body>
</html>`;

            await this.commitPreviewRender(displayRevision, htmlFile, rendered.comments ?? []);
        } finally {
            this.endPreviewMeasure('displaySlides', displayStartMark);
        }
	}
}

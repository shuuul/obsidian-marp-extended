import { ItemView, WorkspaceLeaf, MarkdownView, TFile, setIcon, Notice } from 'obsidian';
import { Marp } from '@marp-team/marp-core'
import { browser, type MarpCoreBrowser } from '@marp-team/marp-core/browser'

import { MarpSlidesSettings } from '../utilities/settings'
import { FilePath } from '../utilities/filePath'
import { ThemeManager } from '../utilities/themeManager';
import { MathOptions } from '@marp-team/marp-core/types/src/math/math';
import { markdownItMermaid } from '../markdown-it/mermaid';
import { loadMermaidThemeCssForFile } from '../utilities/mermaidTheme';
import {
    PREVIEW_ZOOM_RESET,
    clampPreviewZoom,
    formatPreviewZoom,
    getPreviewZoomFitScale,
    isPreviewZoomWheel,
    zoomPreviewByStep,
    zoomPreviewFromWheel,
} from '../utilities/previewZoom'

const markdownItContainer = require('markdown-it-container');
const markdownItMark = require('markdown-it-mark');

export const MARP_PREVIEW_VIEW = 'marp-preview-view';

export class MarpPreviewView extends ItemView  {
    private marp: Marp; 
    
    private marpBrowser: MarpCoreBrowser | undefined;
    private previewContainerEl: HTMLElement | undefined;
    private previewResizeObserver: ResizeObserver | undefined;
    private previewZoom = PREVIEW_ZOOM_RESET;
    private previewZoomFitScale = PREVIEW_ZOOM_RESET;
    private zoomLabelEl: HTMLElement | undefined;
    private syncPreviewButtonEl: HTMLButtonElement | undefined;
    private syncPreviewEnabled = true;
    private settings : MarpSlidesSettings;

    private file : TFile | null = null;

    constructor(settings: MarpSlidesSettings, leaf: WorkspaceLeaf) {
        super(leaf);

        this.settings = settings;

        this.marp = new Marp({
            container: { tag: 'div', id: '__marp-vscode' },
            slideContainer: { tag: 'div', 'data-marp-vscode-slide-wrapper': '' },
            html: this.settings.EnableHTML,
            inlineSVG: {
                enabled: true,
                backdropSelector: false
            },
            math: this.settings.MathTypesettings as MathOptions,
            minifyCSS: true,
            script: false
          });

        this.marp
            .use(markdownItContainer, "container")
            .use(markdownItMark)
            .use(markdownItMermaid);
    }

    getViewType() {
        return MARP_PREVIEW_VIEW;
    }

    getDisplayText() {
        return "Deck Preview";
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
        this.registerPreviewZoomGesture();
        this.registerPreviewZoomResizeObserver();
        this.marpBrowser = browser(this.previewContainerEl);

        const themeManager = new ThemeManager(this.app);
        const fileContents = await themeManager.loadThemeCss();
        fileContents.forEach((content) => {
            this.marp.themeSet.add(content);
        });

        this.addActions();
    }

    async onClose() {
        this.previewResizeObserver?.disconnect();
        this.previewResizeObserver = undefined;
        this.marpBrowser?.cleanup();
        this.marpBrowser = undefined;
    }

    async onChange(view : MarkdownView) {
        void this.displaySlides(view);
    }

    onLineChanged(slideIndex: number): void {
        const targetSlideIndex = Math.max(0, slideIndex);
        const slide = this.previewContainerEl
            ?.querySelectorAll<HTMLElement>('[data-marp-vscode-slide-wrapper]')
            .item(targetSlideIndex);

        if (!slide) {
            console.log("Preview slide not found!")
            return;
        }

        slide.scrollIntoView({ block: 'start', inline: 'nearest' });
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
        this.addZoomToolbarControls(toolbar);
        this.addPreviewToolbarButton(toolbar, 'image', 'Export as PNG', 'png');
        this.addPreviewToolbarButton(toolbar, 'code-glyph', 'Export as HTML', 'html');
        this.addPreviewToolbarButton(toolbar, 'slides-marp-export-pdf', 'Export as PDF', 'pdf');
        this.addPreviewToolbarButton(toolbar, 'slides-marp-export-pptx', 'Export as PPTX', 'pptx');
        this.addPreviewToolbarButton(toolbar, 'slides-marp-slide-present', 'Preview Slides', 'preview');
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
            let maxSlideWidth = 0;
            this.previewContainerEl.querySelectorAll<HTMLElement>('[data-marp-vscode-slide-wrapper]').forEach((wrapper) => {
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
                    maxSlideWidth = Math.max(maxSlideWidth, dimensions[2]);
                }
            });

            this.previewZoomFitScale = getPreviewZoomFitScale(this.previewContainerEl.clientWidth, maxSlideWidth);
            this.previewContainerEl.style.setProperty(
                '--marp-extended-preview-zoom',
                String(this.previewZoom * this.previewZoomFitScale),
            );
        }

        if (!this.zoomLabelEl) {
            return;
        }

        const formattedZoom = formatPreviewZoom(this.previewZoom);
        this.zoomLabelEl.setText(formattedZoom);
        this.zoomLabelEl.setAttribute('aria-label', `Preview zoom ${formattedZoom}`);
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

    private registerPreviewZoomResizeObserver(): void {
        if (!this.previewContainerEl || typeof ResizeObserver === 'undefined') {
            return;
        }

        this.previewResizeObserver?.disconnect();
        this.previewResizeObserver = new ResizeObserver(() => {
            this.applyPreviewZoom();
        });
        this.previewResizeObserver.observe(this.previewContainerEl);
    }

    addActions() {
        this.addAction('image', 'Export as PNG', () => {
            void this.exportFile('png');
        });

        this.addAction('code-glyph', 'Export as HTML', () => {
            void this.exportFile('html');
        });

        this.addAction('slides-marp-export-pdf', 'Export as PDF', () => {
            void this.exportFile('pdf');
        });

        this.addAction('slides-marp-export-pptx', 'Export as PPTX', () => {
            void this.exportFile('pptx');
        });

        this.addAction('slides-marp-slide-present', 'Preview Slides', () => {
            void this.exportFile('preview');
        });
      }

    private async exportFile(type: string) {
        const file = this.file ?? this.app.workspace.getActiveFile();
        if (!file) {
            new Notice('Open a Markdown file before exporting Marp slides.', 5000);
            return;
        }

        try {
            const { MarpExport } = await import('../utilities/marpExport');
            const marpCli = new MarpExport(this.settings, this.app);
            const outputPath = await marpCli.export(file, type);
            if (outputPath) {
                new Notice(`Exported Marp slides to ${outputPath}`, 7000);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Marp export failed:', error);
            new Notice(`Marp export failed: ${message}`, 8000);
        }
    }
    
    async displaySlides(view : MarkdownView, markdownOverride?: string) {

        if (view.file != null) {
            this.file = view.file;
            const filePath = new FilePath(this.settings);
            const basePath = filePath.getCompleteFileBasePath(view.file);
            const markdownText = markdownOverride ?? view.getViewData();
            const mermaidThemeCss = await loadMermaidThemeCssForFile(this.app, view.file, markdownText);

            // Convert wiki-link images to standard markdown
            const processedMarkdown = filePath.convertImageWikiLinks(markdownText, view.file, this.app);

            const container = this.previewContainerEl ?? this.contentEl;
            container.empty();


            const rendered = this.marp.render(processedMarkdown);
            let html = rendered.html;
            const { css } = rendered;
            
            // Replace Backgorund Url for images
            html = html.replace(/(?!background-image:url\(&quot;http)background-image:url\(&quot;/g, `background-image:url(&quot;${basePath}`);

            const htmlFile = `
                <!DOCTYPE html>
                <html>
                <head>
                <base href="${basePath}"></base>
                <style id="__marp-vscode-style">${css}\n${mermaidThemeCss}</style>
                </head>
                <body>${html}</body>
                </html>
                `;

            container.innerHTML = htmlFile;
            this.marpBrowser?.update();
            this.applyPreviewZoom();
        }
        else
        {
            console.log("Errore: view.file is null")
        }
	}
}

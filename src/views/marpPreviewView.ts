import { ItemView, WorkspaceLeaf, MarkdownView, TFile, setIcon, Notice } from 'obsidian';
import { Marp } from '@marp-team/marp-core'
import { browser, type MarpCoreBrowser } from '@marp-team/marp-core/browser'

import { MarpSlidesSettings } from '../utilities/settings'
import { FilePath } from '../utilities/filePath'
import { ThemeManager } from '../utilities/themeManager';
import { MathOptions } from '@marp-team/marp-core/types/src/math/math';

const markdownItContainer = require('markdown-it-container');
const markdownItMark = require('markdown-it-mark');
const markdownItKroki = require('@kazumatu981/markdown-it-kroki');

export const MARP_PREVIEW_VIEW = 'marp-preview-view';

export class MarpPreviewView extends ItemView  {
    private marp: Marp; 
    
    private marpBrowser: MarpCoreBrowser | undefined;
    private previewContainerEl: HTMLElement | undefined;
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

        if (this.settings.EnableMarkdownItPlugins){
          this.marp
            .use(markdownItContainer, "container")
            .use(markdownItMark)
            .use(markdownItKroki,{entrypoint: "https://kroki.io"});
        }
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
        this.marpBrowser = browser(this.previewContainerEl);

        const themeManager = new ThemeManager(this.app);
        const fileContents = await themeManager.loadThemeCss();
        fileContents.forEach((content) => {
            this.marp.themeSet.add(content);
        });

        this.addActions();
    }

    async onClose() {
        // Nothing to clean up.
        // console.log("marp slide onclose");
    }

    async onChange(view : MarkdownView) {
        this.displaySlides(view);
    }

    async onLineChanged(line: number) {
        try {
            this.previewContainerEl?.querySelectorAll('section')[line]?.scrollIntoView();
        } catch {
            console.log("Preview slide not found!")
        }
	}

    isSyncPreviewEnabled() {
        return this.syncPreviewEnabled;
    }

    addPreviewToolbar(container: HTMLElement) {
        const toolbar = container.createDiv({ cls: 'marp-extended-preview-toolbar' });
        this.addSyncPreviewToolbarButton(toolbar);
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
    
    async displaySlides(view : MarkdownView) {

        if (view.file != null) {
            this.file = view.file;
            const filePath = new FilePath(this.settings);
            const basePath = filePath.getCompleteFileBasePath(view.file);
            const markdownText = view.data;

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
                <style id="__marp-vscode-style">${css}</style>
                </head>
                <body>${html}</body>
                </html>
                `;

            container.innerHTML = htmlFile;
            this.marpBrowser?.update();
        }
        else
        {
            console.log("Errore: view.file is null")
        }
	}
}

import { ItemView, WorkspaceLeaf, MarkdownView, TFile } from 'obsidian';
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
    private settings : MarpSlidesSettings;

    private file : TFile;

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

    async onOpen() {
        // console.log("marp slide onopen");

        const container = this.containerEl.children[1];
        container.empty();
        this.marpBrowser = browser(container);

        const themeManager = new ThemeManager(this.app, this.settings);
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
			this.containerEl.children[1].children[2].children[line].scrollIntoView();
        } catch {
            console.log("Preview slide not found!")
        }
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
        if (!this.file) {
            return;
        }

        const { MarpExport } = await import('../utilities/marpExport');
        const marpCli = new MarpExport(this.settings, this.app);
        await marpCli.export(this.file, type);
    }
    
    async displaySlides(view : MarkdownView) {

        if (view.file != null) {
            this.file = view.file;
            const filePath = new FilePath(this.settings);
            const basePath = filePath.getCompleteFileBasePath(view.file);
            const markdownText = view.data;

            // Convert wiki-link images to standard markdown
            const processedMarkdown = filePath.convertImageWikiLinks(markdownText, view.file, this.app);

            const container = this.containerEl.children[1];
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

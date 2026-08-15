/** Theme-neutral layout required by Marp Extended generated markup. */
export const MARP_EXTENDED_STRUCTURAL_CSS = `
.marp-extended-columns { display: grid; }
.marp-extended-columns-1 { grid-template-columns: 1fr; }
.marp-extended-columns-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.marp-extended-columns-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.marp-extended-columns-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.marp-extended-columns-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.marp-extended-columns-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.marp-extended-column { min-width: 0; }
.marp-extended-cards { width: 100%; table-layout: fixed; }
/* Keep links on the slide palette; zero specificity lets theme link rules win. */
:where(a[href]) {
	color: inherit;
	cursor: pointer;
	text-decoration: underline;
	text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
	text-underline-offset: 0.15em;
}
:where(a[href]):hover { text-decoration-color: currentColor; }
`;

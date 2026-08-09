/**
 * CSS that scales Marp Core built-in themes (default / gaia / uncover)
 * to the same body size as the packaged Kami theme (13pt).
 *
 * Kept as a string so preview and export share one source without requiring
 * a vault theme file named like a real @theme.
 */
export const BUILTIN_THEME_SCALE_CSS = `section[data-theme="default"],
section[data-theme="gaia"],
section[data-theme="uncover"] {
	font-size: 13pt !important;
	line-height: 1.55;
}
`;

export const BUILTIN_THEME_SCALE_STYLE_CLASS = 'marp-extended-builtin-scale';

export function wrapBuiltinThemeScaleCss(css: string = BUILTIN_THEME_SCALE_CSS): string {
	const trimmed = css.trim();
	if (!trimmed) {
		return '';
	}

	return `<style class="${BUILTIN_THEME_SCALE_STYLE_CLASS}">\n${trimmed}\n</style>\n`;
}

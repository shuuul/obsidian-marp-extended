/**
 * Empty stubs for Marp Core's cold MathJax font extensions (bbm, bboldx, dsfont).
 *
 * Marp Core hard-requires these packages, but their glyph tables (~0.4 MiB)
 * only serve niche macros (`\bbm`, `\mathds`). With the stub, those macros
 * degrade to a console warning ("Invalid variant") and a missing glyph, while
 * standard TeX, `\mathbb`, and `\ce` (mhchem, kept as a real dependency)
 * render unchanged.
 */
exports.MathJaxBbmFontExtension = { name: 'mathjax-bbm' };
exports.MathJaxBboldxFontExtension = { name: 'mathjax-bboldx' };
exports.MathJaxDsfontFontExtension = { name: 'mathjax-dsfont' };

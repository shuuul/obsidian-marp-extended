import { expect, test } from '@jest/globals';

import {
	PREVIEW_ZOOM_MAX,
	PREVIEW_ZOOM_MIN,
	clampPreviewZoom,
	formatPreviewZoom,
	getPreviewZoomFitScale,
	isPreviewZoomWheel,
	zoomPreviewByStep,
	zoomPreviewFromWheel,
} from '@/utilities/previewZoom';

test('clampPreviewZoom normalizes invalid and out-of-range values', () => {
	expect(clampPreviewZoom(Number.NaN)).toBe(1);
	expect(clampPreviewZoom(Number.POSITIVE_INFINITY)).toBe(1);
	expect(clampPreviewZoom(0.1)).toBe(PREVIEW_ZOOM_MIN);
	expect(clampPreviewZoom(5)).toBe(PREVIEW_ZOOM_MAX);
	expect(clampPreviewZoom(1.5)).toBe(1.5);
});

test('formatPreviewZoom reports a clamped percentage', () => {
	expect(formatPreviewZoom(1)).toBe('100%');
	expect(formatPreviewZoom(1.234)).toBe('123%');
	expect(formatPreviewZoom(0.1)).toBe('25%');
});

test('getPreviewZoomFitScale uses the preview width as the 100 percent baseline', () => {
	expect(getPreviewZoomFitScale(640, 1280)).toBe(0.5);
	expect(getPreviewZoomFitScale(1920, 1280)).toBe(1.5);
	expect(getPreviewZoomFitScale(Number.NaN, 1280)).toBe(1);
	expect(getPreviewZoomFitScale(640, 0)).toBe(1);
});

test('zoomPreviewByStep applies deterministic step zoom with clamps', () => {
	expect(zoomPreviewByStep(1, 1)).toBeCloseTo(1.1);
	expect(zoomPreviewByStep(1.1, -1)).toBeCloseTo(1);
	expect(zoomPreviewByStep(PREVIEW_ZOOM_MIN, -1)).toBe(PREVIEW_ZOOM_MIN);
	expect(zoomPreviewByStep(PREVIEW_ZOOM_MAX, 1)).toBe(PREVIEW_ZOOM_MAX);
});

test('zoomPreviewFromWheel applies PDF.js-compatible exponential zoom with clamps', () => {
	expect(zoomPreviewFromWheel(1, -10)).toBeGreaterThan(1);
	expect(zoomPreviewFromWheel(1, 10)).toBeLessThan(1);
	expect(zoomPreviewFromWheel(1, -1000)).toBe(PREVIEW_ZOOM_MAX);
	expect(zoomPreviewFromWheel(1, 1000)).toBe(PREVIEW_ZOOM_MIN);
});

test('isPreviewZoomWheel accepts only macOS pinch-style wheel events', () => {
	expect(isPreviewZoomWheel({ ctrlKey: true, deltaMode: 0, deltaX: 0, deltaZ: 0 })).toBe(true);
	expect(isPreviewZoomWheel({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaZ: 0 })).toBe(false);
	expect(isPreviewZoomWheel({ ctrlKey: true, deltaMode: 1, deltaX: 0, deltaZ: 0 })).toBe(false);
	expect(isPreviewZoomWheel({ ctrlKey: true, deltaMode: 0, deltaX: 1, deltaZ: 0 })).toBe(false);
	expect(isPreviewZoomWheel({ ctrlKey: true, deltaMode: 0, deltaX: 0, deltaZ: 1 })).toBe(false);
});

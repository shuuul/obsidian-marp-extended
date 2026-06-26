export const PREVIEW_ZOOM_MIN = 0.25;
export const PREVIEW_ZOOM_MAX = 4;
export const PREVIEW_ZOOM_RESET = 1;
export const PREVIEW_ZOOM_STEP = 1.1;

export type PreviewZoomWheelLike = Pick<WheelEvent, 'ctrlKey' | 'deltaMode' | 'deltaX' | 'deltaZ'>;

export function clampPreviewZoom(value: number): number {
    if (!Number.isFinite(value)) {
        return PREVIEW_ZOOM_RESET;
    }

    return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, value));
}

export function getPreviewZoomFitScale(containerWidth: number, slideWidth: number): number {
    if (!Number.isFinite(containerWidth) || !Number.isFinite(slideWidth) || containerWidth <= 0 || slideWidth <= 0) {
        return PREVIEW_ZOOM_RESET;
    }

    return containerWidth / slideWidth;
}

export function formatPreviewZoom(value: number): string {
    return `${Math.round(clampPreviewZoom(value) * 100)}%`;
}

export function isPreviewZoomWheel(event: PreviewZoomWheelLike): boolean {
    return event.ctrlKey === true
        && event.deltaMode === 0
        && event.deltaX === 0
        && event.deltaZ === 0;
}

export function zoomPreviewByStep(currentZoom: number, direction: 1 | -1): number {
    return clampPreviewZoom(currentZoom * Math.pow(PREVIEW_ZOOM_STEP, direction));
}

export function zoomPreviewFromWheel(currentZoom: number, deltaY: number): number {
    return clampPreviewZoom(currentZoom * Math.exp(-deltaY / 100));
}

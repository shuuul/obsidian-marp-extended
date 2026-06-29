/*
 * Replacement for source-map-js/lib/quick-sort used in the production bundle.
 * The upstream file clones its sorter with new Function(), which is rejected by
 * Obsidian's release scanner. This keeps the same in-place quick-sort behavior
 * without dynamic code execution.
 */

function swap(array, left, right) {
	const temporary = array[left];
	array[left] = array[right];
	array[right] = temporary;
}

function randomIntInRange(low, high) {
	return Math.round(low + (Math.random() * (high - low)));
}

function doQuickSort(array, comparator, left, right) {
	if (left >= right) {
		return;
	}

	const pivotIndex = randomIntInRange(left, right);
	swap(array, pivotIndex, right);

	const pivot = array[right];
	let splitIndex = left - 1;
	for (let index = left; index < right; index += 1) {
		if (comparator(array[index], pivot, false) <= 0) {
			splitIndex += 1;
			swap(array, splitIndex, index);
		}
	}

	swap(array, splitIndex + 1, right);
	const nextPivotIndex = splitIndex + 1;
	doQuickSort(array, comparator, left, nextPivotIndex - 1);
	doQuickSort(array, comparator, nextPivotIndex + 1, right);
}

exports.quickSort = function quickSort(array, comparator, start = 0) {
	doQuickSort(array, comparator, start, array.length - 1);
};

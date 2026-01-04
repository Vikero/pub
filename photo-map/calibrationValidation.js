// --- utils ---
function clamp(v, min = 0, max = 1) {
	return Math.max(min, Math.min(max, v));
}

function mean(arr) {
	return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
	const m = mean(arr);
	return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

// distance in meters (replace with your existing function)
function distanceMeters(a, b) {
	const R = 6371000;
	const dLat = ((b.lat - a.lat) * Math.PI) / 180;
	const dLon = ((b.lon - a.lon) * Math.PI) / 180;
	const lat1 = (a.lat * Math.PI) / 180;
	const lat2 = (b.lat * Math.PI) / 180;

	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

	return 2 * R * Math.asin(Math.sqrt(h));
}

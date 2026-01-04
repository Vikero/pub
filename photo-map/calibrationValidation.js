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

// distance in meters (lat/lon)
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

//
// ==============================
// Phase 4.1 — Point A Validation
// ==============================
//

export function computePointAQuality({
	gpsSamples, // [{lat, lon}]
	pointAWorld, // {lat, lon}  <-- MUST be calibration.pointA.gps
	pointAImage, // {x, y}
	projectWorldToImage, // fn(gps) -> {x,y}
}) {
	if (!gpsSamples || gpsSamples.length < 10) {
		return { QA: 0, locked: false };
	}

	// --- A1: GPS stability ---
	const distances = gpsSamples.map((p) => distanceMeters(p, pointAWorld));
	const sigma = stdDev(distances);

	const A1 = clamp(1 - sigma / 15);

	// --- A2: projection consistency ---
	const projErrors = gpsSamples.map((p) => {
		const img = projectWorldToImage(p);
		if (!img) return 999;
		const dx = img.x - pointAImage.x;
		const dy = img.y - pointAImage.y;
		return Math.hypot(dx, dy);
	});

	const meanError = mean(projErrors);
	const A2 = clamp(1 - meanError / 20);

	const QA = 0.4 * A1 + 0.6 * A2;

	return {
		QA,
		A1,
		A2,
		sigma,
		meanError,
		locked: QA >= 0.85,
	};
}

//
// ==============================
// Phase 4.2 — Point C Validation
// ==============================
//

export function computePointCQuality({
	gpsSamples,
	pointCImage,
	projectWorldToImage,
}) {
	if (!gpsSamples || gpsSamples.length < 10) {
		return { QC: 0 };
	}

	const errors = gpsSamples.map((p) => {
		const img = projectWorldToImage(p);
		if (!img) return 999;
		const dx = img.x - pointCImage.x;
		const dy = img.y - pointCImage.y;
		return Math.hypot(dx, dy);
	});

	const meanError = mean(errors);
	const QC = clamp(1 - meanError / 40);

	return {
		QC,
		meanError,
	};
}

//
// ===================================
// Phase 4.2 — Controlled B Refinement
// ===================================
//

export function refinePointB({
	pointAImage,
	pointBImage,
	pointCImage,
	projectedCImage,
	gain = 0.15,
}) {
	const ex = pointCImage.x - projectedCImage.x;
	const ey = pointCImage.y - projectedCImage.y;

	return {
		x: pointBImage.x + ex * gain,
		y: pointBImage.y + ey * gain,
	};
}

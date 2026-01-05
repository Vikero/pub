import { Renderer } from "./render.js";
import { Calibration } from "./calibration.js";
import { GPSSmoother } from "./gpsSmoother.js";
import {
	computePointAQuality,
	computePointAStabilityQuality,
} from "./calibrationValidation.js";

// --- DOM ---
const canvas = document.getElementById("mapCanvas");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const versionEl = document.getElementById("version");

// Local date + time (user’s locale)
const now = new Date();
versionEl.textContent = `(v${now.toLocaleString()})`;

// --- Core ---
const renderer = new Renderer(canvas);
const calibration = new Calibration();
const gpsSmoother = new GPSSmoother(5);

// --- App state ---
// 0 = waiting for A
// 1 = waiting for B
// 2 = navigating
// 3 = editing A
// 4 = editing B
// 5 = validating A (Phase 4.1, post-B full QA)
// 6 = refining with C (Phase 4.2)
// 7 = validating A (Phase 4.1a - pre B, stability only)
let calibrationStep = 0;

let currentGPS = null;
let gpsSamples = []; // buffer for QA / QC
let qaStartTime = 0;
let lastQAResult = null;

// --- Helpers ---
function status(msg) {
	statusEl.textContent = msg;
}

function updateMarkers() {
	const markers = [];

	if (calibration.pointA) {
		markers.push({
			id: "A",
			x: calibration.pointA.image.x,
			y: calibration.pointA.image.y,
			color: "green",
		});
	}

	if (calibration.pointB) {
		markers.push({
			id: "B",
			x: calibration.pointB.image.x,
			y: calibration.pointB.image.y,
			color: "blue",
		});
	}

	renderer.setMarkers(markers);
}

function collectGPS(sample) {
	gpsSamples.push(sample);
	if (gpsSamples.length > 30) gpsSamples.shift();
}

// --- Image load ---
fileInput.addEventListener("change", (e) => {
	const file = e.target.files[0];
	if (!file) return;

	const img = new Image();
	img.onload = () => {
		renderer.setImage(img);
		calibration.reset();
		gpsSmoother.reset();
		calibrationStep = 0;
		currentGPS = null;
		renderer.setMarkers([]);
		renderer.setLivePosition(null);
		status("Tap first calibration point while standing there");
	};
	img.src = URL.createObjectURL(file);
});

// --- Canvas click ---
canvas.addEventListener("click", (e) => {
	if (!renderer.image) return;

	const rect = canvas.getBoundingClientRect();
	const screenPt = {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};

	// Marker selection (edit mode)
	const hit = renderer.getMarkerAt(screenPt);
	if (hit && (calibrationStep === 2 || calibrationStep === 5)) {
		calibrationStep = hit.id === "A" ? 3 : 4;
		gpsSmoother.reset();
		status(`Tap new location for point ${hit.id}`);
		return;
	}

	if (!currentGPS) {
		status("Waiting for GPS fix…");
		return;
	}

	const imagePt = renderer.screenToImage(screenPt);

	// Initial calibration
	if (calibrationStep === 0) {
		calibration.setPointA(imagePt, currentGPS);

		// ENTER pre-B QA (stability only)
		gpsSamples.length = 0;
		qaStartTime = Date.now();
		lastQAResult = null;

		calibrationStep = 7;
		updateMarkers();
		status("Point A set. Stand still to validate GPS, then walk to point B.");
		return;
	}

	// after stability-only QA, allow user to proceed to B with a tap
	if (calibrationStep === 7) {
		calibrationStep = 1;
		status("Walk to second point and tap again");
		return;
	}

	if (calibrationStep === 1) {
		calibration.setPointB(imagePt, currentGPS);
		calibration.compute();

		// --- ENTER QA ---
		gpsSamples.length = 0; // reset samples
		qaStartTime = Date.now();
		lastQAResult = null;

		calibrationStep = 5; // validating A
		status("Stand still on point A to validate calibration");
		updateMarkers();
		return;
	}

	// Editing A or B

	if (calibrationStep === 3) {
		calibration.setPointA(imagePt, currentGPS);
		calibration.compute();

		// Restart QA
		gpsSamples.length = 0;
		qaStartTime = Date.now();
		lastQAResult = null;

		calibrationStep = 5;
		updateMarkers();
		status("Point A updated. Stand still to re-validate");
		return;
	}

	if (calibrationStep === 4) {
		calibration.setPointB(imagePt, currentGPS);
		calibration.compute();
		calibrationStep = 2;
		updateMarkers();
		status("Point B updated");
	}
});

// --- GPS ---
navigator.geolocation.watchPosition(
	(pos) => {
		const speed = pos.coords.speed ?? 0; // m/s
		const MAX_WALK_SPEED = 2.5; // ~9 km/h

		// Ignore bike / car movement
		if (speed > MAX_WALK_SPEED) return;

		gpsSmoother.add({
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
		});

		const avg = gpsSmoother.getAveraged();
		if (!avg) return;

		currentGPS = avg;
		collectGPS(avg);

		if (calibrationStep === 2 || calibrationStep === 5) {
			const projected = calibration.project(currentGPS);
			if (projected) renderer.setLivePosition(projected);
		}

		if (calibrationStep === 7 && gpsSamples.length >= 20) {
			const qa = computePointAStabilityQuality({
				gpsSamples,
				pointAWorld: calibration.pointA.gps,
			});

			lastQAResult = qa;
			status(`Point A GPS stability: ${(qa.QA * 100).toFixed(0)}%`);

			// advisory: auto-advance to "waiting for B" when stable
			if (qa.locked) {
				calibrationStep = 1;
				gpsSamples.length = 0;
				status("A looks stable. Walk to point B and tap.");
			}
		}

		// ----------------------------
		// Phase 4.1 — QA loop
		// ----------------------------
		if (calibrationStep === 5 && gpsSamples.length >= 20) {
			const qa = computePointAQuality({
				gpsSamples,
				pointAWorld: calibration.pointA.gps,
				pointAImage: calibration.pointA.image,
				projectWorldToImage: calibration.project.bind(calibration),
			});

			lastQAResult = qa;

			status(`Point A quality: ${(qa.QA * 100).toFixed(0)}%`);

			// Auto-lock only if truly good
			if (qa.locked) {
				calibrationStep = 2;
				gpsSamples.length = 0;
				status("Calibration validated. Navigation active");
			}
		}
		if (calibrationStep === 5 && Date.now() - qaStartTime > 20000) {
			status("QA inconclusive — you may adjust point A");
		}
	},
	(err) => {
		console.warn("GPS error:", err.message);
		status("GPS unavailable");
	},
	{
		enableHighAccuracy: true,
		maximumAge: 1000,
		timeout: 10000,
	}
);

// --- Service worker ---
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

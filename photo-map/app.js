import { Renderer } from "./render.js";
import { Calibration } from "./calibration.js";
import { GPSSmoother } from "./gpsSmoother.js";

// --- DOM ---
const canvas = document.getElementById("mapCanvas");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");

// --- Core ---
const renderer = new Renderer(canvas);
const calibration = new Calibration();
const gpsSmoother = new GPSSmoother(5); // 5-point buffer for walking

// --- App state ---
// calibrationStep:
// 0 = waiting for point A
// 1 = waiting for point B
// 2 = calibrated, navigating
let calibrationStep = 0;
let currentGPS = null;

// --- Helpers ---
function status(msg) {
	statusEl.textContent = msg;
}

// --- Image load ---
fileInput.addEventListener("change", (e) => {
	const file = e.target.files[0];
	if (!file) return;

	const img = new Image();
	img.onload = () => {
		renderer.setImage(img);

		// Reset state
		calibration.reset();
		gpsSmoother.reset();
		calibrationStep = 0;
		currentGPS = null;

		// Clear markers & position
		renderer.setMarkers([]);
		renderer.setLivePosition(null);

		status("Tap first calibration point while standing there");
	};

	img.src = URL.createObjectURL(file);
});

// --- Calibration taps ---
canvas.addEventListener("click", (e) => {
	if (!currentGPS) {
		status("Waiting for GPS fix…");
		return;
	}

	if (!renderer.image) return;
	if (calibrationStep > 1) return; // already calibrated

	const rect = canvas.getBoundingClientRect();
	const screenPt = {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};

	const imagePt = renderer.screenToImage(screenPt);

	if (calibrationStep === 0) {
		calibration.setPointA(imagePt, currentGPS);
		renderer.addCalibrationMarker(imagePt);
		calibrationStep = 1;
		status("Walk to second point and tap again");
		return;
	}

	if (calibrationStep === 1) {
		calibration.setPointB(imagePt, currentGPS);
		calibration.compute();
		renderer.addCalibrationMarker(imagePt);
		calibrationStep = 2;
		status("Calibration complete. Navigation active");
	}
});

// --- GPS ---
navigator.geolocation.watchPosition(
	(pos) => {
		const speed = pos.coords.speed ?? 0; // m/s
		const MAX_WALK_SPEED = 2.5; // ~9 km/h

		// Ignore bike / car movement
		if (speed > MAX_WALK_SPEED) return;

		const rawGPS = {
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
		};

		gpsSmoother.add(rawGPS);
		const smoothed = gpsSmoother.getAveraged();
		if (!smoothed) return;

		currentGPS = smoothed;

		// Only project after calibration
		if (calibrationStep === 2) {
			const projected = calibration.project(currentGPS);
			if (projected) {
				renderer.setLivePosition(projected);
			}
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

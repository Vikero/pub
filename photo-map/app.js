import { Renderer } from "./render.js";
import { Calibration } from "./calibration.js";

// --- DOM Elements ---
const canvas = document.getElementById("mapCanvas");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");

// --- Core objects ---
const renderer = new Renderer(canvas);
const calibration = new Calibration();

// --- App state ---
let calibrationStep = 0; // 0 = first point, 1 = second point
let currentGPS = null;

// --- GPS smoothing ---
let smoothedLat = null;
let smoothedLon = null;
const GPS_ALPHA = 0.25;

// --- Load image ---
fileInput.addEventListener("change", (e) => {
	const file = e.target.files[0];
	if (!file) return;

	const img = new Image();
	img.onload = () => {
		renderer.setImage(img); // fits image to screen
		calibration.reset();
		calibrationStep = 0;
		status("Tap first calibration point while standing there");
	};
	img.src = URL.createObjectURL(file);
});

// --- Calibration taps ---
canvas.addEventListener("click", (e) => {
	if (!currentGPS) {
		status("Waiting for GPS fix...");
		return;
	}

	if (!renderer.image) return;

	const rect = canvas.getBoundingClientRect();
	const screenPt = {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};

	const imagePt = renderer.screenToImage(screenPt);

	if (calibrationStep === 0) {
		calibration.setPointA(imagePt, currentGPS);
		calibrationStep = 1;
		renderer.addCalibrationMarker(imagePt);
		status("Walk to second point and tap again");
	} else if (calibrationStep === 1) {
		calibration.setPointB(imagePt, currentGPS);
		calibrationStep = 2;
		calibration.compute();
		renderer.addCalibrationMarker(imagePt);
		status("Calibration complete. Navigation active");
	}

	renderer.draw();
});

// --- GPS ---
navigator.geolocation.watchPosition(
	(pos) => {
		const lat = pos.coords.latitude;
		const lon = pos.coords.longitude;

		// EMA smoothing
		if (smoothedLat === null) {
			smoothedLat = lat;
			smoothedLon = lon;
		} else {
			smoothedLat = GPS_ALPHA * lat + (1 - GPS_ALPHA) * smoothedLat;
			smoothedLon = GPS_ALPHA * lon + (1 - GPS_ALPHA) * smoothedLon;
		}

		currentGPS = { lat: smoothedLat, lon: smoothedLon };

		if (calibration.ready) {
			const imgPt = calibration.project(currentGPS);
			if (imgPt) renderer.setLivePosition(imgPt);
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

// --- Status helper ---
function status(msg) {
	statusEl.textContent = msg;
}

// --- Service Worker ---
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

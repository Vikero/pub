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
const gpsSmoother = new GPSSmoother(5);

// --- App state ---
// 0 = waiting for A
// 1 = waiting for B
// 2 = navigating
// 3 = editing A
// 4 = editing B
let calibrationStep = 0;
let currentGPS = null;

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
	if (hit && calibrationStep === 2) {
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
		calibrationStep = 1;
		updateMarkers();
		status("Walk to second point and tap again");
		return;
	}

	if (calibrationStep === 1) {
		calibration.setPointB(imagePt, currentGPS);
		calibration.compute();
		calibrationStep = 2;
		updateMarkers();
		status("Calibration complete. Navigation active");
		return;
	}

	// Editing A or B
	if (calibrationStep === 3) {
		calibration.setPointA(imagePt, currentGPS);
		calibration.compute();
		calibrationStep = 2;
		updateMarkers();
		status("Point A updated");
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

		if (calibrationStep === 2) {
			const projected = calibration.project(currentGPS);
			if (projected) renderer.setLivePosition(projected);
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

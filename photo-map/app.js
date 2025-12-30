// app.js

import { Renderer } from "./render.js";
import { Calibration } from "./calibration.js";

// --- DOM ---
const canvas = document.getElementById("canvas");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");

// --- Core objects ---
const renderer = new Renderer(canvas);
const calibration = new Calibration();

// --- App state ---
let currentGPS = null;
let phase = "idle";
// idle → calibrateA → calibrateB → navigate

// --- GPS ---
navigator.geolocation.watchPosition(
	(pos) => {
		currentGPS = {
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
		};

		if (phase === "navigate") {
			const projected = calibration.project(currentGPS);
			if (projected) updateMarkers(projected);
		}
	},
	(err) => {
		console.warn("GPS error:", err);
		status("GPS unavailable");
	},
	{
		enableHighAccuracy: true,
		maximumAge: 1000,
	}
);

// --- Image load ---
fileInput.addEventListener("change", (e) => {
	const file = e.target.files[0];
	if (!file) return;

	const img = new Image();
	img.onload = () => {
		renderer.setImage(img);
		calibration.reset();
		phase = "calibrateA";
		updateMarkers();
		status("Tap first point while standing there");
	};
	img.src = URL.createObjectURL(file);
});

// --- Canvas tap (calibration) ---
canvas.addEventListener("click", (e) => {
	if (!currentGPS) {
		status("Waiting for GPS fix…");
		return;
	}

	if (phase !== "calibrateA" && phase !== "calibrateB") return;

	const rect = canvas.getBoundingClientRect();
	const screenPt = {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};

	const imagePt = renderer.screenToImage(screenPt);

	if (phase === "calibrateA") {
		calibration.setPointA(imagePt, currentGPS);
		phase = "calibrateB";
		updateMarkers();
		status("Walk to second point and tap again");
	} else if (phase === "calibrateB") {
		calibration.setPointB(imagePt, currentGPS);
		phase = "navigate";
		updateMarkers();
		status("Navigation active");
	}
});

// --- Marker management ---
function updateMarkers(projected = null) {
	const markers = [];

	if (calibration.pointA) {
		markers.push({
			x: calibration.pointA.image.x,
			y: calibration.pointA.image.y,
			color: "blue",
		});
	}

	if (calibration.pointB) {
		markers.push({
			x: calibration.pointB.image.x,
			y: calibration.pointB.image.y,
			color: "green",
		});
	}

	if (projected) {
		markers.push({
			x: projected.x,
			y: projected.y,
			color: "red",
		});
	}

	renderer.setMarkers(markers);
}

// --- Status helper ---
function status(msg) {
	statusEl.textContent = msg;
}

// --- Service worker (safe on GitHub Pages / mobile) ---
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

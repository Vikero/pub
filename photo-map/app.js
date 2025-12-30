// app.js

import { Renderer } from "./render.js";
import { Calibration } from "./calibration.js";

const canvas = document.getElementById("canvas");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");

const renderer = new Renderer(canvas);
const calibration = new Calibration();

let currentGPS = null;
let phase = "idle"; // idle → calibrateA → calibrateB → navigate

// --- GPS ---
navigator.geolocation.watchPosition(
	(pos) => {
		currentGPS = {
			lat: pos.coords.latitude,
			lon: pos.coords.longitude,
		};

		if (phase === "navigate") {
			const projected = calibration.project(currentGPS);
			if (projected) renderer.setMarker(projected);
		}
	},
	(err) => console.warn(err),
	{ enableHighAccuracy: true }
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
		status("Tap first point while standing there");
	};
	img.src = URL.createObjectURL(file);
});

// --- Canvas tap ---
canvas.addEventListener("click", (e) => {
	if (!currentGPS) return;

	const rect = canvas.getBoundingClientRect();
	const screenPt = {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top,
	};

	const imagePt = renderer.screenToImage(screenPt);

	if (phase === "calibrateA") {
		calibration.setPointA(imagePt, currentGPS);
		phase = "calibrateB";
		status("Walk to second point and tap again");
	} else if (phase === "calibrateB") {
		calibration.setPointB(imagePt, currentGPS);
		phase = "navigate";
		status("Navigation active");
	}
});

// --- Helpers ---
function status(msg) {
	statusEl.textContent = msg;
}

// --- Service Worker ---
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./service-worker.js");
}

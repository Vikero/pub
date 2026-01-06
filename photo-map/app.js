import { Renderer } from "./render.js";
import { Calibration } from "./calibration.js";
import { GPSSmoother } from "./gpsSmoother.js";
import { MapOverlays } from "./mapOverlays.js";
import {
	computePointAQuality,
	computePointAStabilityQuality,
} from "./calibrationValidation.js";
import { loadAutosave, saveAutosave, clearAutosave } from "./autosave.js";

// --- DOM ---
const canvas = document.getElementById("mapCanvas");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const versionEl = document.getElementById("version");
const debugEl = document.getElementById("debug");

let debugEnabled = true;

function setDebug(text) {
	if (!debugEl) return;
	debugEl.textContent = debugEnabled ? text : "";
}

// Build version (written by GitHub Pages deploy workflow)
(async () => {
	try {
		const res = await fetch(`/pub/version.json?bust=${Date.now()}`, {
			cache: "no-store",
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const v = await res.json();
		versionEl.textContent = `(${v.builtAt} @ ${v.sha})`;
	} catch {
		versionEl.textContent = "(dev)";
	}
})();

// --- Core ---
const renderer = new Renderer(canvas);
const calibration = new Calibration();
const gpsSmoother = new GPSSmoother(5);

const overlays = new MapOverlays();

renderer.setAfterDraw((ctx) => {
	overlays.draw({
		ctx,
		canvas,
		renderer,
		calibration,
	});
});

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

// --- Minimal autosave ---
function autosaveNow() {
	saveAutosave({
		calibrationStep,
		pointA: calibration.pointA,
		pointB: calibration.pointB,
	});
}

// Restore autosave (calibration state only; image must be re-selected)
(function restoreAutosaveOnBoot() {
	const saved = loadAutosave();
	if (!saved) return;

	calibration.reset();

	if (saved.pointA) {
		calibration.setPointA(saved.pointA.image, saved.pointA.gps);
	}

	if (saved.pointB) {
		calibration.setPointB(saved.pointB.image, saved.pointB.gps);
		calibration.compute();
	}

	calibrationStep = saved.calibrationStep ?? 0;

	status("Session restored. Re-select the same photo to continue.");
})();

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
	const url = URL.createObjectURL(file);

	img.onload = () => {
		URL.revokeObjectURL(url);
		renderer.setImage(img);

		const hasRestoredCalib = !!(calibration.pointA || calibration.pointB);

		// If autosave was restored, user may be loading a different photo.
		// Ask whether to keep restored calibration.
		if (hasRestoredCalib) {
			const keep = confirm(
				"Restore previous calibration on this photo?\n\nOK = Restore markers\nCancel = Start new session (clears saved calibration)"
			);

			if (keep) {
				if (calibration.pointA && calibration.pointB) calibration.compute();
				updateMarkers();
				updateDebugOverlay();
				status("Photo loaded. Session restored.");
				return;
			}

			// Start fresh: clear stored calibration + reset in-memory.
			calibration.reset();
			clearAutosave();
		}

		// Start fresh (either no restored calib, or user chose to clear)
		gpsSmoother.reset();
		calibrationStep = 0;
		currentGPS = null;
		gpsSamples.length = 0;
		qaStartTime = 0;
		lastQAResult = null;

		renderer.setMarkers([]);
		renderer.setLivePosition(null);

		status("Tap first calibration point while standing there");
	};

	img.onerror = () => {
		URL.revokeObjectURL(url);
		status("Failed to load image");
	};

	img.src = url;
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
		autosaveNow();
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
		autosaveNow();
		status("Point A set. Stand still to validate GPS, then walk to point B.");
		return;
	}

	// after stability-only QA, allow user to proceed to B with a tap
	if (calibrationStep === 7) {
		calibrationStep = 1;
		autosaveNow();
		status("Walk to second point and tap again");
		return;
	}

	if (calibrationStep === 1) {
		calibration.setPointB(imagePt, currentGPS);
		calibration.compute();
		updateDebugOverlay();

		// --- ENTER QA ---
		gpsSamples.length = 0; // reset samples
		qaStartTime = Date.now();
		lastQAResult = null;

		calibrationStep = 5; // validating A
		status("Stand still on point A to validate calibration");
		updateMarkers();
		autosaveNow();
		return;
	}

	// Editing A or B
	if (calibrationStep === 3) {
		calibration.setPointA(imagePt, currentGPS);
		calibration.compute();
		updateDebugOverlay();

		// Restart QA
		gpsSamples.length = 0;
		qaStartTime = Date.now();
		lastQAResult = null;

		calibrationStep = 5;
		updateMarkers();
		autosaveNow();
		status("Point A updated. Stand still to re-validate");
		return;
	}

	if (calibrationStep === 4) {
		calibration.setPointB(imagePt, currentGPS);
		calibration.compute();
		updateDebugOverlay();
		calibrationStep = 2;
		updateMarkers();
		autosaveNow();
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
		updateDebugOverlay();

		// Collect samples for QA/QC
		collectGPS(avg);
		updateQAOverlay();

		if (
			calibrationStep === 2 ||
			calibrationStep === 5 ||
			calibrationStep === 7
		) {
			const projected = calibration.project(currentGPS);
			renderer.setLivePosition(projected || null);
		} else {
			renderer.setLivePosition(null);
		}

		if (calibrationStep === 7 && gpsSamples.length >= 20) {
			const qa = computePointAStabilityQuality({
				gpsSamples,
				pointAWorld: calibration.pointA.gps,
			});

			lastQAResult = qa;
			updateQAOverlay();
			status(`Point A GPS stability: ${(qa.QA * 100).toFixed(0)}%`);

			// advisory: auto-advance to "waiting for B" when stable
			if (qa.locked) {
				calibrationStep = 1;
				autosaveNow();
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
			updateQAOverlay();

			status(`Point A quality: ${(qa.QA * 100).toFixed(0)}%`);

			// Auto-lock only if truly good
			if (qa.locked) {
				calibrationStep = 2;
				autosaveNow();
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

function updateDebugOverlay() {
	const dbg = calibration.getDebugInfo();
	if (!dbg) {
		setDebug(
			[
				`step=${calibrationStep}`,
				currentGPS
					? `gps=${currentGPS.lat.toFixed(6)}, ${currentGPS.lon.toFixed(6)}`
					: "gps=null",
				"calib=not ready",
			].join("\n")
		);
		return;
	}

	setDebug(
		[
			`step=${calibrationStep}`,
			currentGPS
				? `gps=${currentGPS.lat.toFixed(6)}, ${currentGPS.lon.toFixed(6)}`
				: "gps=null",
			`scale=${dbg.scale.toFixed(6)}`,
			`rotationDeg=${dbg.rotationDeg.toFixed(2)}`,
			`originImage=(${dbg.originImage.x.toFixed(
				1
			)}, ${dbg.originImage.y.toFixed(1)})`,
			`originWorld=(${dbg.originWorld.x.toFixed(
				2
			)}m, ${dbg.originWorld.y.toFixed(2)}m)`,
		].join("\n")
	);
}

function updateQAOverlay() {
	const minSamples = 20;

	// Show QA only in QA steps
	if (calibrationStep !== 7 && calibrationStep !== 5) {
		overlays.setQA(null);
		return;
	}

	const seconds = Math.max(0, Math.round((Date.now() - qaStartTime) / 1000));

	overlays.setQA({
		step: calibrationStep,
		samples: gpsSamples.length,
		minSamples,
		seconds,
		qaPercent: lastQAResult?.QA ?? null,
		locked: !!lastQAResult?.locked,
	});

	// ensure it visually updates immediately on mobile
	renderer.draw();
}

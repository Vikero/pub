/**
 * Registers lifecycle hooks to rebuild the canvas after resume.
 * Mobile browsers may discard canvas backing buffers when backgrounded.
 */
export function registerLifecycleRedraw({ rebuild }) {
	let pending = false;
	const schedule = (reason) => {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			rebuild(reason);
		});
	};

	window.addEventListener("pageshow", (e) => {
		schedule(e.persisted ? "pageshow(bfcache)" : "pageshow");
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") schedule("visibilitychange");
	});

	window.addEventListener("focus", () => schedule("focus"));
}

/**
 * Creates a state-driven QA overlay updater.
 * Keeps app.js smaller and centralizes the "only show on steps" rule.
 */
export function createQAOverlayController({
	overlays,
	renderer,
	getStep,
	getSamplesCount,
	getQAStartTime,
	getLastQAResult,
	minSamples = 20,
}) {
	function computeSeconds() {
		return Math.max(0, Math.round((Date.now() - getQAStartTime()) / 1000));
	}

	return {
		update() {
			const step = getStep();

			// Show QA only in QA steps
			if (step !== 7 && step !== 5) {
				overlays.setQA(null);
				return;
			}

			overlays.setQA({
				step,
				samples: getSamplesCount(),
				minSamples,
				seconds: computeSeconds(),
				qaPercent: getLastQAResult()?.QA ?? null,
				locked: !!getLastQAResult()?.locked,
			});

			// ensure it visually updates immediately on mobile
			renderer.draw();
		},
	};
}

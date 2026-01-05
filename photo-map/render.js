export class Renderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");

		this.image = null;
		this.scale = 1;
		this.offsetX = 0;
		this.offsetY = 0;

		this.pointers = new Map();
		this.lastPinchDistance = null;

		this.markers = []; // [{ id, x, y, color }]
		this.livePosition = null;

		window.addEventListener("resize", () => this.resize());
		this.bindEvents();
		this.afterDraw = null; // optional callback(ctx)
	}

	setImage(img) {
		this.image = img;
		this.resize();
	}

	setMarkers(markers) {
		this.markers = markers;
		this.draw();
	}

	setLivePosition(pt) {
		this.livePosition = pt;
		this.draw();
	}

	setAfterDraw(fn) {
		this.afterDraw = fn;
		this.draw();
	}

	screenToImage(screenPt) {
		if (!this.image) return { x: 0, y: 0 };
		return {
			x: (screenPt.x - this.offsetX) / this.scale,
			y: (screenPt.y - this.offsetY) / this.scale,
		};
	}

	// NEW: hit-test calibration markers
	getMarkerAt(screenPt, radius = 15) {
		const imgPt = this.screenToImage(screenPt);

		for (const m of this.markers) {
			const dx = imgPt.x - m.x;
			const dy = imgPt.y - m.y;
			if (Math.hypot(dx, dy) < radius / this.scale) {
				return m;
			}
		}
		return null;
	}

	resize() {
		if (!this.image) return;

		const rect = this.canvas.getBoundingClientRect();

		// On mobile resume, layout can report 0x0 briefly. Don't trash the canvas.
		if (!rect.width || !rect.height) {
			// Try again next frame when layout stabilizes
			requestAnimationFrame(() => this.resize());
			return;
		}

		const dpr = window.devicePixelRatio || 1;

		this.canvas.width = Math.round(rect.width * dpr);
		this.canvas.height = Math.round(rect.height * dpr);

		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.ctx.imageSmoothingEnabled = true;

		const scaleX = rect.width / this.image.width;
		const scaleY = rect.height / this.image.height;
		this.scale = Math.min(scaleX, scaleY);

		this.offsetX = (rect.width - this.image.width * this.scale) / 2;
		this.offsetY = (rect.height - this.image.height * this.scale) / 2;

		this.draw();
	}

	resetContext() {
		this.ctx = this.canvas.getContext("2d");
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.imageSmoothingEnabled = true;
	}

	rebuild() {
		if (!this.image) return;

		// Reacquire context first (some browsers replace the backing store/context on resume)
		this.resetContext();

		// Then resize to recreate bitmap + set DPR transform on the *current* ctx
		this.resize();

		// resize() already calls draw(), but keeping explicit draw is OK if you want:
		// this.draw();
	}

	bindEvents() {
		this.canvas.addEventListener("pointerdown", (e) => {
			this.canvas.setPointerCapture(e.pointerId);
			this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		});

		this.canvas.addEventListener("pointermove", (e) => {
			if (!this.pointers.has(e.pointerId)) return;

			const prev = this.pointers.get(e.pointerId);
			const curr = { x: e.clientX, y: e.clientY };
			this.pointers.set(e.pointerId, curr);

			if (this.pointers.size === 1) {
				this.offsetX += curr.x - prev.x;
				this.offsetY += curr.y - prev.y;
				this.draw();
			}

			if (this.pointers.size === 2) {
				const pts = [...this.pointers.values()];
				const dx = pts[0].x - pts[1].x;
				const dy = pts[0].y - pts[1].y;
				const dist = Math.hypot(dx, dy);

				if (this.lastPinchDistance) {
					const factor = dist / this.lastPinchDistance;
					const midX = (pts[0].x + pts[1].x) / 2;
					const midY = (pts[0].y + pts[1].y) / 2;
					const rect = this.canvas.getBoundingClientRect();
					this.zoomAt({ x: midX - rect.left, y: midY - rect.top }, factor);
				}

				this.lastPinchDistance = dist;
			}
		});

		this.canvas.addEventListener("pointerup", () => {
			this.pointers.clear();
			this.lastPinchDistance = null;
		});

		this.canvas.addEventListener(
			"wheel",
			(e) => {
				e.preventDefault();
				const factor = e.deltaY < 0 ? 1.1 : 0.9;
				this.zoomAt({ x: e.offsetX, y: e.offsetY }, factor);
			},
			{ passive: false }
		);
	}

	zoomAt(point, factor) {
		const wx = (point.x - this.offsetX) / this.scale;
		const wy = (point.y - this.offsetY) / this.scale;

		this.scale *= factor;

		this.offsetX = point.x - wx * this.scale;
		this.offsetY = point.y - wy * this.scale;

		this.draw();
	}

	draw() {
		if (!this.image) return;

		// If image is not in a drawable state, don't clear to black.
		// (Prevents "clear -> drawImage draws nothing -> black canvas")
		if (!this.image.complete || this.image.naturalWidth === 0) return;

		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.restore();

		// ----- image space -----
		this.ctx.setTransform(
			this.scale,
			0,
			0,
			this.scale,
			this.offsetX,
			this.offsetY
		);

		this.ctx.drawImage(this.image, 0, 0);

		// Calibration markers
		for (const m of this.markers) {
			this.ctx.fillStyle = m.color;
			this.ctx.beginPath();
			this.ctx.arc(m.x, m.y, 8 / this.scale, 0, Math.PI * 2);
			this.ctx.fill();
		}

		// Live GPS
		if (this.livePosition) {
			this.ctx.fillStyle = "red";
			this.ctx.beginPath();
			this.ctx.arc(
				this.livePosition.x,
				this.livePosition.y,
				10 / this.scale,
				0,
				Math.PI * 2
			);
			this.ctx.fill();
		}

		// ----- screen space -----
		if (typeof this.afterDraw === "function") {
			this.ctx.save();
			// Reset to CSS pixel space (because resize() setTransform(dpr,...) already)
			// In draw() we overwrote it with image transform, so restore identity for overlays.
			this.ctx.setTransform(1, 0, 0, 1, 0, 0);
			this.afterDraw(this.ctx);
			this.ctx.restore();
		}
	}
}

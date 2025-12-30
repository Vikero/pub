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

		this.markers = [];
		this.livePosition = null;

		window.addEventListener("resize", () => this.resize());
		this.bindEvents();
	}

	setImage(img) {
		this.image = img;
		this.resize(); // fit image to canvas
	}

	setMarkers(markers) {
		this.markers = markers;
		this.draw();
	}

	addCalibrationMarker(pt) {
		this.markers.push({ x: pt.x, y: pt.y, color: "blue" });
		this.draw();
	}

	setLivePosition(pt) {
		this.livePosition = pt;
		this.draw();
	}

	screenToImage(screenPt) {
		if (!this.image) return { x: 0, y: 0 };
		return {
			x: (screenPt.x - this.offsetX) / this.scale,
			y: (screenPt.y - this.offsetY) / this.scale,
		};
	}

	resize() {
		if (!this.image) return;

		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		const scaleX = this.canvas.width / this.image.width;
		const scaleY = this.canvas.height / this.image.height;
		this.scale = Math.min(scaleX, scaleY);

		this.offsetX = (this.canvas.width - this.image.width * this.scale) / 2;
		this.offsetY = (this.canvas.height - this.image.height * this.scale) / 2;

		this.draw();
	}

	bindEvents() {
		// Pointer events for pan / pinch
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
				// PAN
				const dx = curr.x - prev.x;
				const dy = curr.y - prev.y;
				this.offsetX += dx;
				this.offsetY += dy;
				this.draw();
			}

			if (this.pointers.size === 2) {
				// PINCH ZOOM
				const pts = [...this.pointers.values()];
				const dx = pts[0].x - pts[1].x;
				const dy = pts[0].y - pts[1].y;
				const dist = Math.hypot(dx, dy);

				if (this.lastPinchDistance) {
					const zoomFactor = dist / this.lastPinchDistance;
					const midX = (pts[0].x + pts[1].x) / 2;
					const midY = (pts[0].y + pts[1].y) / 2;
					const rect = this.canvas.getBoundingClientRect();
					this.zoomAt({ x: midX - rect.left, y: midY - rect.top }, zoomFactor);
				}

				this.lastPinchDistance = dist;
			}
		});

		this.canvas.addEventListener("pointerup", (e) => {
			this.pointers.delete(e.pointerId);
			if (this.pointers.size < 2) this.lastPinchDistance = null;
		});

		this.canvas.addEventListener("pointercancel", (e) => {
			this.pointers.clear();
			this.lastPinchDistance = null;
		});

		// Desktop wheel zoom
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

		// Clear canvas
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Transform for pan & zoom
		this.ctx.setTransform(
			this.scale,
			0,
			0,
			this.scale,
			this.offsetX,
			this.offsetY
		);

		// Draw image
		this.ctx.drawImage(this.image, 0, 0);

		// Draw calibration markers
		for (const m of this.markers) {
			this.ctx.fillStyle = m.color || "blue";
			this.ctx.beginPath();
			this.ctx.arc(m.x, m.y, 8 / this.scale, 0, Math.PI * 2);
			this.ctx.fill();
		}

		// Draw live GPS dot
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
	}
}

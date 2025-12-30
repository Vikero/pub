// render.js

export class Renderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");

		this.image = null;

		this.scale = 1;
		this.offsetX = 0;
		this.offsetY = 0;

		this.dpr = window.devicePixelRatio || 1;

		this.markers = []; // { x, y, color }

		this.isPanning = false;
		this.lastPointer = null;
		this.lastPinchDist = null;

		this.resize();
		window.addEventListener("resize", () => this.resize());

		this.attachEvents();
	}

	resize() {
		const rect = this.canvas.getBoundingClientRect();
		this.canvas.width = rect.width * this.dpr;
		this.canvas.height = rect.height * this.dpr;
		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		this.draw();
	}

	setImage(img) {
		this.image = img;

		// --- Fit image to canvas ---
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = rect.width / img.width;
		const scaleY = rect.height / img.height;
		this.scale = Math.min(scaleX, scaleY);

		this.offsetX = (rect.width - img.width * this.scale) / 2;
		this.offsetY = (rect.height - img.height * this.scale) / 2;

		this.draw();
	}

	setMarkers(markers) {
		this.markers = markers;
		this.draw();
	}

	imageToScreen(pt) {
		return {
			x: pt.x * this.scale + this.offsetX,
			y: pt.y * this.scale + this.offsetY,
		};
	}

	screenToImage(pt) {
		return {
			x: (pt.x - this.offsetX) / this.scale,
			y: (pt.y - this.offsetY) / this.scale,
		};
	}

	draw() {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (!this.image) return;

		ctx.save();
		ctx.translate(this.offsetX, this.offsetY);
		ctx.scale(this.scale, this.scale);
		ctx.drawImage(this.image, 0, 0);
		ctx.restore();

		// --- Markers ---
		for (const m of this.markers) {
			const p = this.imageToScreen(m);
			ctx.beginPath();
			ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
			ctx.fillStyle = m.color;
			ctx.fill();
		}
	}

	attachEvents() {
		// Mouse wheel zoom
		this.canvas.addEventListener("wheel", (e) => {
			e.preventDefault();
			const zoom = e.deltaY < 0 ? 1.1 : 0.9;
			this.zoomAt({ x: e.offsetX, y: e.offsetY }, zoom);
		});

		// Pointer events (pan + pinch)
		this.canvas.addEventListener("pointerdown", (e) => {
			this.canvas.setPointerCapture(e.pointerId);
			this.isPanning = true;
			this.lastPointer = { x: e.clientX, y: e.clientY };
		});

		this.canvas.addEventListener("pointermove", (e) => {
			if (!this.isPanning) return;

			const dx = e.clientX - this.lastPointer.x;
			const dy = e.clientY - this.lastPointer.y;

			this.offsetX += dx;
			this.offsetY += dy;

			this.lastPointer = { x: e.clientX, y: e.clientY };
			this.draw();
		});

		this.canvas.addEventListener("pointerup", () => {
			this.isPanning = false;
			this.lastPointer = null;
		});
	}

	zoomAt(screenPt, factor) {
		const before = this.screenToImage(screenPt);
		this.scale *= factor;
		const after = this.screenToImage(screenPt);

		this.offsetX += (after.x - before.x) * this.scale;
		this.offsetY += (after.y - before.y) * this.scale;

		this.draw();
	}
}

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

		this.marker = null;

		this.resize();
		window.addEventListener("resize", () => this.resize());
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
		this.scale = 1;
		this.offsetX = 0;
		this.offsetY = 0;
		this.draw();
	}

	setMarker(pt) {
		this.marker = pt;
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

		if (this.marker) {
			const p = this.imageToScreen(this.marker);
			ctx.beginPath();
			ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
			ctx.fillStyle = "red";
			ctx.fill();
		}
	}
}

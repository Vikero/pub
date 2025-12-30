export class Calibration {
	constructor() {
		this.pointA = null;
		this.pointB = null;
		this.ready = false;
	}

	reset() {
		this.pointA = null;
		this.pointB = null;
		this.ready = false;
	}

	setPointA(imagePt, gps) {
		this.pointA = { image: imagePt, gps };
	}

	setPointB(imagePt, gps) {
		this.pointB = { image: imagePt, gps };
	}

	compute() {
		if (!this.pointA || !this.pointB) return;

		// Compute scale & translation
		const dx = this.pointB.image.x - this.pointA.image.x;
		const dy = this.pointB.image.y - this.pointA.image.y;
		const dLat = this.pointB.gps.lat - this.pointA.gps.lat;
		const dLon = this.pointB.gps.lon - this.pointA.gps.lon;

		this.scaleX = dx / dLon;
		this.scaleY = dy / dLat;
		this.offsetX = this.pointA.image.x - this.pointA.gps.lon * this.scaleX;
		this.offsetY = this.pointA.image.y - this.pointA.gps.lat * this.scaleY;

		this.ready = true;
	}

	project(gps) {
		if (!this.ready) return null;

		return {
			x: gps.lon * this.scaleX + this.offsetX,
			y: gps.lat * this.scaleY + this.offsetY,
		};
	}
}

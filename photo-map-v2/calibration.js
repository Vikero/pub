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

	// --- helper: lat/lon -> local meters relative to a reference point ---
	// Returns a local tangent-plane approximation:
	// +x = east (meters), +y = south (meters) to match image/canvas y-down
	latLonToMeters(lat, lon, refLat, refLon) {
		const R = 6378137;
		const rad = Math.PI / 180;

		const dLat = (lat - refLat) * rad;
		const dLon = (lon - refLon) * rad;

		const x = dLon * R * Math.cos(refLat * rad);
		const y = -dLat * R; // north becomes negative => up on screen

		return { x, y };
	}

	compute() {
		if (!this.pointA || !this.pointB) return;

		const refLat = this.pointA.gps.lat;
		const refLon = this.pointA.gps.lon;

		const A_m = this.latLonToMeters(
			this.pointA.gps.lat,
			this.pointA.gps.lon,
			refLat,
			refLon
		);

		const B_m = this.latLonToMeters(
			this.pointB.gps.lat,
			this.pointB.gps.lon,
			refLat,
			refLon
		);

		const dWorldX = B_m.x - A_m.x;
		const dWorldY = B_m.y - A_m.y;

		const dImgX = this.pointB.image.x - this.pointA.image.x;
		const dImgY = this.pointB.image.y - this.pointA.image.y;

		const distWorld = Math.hypot(dWorldX, dWorldY);
		const distImg = Math.hypot(dImgX, dImgY);

		this.scale = distImg / distWorld;

		const angleWorld = Math.atan2(dWorldY, dWorldX);
		const angleImg = Math.atan2(dImgY, dImgX);
		this.rotation = angleImg - angleWorld;

		console.log("[calib] distWorld", distWorld, "distImg", distImg);
		console.log("[calib] angleWorld(deg)", (angleWorld * 180) / Math.PI);
		console.log("[calib] angleImg(deg)", (angleImg * 180) / Math.PI);
		console.log("[calib] rotation(deg)", (this.rotation * 180) / Math.PI);

		this.originWorld = A_m;
		this.originImage = this.pointA.image;

		this.ready = true;
	}

	project(gps) {
		if (!this.ready) return null;

		const refLat = this.pointA.gps.lat;
		const refLon = this.pointA.gps.lon;

		const p = this.latLonToMeters(gps.lat, gps.lon, refLat, refLon);

		const dx = p.x - this.originWorld.x;
		const dy = p.y - this.originWorld.y;

		const cos = Math.cos(this.rotation);
		const sin = Math.sin(this.rotation);

		const rx = dx * cos - dy * sin;
		const ry = dx * sin + dy * cos;

		return {
			x: this.originImage.x + rx * this.scale,
			y: this.originImage.y + ry * this.scale,
		};
	}

	getDebugInfo() {
		if (!this.ready) return null;
		return {
			scale: this.scale,
			rotationRad: this.rotation,
			rotationDeg: (this.rotation * 180) / Math.PI,
			originImage: this.originImage,
			originWorld: this.originWorld,
		};
	}
}

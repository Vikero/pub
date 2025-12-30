// calibration.js
// Pure calibration math + state (no DOM, no canvas)

const EARTH_RADIUS = 6378137; // meters

export class Calibration {
	constructor() {
		this.pointA = null;
		this.pointB = null;
	}

	reset() {
		this.pointA = null;
		this.pointB = null;
	}

	isReady() {
		return !!(this.pointA && this.pointB);
	}

	setPointA(imagePt, gps) {
		this.pointA = {
			image: imagePt,
			gps,
		};
	}

	setPointB(imagePt, gps) {
		this.pointB = {
			image: imagePt,
			gps,
		};
	}

	// Convert lat/lon difference to local meters (simple, good enough for trekking)
	static gpsDeltaMeters(a, b) {
		const latRad = (a.lat * Math.PI) / 180;
		const dLat = ((b.lat - a.lat) * Math.PI) / 180;
		const dLon = ((b.lon - a.lon) * Math.PI) / 180;

		const x = dLon * Math.cos(latRad) * EARTH_RADIUS;
		const y = dLat * EARTH_RADIUS;

		return { x, y };
	}

	project(gps) {
		if (!this.isReady()) return null;

		const { pointA, pointB } = this;

		// Image delta
		const dxImg = pointB.image.x - pointA.image.x;
		const dyImg = pointB.image.y - pointA.image.y;

		// World delta (meters)
		const dWorld = Calibration.gpsDeltaMeters(pointA.gps, pointB.gps);

		const distImg = Math.hypot(dxImg, dyImg);
		const distWorld = Math.hypot(dWorld.x, dWorld.y);

		if (distWorld === 0 || distImg === 0) return null;

		const scale = distImg / distWorld;

		const angleImg = Math.atan2(dyImg, dxImg);
		const angleWorld = Math.atan2(dWorld.y, dWorld.x);
		const rotation = angleImg - angleWorld;

		// Current GPS delta from A
		const dNow = Calibration.gpsDeltaMeters(pointA.gps, gps);

		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);

		const xImg = pointA.image.x + (dNow.x * cos - dNow.y * sin) * scale;

		const yImg = pointA.image.y + (dNow.x * sin + dNow.y * cos) * scale;

		return { x: xImg, y: yImg };
	}
}

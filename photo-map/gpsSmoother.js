// gpsSmoother.js

export class GPSSmoother {
	constructor(maxPoints = 5) {
		this.maxPoints = maxPoints;
		this.buffer = [];
	}

	add(point) {
		this.buffer.push(point);

		if (this.buffer.length > this.maxPoints) {
			this.buffer.shift();
		}
	}

	getAveraged() {
		if (this.buffer.length === 0) return null;

		let sumLat = 0;
		let sumLon = 0;

		for (const p of this.buffer) {
			sumLat += p.lat;
			sumLon += p.lon;
		}

		return {
			lat: sumLat / this.buffer.length,
			lon: sumLon / this.buffer.length,
		};
	}

	reset() {
		this.buffer.length = 0;
	}
}

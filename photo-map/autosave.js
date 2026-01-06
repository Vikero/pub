const AUTOSAVE_KEY = "photo-map.autosave.v1";

/**
 * @typedef {{
 *   v: 1,
 *   savedAt: number,
 *   calibrationStep: number,
 *   pointA: null | { image: {x:number,y:number}, gps: {lat:number,lon:number} },
 *   pointB: null | { image: {x:number,y:number}, gps: {lat:number,lon:number} }
 * }} AutosaveState
 */

export function loadAutosave() {
	try {
		const raw = localStorage.getItem(AUTOSAVE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || parsed.v !== 1) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearAutosave() {
	try {
		localStorage.removeItem(AUTOSAVE_KEY);
	} catch {
		// ignore
	}
}

export function saveAutosave({ calibrationStep, pointA, pointB }) {
	/** @type {AutosaveState} */
	const state = {
		v: 1,
		savedAt: Date.now(),
		calibrationStep: calibrationStep ?? 0,
		pointA: pointA
			? {
					image: { x: pointA.image.x, y: pointA.image.y },
					gps: { lat: pointA.gps.lat, lon: pointA.gps.lon },
			  }
			: null,
		pointB: pointB
			? {
					image: { x: pointB.image.x, y: pointB.image.y },
					gps: { lat: pointB.gps.lat, lon: pointB.gps.lon },
			  }
			: null,
	};

	try {
		localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
		return true;
	} catch {
		return false;
	}
}

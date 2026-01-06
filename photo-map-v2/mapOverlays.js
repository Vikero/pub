function pickNiceMeters(metersPerPixel, targetPx = 120) {
	if (!isFinite(metersPerPixel) || metersPerPixel <= 0) return null;

	const raw = metersPerPixel * targetPx;
	const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
	const candidates = [1, 2, 5, 10].map((k) => k * pow10);

	let best = candidates[0];
	for (const c of candidates) {
		if (Math.abs(c - raw) < Math.abs(best - raw)) best = c;
	}
	return best;
}

function drawCirclePlate(ctx, cx, cy, r) {
	ctx.save();
	ctx.fillStyle = "rgba(0,0,0,0.35)";
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	ctx.strokeStyle = "rgba(255,255,255,0.18)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function drawCompassNeedle(ctx, cx, cy, nx, ny, r) {
	// Diamond needle centered at (cx,cy), pointing (nx,ny).
	// Red north tip + white south tip.

	// Normalize direction
	const nLen = Math.hypot(nx, ny) || 1;
	const ux = nx / nLen;
	const uy = ny / nLen;

	// Perpendicular
	const px = -uy;
	const py = ux;

	const len = r * 0.72;
	const halfW = r * 0.18;

	const tipN = { x: cx + ux * len, y: cy + uy * len };
	const tipS = { x: cx - ux * len, y: cy - uy * len };
	const left = { x: cx + px * halfW, y: cy + py * halfW };
	const right = { x: cx - px * halfW, y: cy - py * halfW };

	ctx.save();

	// North (red) half
	ctx.fillStyle = "rgba(220,40,40,0.95)";
	ctx.beginPath();
	ctx.moveTo(tipN.x, tipN.y);
	ctx.lineTo(left.x, left.y);
	ctx.lineTo(cx, cy);
	ctx.lineTo(right.x, right.y);
	ctx.closePath();
	ctx.fill();

	// South (white) half
	ctx.fillStyle = "rgba(255,255,255,0.95)";
	ctx.beginPath();
	ctx.moveTo(tipS.x, tipS.y);
	ctx.lineTo(right.x, right.y);
	ctx.lineTo(cx, cy);
	ctx.lineTo(left.x, left.y);
	ctx.closePath();
	ctx.fill();

	// Outline
	ctx.strokeStyle = "rgba(0,0,0,0.35)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(tipN.x, tipN.y);
	ctx.lineTo(left.x, left.y);
	ctx.lineTo(tipS.x, tipS.y);
	ctx.lineTo(right.x, right.y);
	ctx.closePath();
	ctx.stroke();

	ctx.restore();
}

export class MapOverlays {
	constructor() {
		this.enabled = true;
		this.showNorthArrow = true;
		this.showScaleBar = true;

		// NEW
		this.showQA = true;
		this.qa = null; // { step, samples, minSamples, seconds, qaPercent, locked }
	}

	// NEW
	setQA(qaState) {
		this.qa = qaState;
	}

	draw({ ctx, canvas, renderer, calibration }) {
		if (!this.enabled) return;

		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);

		// QA should be visible even before calibration is ready
		if (this.showQA) this.drawQA({ ctx, canvas });

		// These require calibration
		if (calibration?.ready) {
			if (this.showNorthArrow)
				this.drawNorthArrow({ ctx, canvas, calibration });
			if (this.showScaleBar)
				this.drawScaleBar({ ctx, canvas, renderer, calibration });
		}

		ctx.restore();
	}

	// NEW
	drawQA({ ctx, canvas }) {
		if (!this.qa) return;

		const pad = 12;
		const x = pad;
		const y = pad + 60;

		const w = 170;
		const h = 54;

		const { step, samples, minSamples, seconds, qaPercent, locked } = this.qa;

		let title = "";
		if (step === 7) title = "QA: A stability";
		else if (step === 5) title = "QA: A quality";
		else return;

		const progress =
			minSamples > 0 ? Math.min(1, (samples || 0) / minSamples) : 0;

		ctx.save();
		ctx.fillStyle = "rgba(0,0,0,0.35)";
		ctx.fillRect(x, y, w, h);

		ctx.strokeStyle = "rgba(255,255,255,0.18)";
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, w, h);

		ctx.fillStyle = "rgba(255,255,255,0.95)";
		ctx.font = "12px system-ui, sans-serif";
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		ctx.fillText(title, x + 8, y + 6);

		const line2 =
			qaPercent != null
				? `${(qaPercent * 100).toFixed(0)}%${locked ? " (locked)" : ""}`
				: `${samples}/${minSamples} samples • ${seconds}s`;

		ctx.font = "11px system-ui, sans-serif";
		ctx.fillStyle = "rgba(255,255,255,0.85)";
		ctx.fillText(line2, x + 8, y + 24);

		// progress bar
		const bx = x + 8;
		const by = y + 40;
		const bw = w - 16;
		const bh = 8;

		ctx.fillStyle = "rgba(255,255,255,0.18)";
		ctx.fillRect(bx, by, bw, bh);

		ctx.fillStyle = locked ? "rgba(70,200,120,0.95)" : "rgba(255,255,255,0.75)";
		ctx.fillRect(bx, by, bw * progress, bh);

		ctx.restore();
	}

	drawNorthArrow({ ctx, canvas, calibration }) {
		// World north (0,-1) mapped into image coords via rotation:
		// (sin(theta), -cos(theta))
		const theta = calibration.rotation;
		const nx = Math.sin(theta);
		const ny = -Math.cos(theta);

		const pad = 12;

		// Reduced by ~30% vs 32
		const r = 22;

		// Top-right
		const cx = canvas.width - pad - r;
		const cy = pad + r;

		drawCirclePlate(ctx, cx, cy, r);
		drawCompassNeedle(ctx, cx, cy, nx, ny, r);
	}

	drawScaleBar({ ctx, canvas, renderer, calibration }) {
		const pxPerMeter = calibration.scale * renderer.scale;
		if (!isFinite(pxPerMeter) || pxPerMeter <= 0) return;

		const metersPerPixel = 1 / pxPerMeter;

		// Slightly smaller target width so it fits under the compass
		const meters = pickNiceMeters(metersPerPixel, 120);
		if (!meters) return;

		const barPx = meters * pxPerMeter;

		// Position top-right, below compass
		const pad = 12;
		const r = 22;
		const gap = 8;

		const plateH = 28;
		const plateW = Math.max(90, Math.min(240, barPx + 22));

		const x0 = canvas.width - pad - plateW + 8; // plate has -8 inset below
		const yTop = pad + 2 * r + gap;

		ctx.save();

		// background plate
		ctx.fillStyle = "rgba(0,0,0,0.35)";
		ctx.fillRect(x0 - 8, yTop, plateW, plateH);

		const barX = x0;
		const barY = yTop + 18;

		// bar
		ctx.strokeStyle = "rgba(255,255,255,0.95)";
		ctx.lineWidth = 2;
		ctx.lineCap = "butt";
		ctx.beginPath();
		ctx.moveTo(barX, barY);
		ctx.lineTo(barX + barPx, barY);
		ctx.stroke();

		// ticks
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(barX, barY - 5);
		ctx.lineTo(barX, barY + 5);
		ctx.moveTo(barX + barPx, barY - 5);
		ctx.lineTo(barX + barPx, barY + 5);
		ctx.stroke();

		// label
		ctx.fillStyle = "rgba(255,255,255,0.95)";
		ctx.font = "11px system-ui, sans-serif";
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillText(`${meters} m`, barX, yTop + 9);

		ctx.restore();
	}
}

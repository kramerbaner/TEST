function clamp01(x) {
	return Math.max(0, Math.min(1, x));
}

function smoothstep(edge0, edge1, x) {
	const t = clamp01((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

// rises 0->1 over [0,rise], holds at 1, falls 1->0 over [1-fall,1]
function bump(f, rise = 0.2, fall = 0.2) {
	if (f < rise) return smoothstep(0, rise, f);
	if (f > 1 - fall) return smoothstep(1, 1 - fall, f);
	return 1;
}

const REST = {
	hipsTilt: 0, chestTilt: 0, hipsY: 0,
	neckX: 0, neckY: 0, neckZ: 0,
	jawOpen: 0,
	eyeScaleL: 1, eyeScaleR: 1,
	earLZ: 0, earRZ: 0,
	tailBaseX: 0, tailBaseY: 0,
	legFL_hip: 0, legFL_knee: 0.1,
	legFR_hip: 0, legFR_knee: 0.1,
	legBL_hip: 0, legBL_knee: 0.1,
	legBR_hip: 0, legBR_knee: 0.1, legBR_hipZ: 0,
};

export const ACTIONS = {
	lickPaw: { duration: 4.0, weight: 3 },
	scratch: { duration: 3.0, weight: 2 },
	yawn: { duration: 2.2, weight: 2 },
	stretch: { duration: 3.6, weight: 2 },
};

export function pickRandomAction() {
	const names = Object.keys(ACTIONS);
	const total = names.reduce((s, n) => s + ACTIONS[n].weight, 0);
	let r = Math.random() * total;
	for (const n of names) {
		r -= ACTIONS[n].weight;
		if (r <= 0) return n;
	}
	return names[0];
}

function actionPose(name, f) {
	const p = {};
	if (name === 'lickPaw') {
		const env = bump(f, 0.1, 0.1);
		const cyclePhase = f * 3;
		const local = cyclePhase % 1;
		const s = Math.sin(Math.PI * local);
		p.hipsY = -0.05 * env;
		p.legBL_knee = 0.5 * env;
		p.legBR_knee = 0.5 * env;
		p.legFR_hip = -0.95 * s * env;
		p.legFR_knee = 0.7 * s * env;
		p.neckX = -0.32 * s * env;
		p.neckZ = 0.16 * s * env;
		p.jawOpen = 0.18 * Math.max(0, Math.sin(Math.PI * local * 2)) * env;
	} else if (name === 'scratch') {
		const env = bump(f, 0.15, 0.15);
		p.hipsY = -0.04 * env;
		p.legBL_knee = 0.45 * env;
		p.legBR_hip = -0.7 * env;
		p.legBR_knee = 0.9 * env;
		p.legBR_hipZ = 0.35 * Math.sin(f * 42) * env;
		p.neckZ = 0.32 * env;
		p.neckX = -0.08 * env;
		p.earRZ = -0.3 * env;
	} else if (name === 'yawn') {
		const s = Math.sin(Math.PI * f);
		p.neckX = -0.55 * s;
		p.jawOpen = 0.95 * s;
		p.eyeScaleL = 1 - 0.75 * s;
		p.eyeScaleR = 1 - 0.75 * s;
		p.earLZ = -0.22 * s;
		p.earRZ = -0.22 * s;
	} else if (name === 'stretch') {
		const shape = bump(f, 0.22, 0.22);
		const yawnBump = smoothstep(0, 0.2, f) * smoothstep(0.55, 0.3, f);
		p.chestTilt = 0.55 * shape;
		p.hipsTilt = -0.22 * shape;
		p.legFL_hip = -0.75 * shape;
		p.legFR_hip = -0.75 * shape;
		p.legFL_knee = 0.08 * (1 - shape);
		p.legFR_knee = 0.08 * (1 - shape);
		p.tailBaseX = 0.5 * shape;
		p.jawOpen = 0.5 * Math.max(0, yawnBump);
		p.neckX = -0.15 * yawnBump;
	}
	return p;
}

export class CatAnimator {
	constructor(joints) {
		this.joints = joints;
		this.pose = { ...REST };
		this.time = 0;
		this.walkPhase = 0;
		this.state = 'idle'; // 'idle' | 'walking' | 'action'
		this.currentAction = null;
		this.nextActionAt = 2 + Math.random() * 2;
		this.currentActionName = null;
	}

	notifyInputActivity() {
		if (this.state === 'action') {
			this.currentAction = null;
			this.currentActionName = null;
		}
		this.state = 'walking';
		this.nextActionAt = this.time + 4 + Math.random() * 4;
	}

	update(dt, { isMoving, speedFactor = 0 } = {}) {
		this.time += dt;
		let target = { ...REST };

		if (isMoving) {
			this.state = 'walking';
			this.currentAction = null;
			this.currentActionName = null;
			this.walkPhase += dt * (4 + speedFactor * 4);
			const amp = 0.55;
			const ph = this.walkPhase;
			target.legFL_hip = amp * Math.sin(ph);
			target.legBR_hip = amp * Math.sin(ph);
			target.legFR_hip = amp * Math.sin(ph + Math.PI);
			target.legBL_hip = amp * Math.sin(ph + Math.PI);
			target.legFL_knee = 0.15 + Math.max(0, Math.sin(ph)) * 0.35;
			target.legBR_knee = 0.15 + Math.max(0, Math.sin(ph)) * 0.35;
			target.legFR_knee = 0.15 + Math.max(0, Math.sin(ph + Math.PI)) * 0.35;
			target.legBL_knee = 0.15 + Math.max(0, Math.sin(ph + Math.PI)) * 0.35;
			target.chestTilt = 0.05 * Math.sin(ph * 2);
			target.hipsTilt = -0.05 * Math.sin(ph * 2);
			target.tailBaseY = 0.25 * Math.sin(ph * 0.5);
			target.tailBaseX = 0.1;
		} else {
			if (this.state === 'walking') {
				this.state = 'idle';
				this.nextActionAt = this.time + 3.5 + Math.random() * 3;
			}

			if (this.currentAction) {
				this.currentAction.elapsed += dt;
				const f = clamp01(this.currentAction.elapsed / this.currentAction.duration);
				target = { ...REST, ...actionPose(this.currentAction.name, f) };
				if (f >= 1) {
					this.currentAction = null;
					this.currentActionName = null;
					this.state = 'idle';
					this.nextActionAt = this.time + 4 + Math.random() * 5;
				}
			} else {
				// ambient idle breathing / sway / blink
				const breathe = 1 + 0.025 * Math.sin(this.time * 1.6);
				target.tailBaseY = 0.12 * Math.sin(this.time * 0.6);
				target.tailBaseX = 0.05 * Math.sin(this.time * 0.4);
				target.earLZ = 0.03 * Math.sin(this.time * 1.3);
				target.earRZ = 0.03 * Math.sin(this.time * 1.7 + 1);
				const blinkPhase = this.time % 4.5;
				if (blinkPhase < 0.15) {
					const b = Math.sin((blinkPhase / 0.15) * Math.PI);
					target.eyeScaleL = 1 - 0.85 * b;
					target.eyeScaleR = 1 - 0.85 * b;
				}
				this._breathe = breathe;

				if (this.state === 'idle' && this.time >= this.nextActionAt) {
					this.currentActionName = pickRandomAction();
					this.currentAction = { name: this.currentActionName, elapsed: 0, duration: ACTIONS[this.currentActionName].duration };
					this.state = 'action';
				}
			}
		}

		const k = 1 - Math.exp(-dt * 10);
		for (const key in this.pose) {
			this.pose[key] += (target[key] - this.pose[key]) * k;
		}

		this._apply();
	}

	_apply() {
		const j = this.joints;
		const p = this.pose;

		j.hipsPivot.rotation.x = p.hipsTilt;
		j.hipsPivot.position.y = j.baseHipY + p.hipsY;
		j.chestPivot.rotation.x = p.chestTilt;

		j.neck.rotation.x = p.neckX;
		j.neck.rotation.y = p.neckY;
		j.neck.rotation.z = p.neckZ;

		j.jaw.rotation.x = p.jawOpen;

		j.eyeL.scale.y = Math.max(0.05, p.eyeScaleL);
		j.eyeR.scale.y = Math.max(0.05, p.eyeScaleR);

		j.earL.rotation.z += 0; // base rotation set at creation; twitch layered via userData offset
		j.earL.rotation.x = 0.15 + p.earLZ;
		j.earR.rotation.x = 0.15 + p.earRZ;

		j.tailBase.rotation.x = 0.35 - p.tailBaseX;
		j.tailBase.rotation.y = p.tailBaseY;
		j.tailMid.rotation.x = 0.15 - p.tailBaseX * 0.6;
		j.tailTip.rotation.x = -0.2 - p.tailBaseX * 0.4;

		j.legFL.hip.rotation.x = p.legFL_hip;
		j.legFL.knee.rotation.x = p.legFL_knee;
		j.legFR.hip.rotation.x = p.legFR_hip;
		j.legFR.knee.rotation.x = p.legFR_knee;
		j.legBL.hip.rotation.x = p.legBL_hip;
		j.legBL.knee.rotation.x = p.legBL_knee;
		j.legBR.hip.rotation.x = p.legBR_hip;
		j.legBR.hip.rotation.z = p.legBR_hipZ;
		j.legBR.knee.rotation.x = p.legBR_knee;

		if (this._breathe) {
			j.frontBody.scale.set(this._breathe, 1, this._breathe);
		}
	}
}

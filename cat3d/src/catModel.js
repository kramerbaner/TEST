import * as THREE from 'three';

export const PALETTE = {
	pink: 0xf3b7c4,
	white: 0xfdf8f3,
	black: 0x2f2b2e,
	eyePink: 0xe8607e,
	eyeOrange: 0xf2a53c,
	pupil: 0x181414,
	nose: 0xe8869a,
	innerEar: 0xf7d9e0,
};

function toonGradientTexture() {
	const size = 4;
	const data = new Uint8Array(size);
	for (let i = 0; i < size; i++) data[i] = Math.floor((i / (size - 1)) * 255);
	const tex = new THREE.DataTexture(data, size, 1, THREE.RedFormat);
	tex.needsUpdate = true;
	tex.magFilter = THREE.NearestFilter;
	tex.minFilter = THREE.NearestFilter;
	return tex;
}

const gradientMap = toonGradientTexture();

function makePart(geometry, color, opts = {}) {
	const mat = new THREE.MeshToonMaterial({ color, gradientMap });
	const mesh = new THREE.Mesh(geometry, mat);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	if (opts.outline !== false) {
		const outlineMat = new THREE.MeshBasicMaterial({ color: PALETTE.black, side: THREE.BackSide });
		const outlineMesh = new THREE.Mesh(geometry, outlineMat);
		const s = opts.outlineScale || 1.08;
		outlineMesh.scale.set(s, s, s);
		mesh.add(outlineMesh);
	}
	return mesh;
}

function makeLeg(parent, x, z, footColor) {
	const hip = new THREE.Group();
	hip.position.set(x, 0, z);
	parent.add(hip);

	const thigh = makePart(new THREE.CapsuleGeometry(0.09, 0.14, 4, 8), PALETTE.pink, { outlineScale: 1.1 });
	thigh.position.y = -0.11;
	hip.add(thigh);

	const knee = new THREE.Group();
	knee.position.y = -0.22;
	hip.add(knee);

	const shin = makePart(new THREE.CapsuleGeometry(0.075, 0.12, 4, 8), PALETTE.white, { outlineScale: 1.12 });
	shin.position.y = -0.1;
	knee.add(shin);

	const paw = makePart(new THREE.SphereGeometry(0.085, 10, 8), footColor, { outlineScale: 1.12 });
	paw.position.y = -0.21;
	knee.add(paw);

	return { hip, knee };
}

export function createCat() {
	const root = new THREE.Group();
	const baseHipY = 0.5;

	// ---- Hips (rear) ----
	const hipsPivot = new THREE.Group();
	hipsPivot.position.set(0, baseHipY, 0.26);
	root.add(hipsPivot);

	const rearBody = makePart(new THREE.CapsuleGeometry(0.3, 0.32, 6, 10), PALETTE.pink);
	rearBody.rotation.x = Math.PI / 2;
	rearBody.position.z = 0.12;
	hipsPivot.add(rearBody);

	const flankPatch = makePart(new THREE.SphereGeometry(0.22, 10, 8), PALETTE.black, { outline: false });
	flankPatch.scale.set(0.9, 0.8, 0.55);
	flankPatch.position.set(-0.22, 0.05, 0.18);
	hipsPivot.add(flankPatch);

	const legBL = makeLeg(hipsPivot, 0.19, 0.12, PALETTE.white);
	const legBR = makeLeg(hipsPivot, -0.19, 0.12, PALETTE.black);

	// ---- Tail ----
	const tailBase = new THREE.Group();
	tailBase.position.set(0, 0.1, 0.36);
	tailBase.rotation.x = 0.35;
	hipsPivot.add(tailBase);
	const tailSeg1 = makePart(new THREE.CylinderGeometry(0.055, 0.065, 0.24, 8), PALETTE.pink, { outlineScale: 1.15 });
	tailSeg1.position.z = 0.12;
	tailSeg1.rotation.x = Math.PI / 2;
	tailBase.add(tailSeg1);

	const tailMid = new THREE.Group();
	tailMid.position.z = 0.24;
	tailMid.rotation.x = 0.15;
	tailBase.add(tailMid);
	const tailSeg2 = makePart(new THREE.CylinderGeometry(0.045, 0.055, 0.2, 8), PALETTE.pink, { outlineScale: 1.15 });
	tailSeg2.position.z = 0.1;
	tailSeg2.rotation.x = Math.PI / 2;
	tailMid.add(tailSeg2);

	const tailTip = new THREE.Group();
	tailTip.position.z = 0.2;
	tailTip.rotation.x = -0.2;
	tailMid.add(tailTip);
	const tailSeg3 = makePart(new THREE.CylinderGeometry(0.025, 0.045, 0.18, 8), PALETTE.black, { outlineScale: 1.15 });
	tailSeg3.position.z = 0.09;
	tailSeg3.rotation.x = Math.PI / 2;
	tailTip.add(tailSeg3);

	// ---- Chest (front) ----
	const chestPivot = new THREE.Group();
	chestPivot.position.set(0, baseHipY, -0.26);
	root.add(chestPivot);

	const frontBody = makePart(new THREE.CapsuleGeometry(0.28, 0.28, 6, 10), PALETTE.white);
	frontBody.rotation.x = Math.PI / 2;
	frontBody.position.z = -0.08;
	chestPivot.add(frontBody);

	const legFL = makeLeg(chestPivot, 0.18, -0.14, PALETTE.white);
	const legFR = makeLeg(chestPivot, -0.18, -0.14, PALETTE.white);

	// ---- Neck / Head ----
	const neck = new THREE.Group();
	neck.position.set(0, 0.22, -0.32);
	chestPivot.add(neck);

	const head = new THREE.Group();
	head.position.set(0, 0.05, -0.1);
	neck.add(head);

	const headMesh = makePart(new THREE.SphereGeometry(0.24, 14, 12), PALETTE.white);
	headMesh.scale.set(1, 0.92, 1);
	head.add(headMesh);

	const headPatch = makePart(new THREE.SphereGeometry(0.19, 12, 10), PALETTE.black, { outline: false });
	headPatch.scale.set(0.85, 0.9, 0.6);
	headPatch.position.set(-0.12, 0.05, -0.05);
	head.add(headPatch);

	// ears
	function makeEar(x, color, innerColor) {
		const ear = new THREE.Group();
		ear.position.set(x, 0.21, -0.02);
		ear.rotation.z = x > 0 ? -0.35 : 0.35;
		ear.rotation.x = 0.15;
		const outer = makePart(new THREE.ConeGeometry(0.11, 0.18, 8), color, { outlineScale: 1.12 });
		outer.scale.z = 0.5;
		outer.position.y = 0.07;
		ear.add(outer);
		const inner = makePart(new THREE.ConeGeometry(0.06, 0.11, 8), innerColor, { outline: false });
		inner.scale.z = 0.4;
		inner.position.set(0, 0.06, 0.02);
		ear.add(inner);
		head.add(ear);
		return ear;
	}
	const earL = makeEar(0.13, PALETTE.pink, PALETTE.innerEar);
	const earR = makeEar(-0.13, PALETTE.black, PALETTE.innerEar);

	// eyes
	function makeEye(x, color) {
		const eye = makePart(new THREE.SphereGeometry(0.052, 10, 8), color, { outline: false });
		eye.position.set(x, 0.02, -0.205);
		head.add(eye);
		const pupil = makePart(new THREE.SphereGeometry(0.026, 8, 6), PALETTE.pupil, { outline: false });
		pupil.position.set(x, 0.02, -0.235);
		head.add(pupil);
		return eye;
	}
	const eyeL = makeEye(0.11, PALETTE.eyePink);
	const eyeR = makeEye(-0.11, PALETTE.eyeOrange);

	// nose
	const nose = makePart(new THREE.ConeGeometry(0.035, 0.04, 6), PALETTE.nose, { outline: false });
	nose.rotation.x = Math.PI / 2;
	nose.position.set(0, -0.04, -0.235);
	head.add(nose);

	// jaw
	const jaw = new THREE.Group();
	jaw.position.set(0, -0.07, -0.14);
	head.add(jaw);
	const jawMesh = makePart(new THREE.SphereGeometry(0.13, 10, 8), PALETTE.white, { outlineScale: 1.1 });
	jawMesh.scale.set(0.9, 0.6, 0.85);
	jawMesh.position.set(0, -0.02, -0.07);
	jaw.add(jawMesh);

	const mouthDark = makePart(new THREE.SphereGeometry(0.075, 8, 6), 0x5a2a30, { outline: false });
	mouthDark.scale.set(1, 0.7, 0.6);
	mouthDark.position.set(0, -0.09, -0.16);
	head.add(mouthDark);

	// whiskers
	function makeWhiskers(x) {
		const group = new THREE.Group();
		group.position.set(x, -0.02, -0.16);
		const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
		[-0.15, 0, 0.15].forEach((angle, i) => {
			const len = 0.22 - i * 0.02;
			const points = [
				new THREE.Vector3(0, 0, 0),
				new THREE.Vector3(x > 0 ? len : -len, angle * 0.5, angle),
			];
			const geo = new THREE.BufferGeometry().setFromPoints(points);
			const line = new THREE.Line(geo, mat);
			group.add(line);
		});
		head.add(group);
	}
	makeWhiskers(0.14);
	makeWhiskers(-0.14);

	root.castShadow = true;

	const joints = {
		hipsPivot,
		chestPivot,
		baseHipY,
		neck,
		jaw,
		eyeL,
		eyeR,
		earL,
		earR,
		tailBase,
		tailMid,
		tailTip,
		frontBody,
		legFL,
		legFR,
		legBL,
		legBR,
	};

	return { group: root, joints };
}

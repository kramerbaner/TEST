import * as THREE from 'three';
import { createCat } from './catModel.js';
import { CatAnimator, ACTIONS } from './catAnimator.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe6f2);
scene.fog = new THREE.Fog(0xbfe6f2, 12, 30);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);

// ---- Lights ----
const hemi = new THREE.HemisphereLight(0xffffff, 0xd9c2a6, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
sun.position.set(4, 8, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
scene.add(sun);

// ---- Ground ----
const groundGeo = new THREE.CircleGeometry(20, 48);
const groundMat = new THREE.MeshToonMaterial({ color: 0xbfe6b0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20, 0x8fc77f, 0x8fc77f);
grid.position.y = 0.005;
grid.material.opacity = 0.35;
grid.material.transparent = true;
scene.add(grid);

// ---- Cat ----
const { group: cat, joints } = createCat();
scene.add(cat);
const animator = new CatAnimator(joints);

// ---- Input ----
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function isDown(...codes) {
	return codes.some((c) => keys[c]);
}

// ---- Camera orbit (mouse drag) & zoom ----
let camYaw = 0;
let camDistance = 4.2;
let camHeight = 0.9;
let dragging = false;
let lastPointer = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
	dragging = true;
	lastPointer = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', (e) => {
	if (!dragging) return;
	const dx = e.clientX - lastPointer.x;
	camYaw -= dx * 0.005;
	lastPointer = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', (e) => {
	camDistance = THREE.MathUtils.clamp(camDistance + e.deltaY * 0.002, 1.6, 7);
}, { passive: true });

// ---- Movement state ----
const moveSpeed = 1.6;
const runMultiplier = 1.9;
const turnSpeed = 2.6;
let jumpT = -1;
const jumpDuration = 0.55;

const statusEl = document.getElementById('status');

function updateStatusText() {
	if (animator.state === 'action' && animator.currentActionName) {
		const labels = {
			lickPaw: 'liże łapkę \u{1F43E}',
			scratch: 'drapie się',
			yawn: 'ziewa \u{1F62A}',
			stretch: 'przeciąga się',
		};
		statusEl.textContent = labels[animator.currentActionName] || '...';
	} else if (animator.state === 'walking') {
		statusEl.textContent = 'spaceruje';
	} else {
		statusEl.textContent = 'odpoczywa';
	}
}

const clock = new THREE.Clock();

function animate() {
	requestAnimationFrame(animate);
	const dt = Math.min(clock.getDelta(), 0.05);

	const forward = (isDown('KeyW', 'ArrowUp') ? 1 : 0) - (isDown('KeyS', 'ArrowDown') ? 1 : 0);
	const turn = (isDown('KeyA', 'ArrowLeft') ? 1 : 0) - (isDown('KeyD', 'ArrowRight') ? 1 : 0);
	const running = isDown('ShiftLeft', 'ShiftRight');
	const isMoving = forward !== 0 || turn !== 0;

	if (isMoving) {
		animator.notifyInputActivity();
		const speed = moveSpeed * (running ? runMultiplier : 1);
		cat.rotation.y += turn * turnSpeed * dt;
		cat.position.x -= Math.sin(cat.rotation.y) * forward * speed * dt;
		cat.position.z -= Math.cos(cat.rotation.y) * forward * speed * dt;
		cat.position.x = THREE.MathUtils.clamp(cat.position.x, -9.5, 9.5);
		cat.position.z = THREE.MathUtils.clamp(cat.position.z, -9.5, 9.5);
	}

	if (isDown('Space') && jumpT < 0) {
		jumpT = 0;
		animator.notifyInputActivity();
	}
	if (jumpT >= 0) {
		jumpT += dt;
		const f = jumpT / jumpDuration;
		if (f >= 1) {
			jumpT = -1;
			cat.position.y = 0;
		} else {
			cat.position.y = Math.sin(Math.PI * f) * 0.45;
		}
	}

	animator.update(dt, { isMoving, speedFactor: running ? 1 : 0 });

	// camera chase
	const desiredYaw = cat.rotation.y + camYaw;
	const camX = cat.position.x + Math.sin(desiredYaw) * camDistance;
	const camZ = cat.position.z + Math.cos(desiredYaw) * camDistance;
	const camY = cat.position.y + camHeight;
	camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 5);
	camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 5);
	camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 5);
	camera.lookAt(cat.position.x, cat.position.y + 0.5, cat.position.z);

	updateStatusText();
	renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

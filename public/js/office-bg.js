// ============================================================
// Premium Office Walkthrough — Blender GLB model
// Scroll-driven camera walkthrough with mouse look
// ============================================================

export async function initOfficeBackground() {
  if (document.getElementById('office-bg')) return;

  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js');
  const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/DRACOLoader.js');

  const container = document.createElement('div');
  container.id = 'office-bg';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
  document.body.prepend(container);

  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);
  scene.fog = new THREE.Fog(0x020208, 10, 70);

  // Our own camera — ignore GLB camera
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);

  // GLB import: Blender Y-forward becomes Three.js -Z
  // Blender (0, 5, 1.65) -> Three.js (0, 1.65, -5)
  // Camera needs to look down -Z (Three.js forward)
  camera.position.set(0, 1.65, -5);
  camera.lookAt(0, 1.65, -20);
  scene.add(camera);

  // Add basic ambient light so MeshStandardMaterial isn't black
  scene.add(new THREE.AmbientLight(0xfff0e0, 0.5));
  const sun = new THREE.DirectionalLight(0xffc870, 1.0);
  sun.position.set(-5, 8, 5);
  scene.add(sun);

  // === LOAD GLB ===
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/libs/draco/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load('/models/office.glb', resolve, undefined, reject);
    });

    scene.add(gltf.scene);

    // Log what we loaded
    let meshCount = 0;
    gltf.scene.traverse((child) => {
      if (child.isMesh) meshCount++;
      // Remove any cameras from the GLB so they don't interfere
      if (child.isCamera) child.visible = false;
    });

    console.log('[Office] Loaded:', meshCount, 'meshes');
  } catch (err) {
    console.error('[Office] Failed to load GLB:', err);
    return;
  }

  // === SCROLL-DRIVEN CAMERA ===
  // Corridor goes from Y=5 to Y=-105 in Blender
  // In Three.js after GLB import: Z=-(-5)=5 to Z=-(-(-105))=-105...
  // Actually GLB swaps: Blender +Y -> Three.js -Z
  // So start Z = -5 (Blender Y=5), end Z = 105 (Blender Y=-105)
  const camStartZ = -5;
  const camEndZ = 105;

  let scrollProgress = 0, targetScroll = 0;

  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    targetScroll = h > 0 ? window.scrollY / h : 0;
  }, { passive: true });

  let mouseX = 0, mouseY = 0, smoothMX = 0, smoothMY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // === RENDER ===
  let lastFrame = 0;
  const frameInt = isMobile ? 33 : 16;

  function animate(now) {
    requestAnimationFrame(animate);
    if (now - lastFrame < frameInt) return;
    lastFrame = now;

    const ease = prefersReducedMotion ? 0.1 : 0.03;
    scrollProgress += (targetScroll - scrollProgress) * ease;
    smoothMX += (mouseX - smoothMX) * 0.03;
    smoothMY += (mouseY - smoothMY) * 0.03;

    // Walk forward through corridor
    camera.position.z = camStartZ + scrollProgress * (camEndZ - camStartZ);
    camera.position.y = 1.65 + Math.sin(scrollProgress * 30) * 0.015;
    camera.position.x = Math.sin(scrollProgress * 15) * 0.02;

    // Reset rotation then apply look direction + mouse
    camera.rotation.set(0, 0, 0);
    camera.rotateY(Math.PI + smoothMX * 0.1); // Face -Z direction + mouse horizontal
    camera.rotateX(-smoothMY * 0.05);          // Mouse vertical

    // Move sun with camera
    sun.position.set(-5, 8, camera.position.z + 5);

    renderer.render(scene, camera);
  }
  animate(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

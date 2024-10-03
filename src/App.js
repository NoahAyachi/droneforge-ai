import * as THREE from 'three';
import DroneScene from './scenes/DroneScene';
import DroneControls from './controls/DroneControls';
import PhysicsEngine from './physics/PhysicsEngine';

class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new DroneScene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.controls = new DroneControls(this.camera, this.renderer.domElement);
    this.physicsEngine = new PhysicsEngine(this.controls);
  }

  async init() {
    document.body.appendChild(this.renderer.domElement);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene.init();
    await this.physicsEngine.init(this.scene);

    // Set up camera position
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(this.scene.position);

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    this.animate();
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    this.physicsEngine.update(1/60);  // Assuming 60 FPS
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

export default App;

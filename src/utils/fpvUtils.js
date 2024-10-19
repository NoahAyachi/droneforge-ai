import * as THREE from 'three';
import { runInferenceOnFrameCapture } from '../inference/modelHelper';
import { pixelDataToTensor } from './imageHelper';

/**
 * @function createFPVDisplay
 * @description Creates the First Person View display and returns the FPV renderer.
 * @returns {THREE.WebGLRenderer} The FPV renderer.
 */
export function createFPVDisplay() {
    console.log('Creating FPV display...');
    const fpvDisplay = document.createElement('div');
    fpvDisplay.style.position = 'absolute';
    fpvDisplay.style.top = '10px';
    fpvDisplay.style.left = '10px';
    fpvDisplay.style.width = '384px';
    fpvDisplay.style.height = '216px';
    fpvDisplay.style.border = '2px solid white';
    document.body.appendChild(fpvDisplay);
    console.log('FPV display created:', fpvDisplay);

    const fpvCanvas = document.createElement('canvas');
    fpvCanvas.width = 384;
    fpvCanvas.height = 216;
    fpvDisplay.appendChild(fpvCanvas);

    const fpvRenderer = new THREE.WebGLRenderer({ canvas: fpvCanvas });
    fpvRenderer.setSize(384, 216);

    return fpvRenderer;
}

/**
 * @function captureFPVSnapshot
 * @description Captures a snapshot from the FPV display and returns it as a pixel array.
 * @param {THREE.WebGLRenderer} fpvRenderer - The FPV renderer.
 * @returns {Uint8ClampedArray} A pixel array of the FPV snapshot.
 */
export function captureFPVSnapshot(fpvRenderer) {
    if (fpvRenderer && fpvRenderer.domElement) {
      const gl = fpvRenderer.getContext();
      const width = fpvRenderer.domElement.width;
      const height = fpvRenderer.domElement.height;
  
      // Log dimensions
      console.log('Canvas width:', width, 'Canvas height:', height);
  
      if (width === 0 || height === 0) {
        console.error('Canvas width or height is zero. Unable to capture pixel data.');
        return null;
      }
  
      const pixelData = new Uint8Array(width * height * 4);  // RGBA format
  
      // Read pixels from the current framebuffer
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
    
      return pixelData;
    } else {
      console.error('FPV Renderer or canvas not initialized.');
      return null;
    }
  }
  

/**
 * @function downloadImage
 * @description Downloads the image from a base64 data URL.
 * @param {string} dataURL - The base64 data URL of the image.
 * @param {string} filename - The name of the file to be downloaded.
 */
export function downloadImage(dataURL, filename = 'snapshot.png') {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * @function displayImage
 * @description Displays the image from pixel data in an img element.
 * @param {Uint8ClampedArray} pixelData - The pixel data of the image.
 * @param {number} width - The width of the image.
 * @param {number} height - The height of the image.
 */
export function displayImage(pixelData, width, height) {
  if (!pixelData || pixelData.length !== width * height * 4) {
    console.error('Invalid pixel data or dimensions');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(new Uint8ClampedArray(pixelData), width, height);
  ctx.putImageData(imageData, 0, 0);

  const img = document.createElement('img');
  img.src = canvas.toDataURL();
  img.style.position = 'absolute';
  img.style.bottom = '10px';
  img.style.left = '10px';
  img.style.border = '2px solid white';
  img.style.zIndex = '1000'; // Ensure it is on top of other elements
  document.body.appendChild(img);
}

/**
 * @function startFrameCapture
 * @description Starts capturing frames at a specified interval and displays them.
 * @param {THREE.WebGLRenderer} fpvRenderer - The FPV renderer.
 * @param {THREE.Scene} scene - The scene to render.
 * @param {THREE.Camera} camera - The camera to use for rendering.
 * @param {number} interval - The interval in milliseconds between frame captures.
 */
export function startFrameCapture(fpvRenderer, scene, camera, interval = 10000) {
    const captureAndDisplayFrame = async () => {
        // Render the scene with the FPV camera
        fpvRenderer.render(scene, camera);

        // Capture the pixel data directly from the WebGL canvas
        const pixelData = captureFPVSnapshot(fpvRenderer);
        const width = fpvRenderer.domElement.width;
        const height = fpvRenderer.domElement.height;
        if (pixelData) {
            console.log('Pixel data captured:', pixelData);

            // Convert the pixel data directly into a tensor
            const inputTensor = pixelDataToTensor(pixelData, [1, 3, height * 2, width * 2]);
            console.log('Input tensor dimensions:', inputTensor.dims); // Log the dimensions
            console.log('Input tensor:', inputTensor);

            // Run inference on the captured frame
            // try {
            //     const outputData = await runInferenceOnFrameCapture(inputTensor);
            //     console.log('Inference output:', outputData);
            // } catch (error) {
            //     console.error('Error during inference:', error);
            // }
        }
    };

    captureAndDisplayFrame();

    setInterval(captureAndDisplayFrame, interval);
}
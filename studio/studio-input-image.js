import * as THREE from 'three';
import { drawInputImage } from './studio-input-display.js';

export async function createInputTexture(renderer, input, signal) {
  const { canvas, ...metadata } = await drawInputImage(input, 1536, signal);
  signal?.throwIfAborted();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  texture.userData.inputImage = metadata;
  return texture;
}

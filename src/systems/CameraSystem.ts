import { BASE_WIDTH, BASE_HEIGHT, MAP_WIDTH, MAP_HEIGHT, SCALE_X, SCALE_Y } from '../constants.ts';
import { Ant } from '../Ant.ts';

export class CameraSystem {
  zoom: number = 0.5;
  targetZoom: number = 0.5;
  offsetX: number = 0;
  offsetY: number = 0;
  targetOffsetX: number = 0;
  targetOffsetY: number = 0;

  // Screen shake state
  private shakeIntensity: number = 0;
  shakeOffsetX: number = 0;
  shakeOffsetY: number = 0;

  update(deltaTime: number, isIntroPan: boolean = false): void {
    // Smooth camera zoom and offset with eased interpolation
    // Slower interpolation during intro pan for cinematic effect
    const lerpSpeed = isIntroPan ? 1.5 : 4;
    const cameraLerpFactor = Math.min(1, deltaTime * lerpSpeed);
    const zoomDiff = this.targetZoom - this.zoom;
    const xDiff = this.targetOffsetX - this.offsetX;
    const yDiff = this.targetOffsetY - this.offsetY;
    this.zoom += zoomDiff * this.easeOutCubic(cameraLerpFactor);
    this.offsetX += xDiff * this.easeOutCubic(cameraLerpFactor);
    this.offsetY += yDiff * this.easeOutCubic(cameraLerpFactor);
  }

  updateScreenShake(deltaTime: number): void {
    if (this.shakeIntensity > 0) {
      // Random offset based on intensity
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;

      // Decay the shake intensity
      this.shakeIntensity -= deltaTime * 40; // Decay over ~0.3 seconds
      if (this.shakeIntensity < 0) {
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }
  }

  triggerScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // Apply camera transform with a parallax factor (0 = no movement, 1 = full movement)
  applyTransform(ctx: CanvasRenderingContext2D, parallaxFactor: number): void {
    const offsetX = this.offsetX * parallaxFactor;
    const offsetY = this.offsetY * parallaxFactor;
    const zoom = 1 + (this.zoom - 1) * parallaxFactor;

    ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-BASE_WIDTH / 2 + offsetX, -BASE_HEIGHT / 2 + offsetY);

    // Apply screen shake (reduced for background)
    if (this.shakeIntensity > 0) {
      ctx.translate(this.shakeOffsetX * parallaxFactor, this.shakeOffsetY * parallaxFactor);
    }
  }

  // Clamp camera offset to keep view within map bounds
  clampOffset(offsetX: number, offsetY: number): { x: number; y: number } {
    const minOffsetX = BASE_WIDTH - MAP_WIDTH;
    const maxOffsetX = 0;
    const minOffsetY = BASE_HEIGHT - MAP_HEIGHT;
    const maxOffsetY = 0;

    return {
      x: Math.max(minOffsetX, Math.min(maxOffsetX, offsetX)),
      y: Math.max(minOffsetY, Math.min(maxOffsetY, offsetY))
    };
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Account for canvas scaling
    const scaledX = screenX / SCALE_X;
    const scaledY = screenY / SCALE_Y;

    // Reverse camera transform
    const worldX = (scaledX - BASE_WIDTH / 2) / this.zoom - this.offsetX + BASE_WIDTH / 2;
    const worldY = (scaledY - BASE_HEIGHT / 2) / this.zoom - this.offsetY + BASE_HEIGHT / 2;

    return { x: worldX, y: worldY };
  }

  // Focus camera on a specific ant
  focusOnAnt(ant: Ant, immediate: boolean = false): void {
    let offsetX = BASE_WIDTH / 2 - ant.x;
    let offsetY = BASE_HEIGHT / 2 - ant.y;

    // Clamp to map bounds
    const clamped = this.clampOffset(offsetX, offsetY);
    this.targetOffsetX = clamped.x;
    this.targetOffsetY = clamped.y;
    this.targetZoom = 0.5;

    // Snap immediately if requested
    if (immediate) {
      this.offsetX = this.targetOffsetX;
      this.offsetY = this.targetOffsetY;
      this.zoom = this.targetZoom;
    }
  }

  // Focus camera on a projectile
  focusOnProjectile(x: number, y: number): void {
    const clamped = this.clampOffset(
      BASE_WIDTH / 2 - x,
      BASE_HEIGHT / 2 - y
    );
    this.targetOffsetX = clamped.x;
    this.targetOffsetY = clamped.y;
    this.targetZoom = 0.55; // Slight zoom in when following projectile
  }

  // Reset to default zoom
  resetZoom(): void {
    this.targetZoom = 0.5;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}

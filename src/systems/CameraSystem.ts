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

  constructor() {
    // Initialize with properly clamped offsets to center on map
    const initialOffset = this.clampOffset(0, 0, this.zoom);
    this.offsetX = initialOffset.x;
    this.offsetY = initialOffset.y;
    this.targetOffsetX = initialOffset.x;
    this.targetOffsetY = initialOffset.y;
  }

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

    // Always clamp offset to prevent showing outside map bounds during transitions
    const clamped = this.clampOffset(this.offsetX, this.offsetY);
    this.offsetX = clamped.x;
    this.offsetY = clamped.y;
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

  // Clamp camera offset to keep view within map bounds (accounting for zoom)
  // The transform is: translate(center) -> scale(zoom) -> translate(-center + offset)
  // World point wx appears at screen_x = (wx - BASE_WIDTH/2 + offsetX) * zoom + BASE_WIDTH/2
  // To center on wx: offsetX = BASE_WIDTH/2 - wx
  clampOffset(offsetX: number, offsetY: number, zoom?: number): { x: number; y: number } {
    const z = zoom ?? this.zoom;

    // Calculate visible world dimensions at this zoom
    const visibleWidth = BASE_WIDTH / z;
    const visibleHeight = BASE_HEIGHT / z;

    // Calculate valid offset ranges
    // For left edge (screen_x=0) to show world_x >= 0: offsetX <= BASE_WIDTH/2 * (1 - 1/z)
    // For right edge (screen_x=BASE_WIDTH) to show world_x <= MAP_WIDTH: offsetX >= BASE_WIDTH/2 + BASE_WIDTH/(2*z) - MAP_WIDTH

    let minOffsetX = BASE_WIDTH / 2 + BASE_WIDTH / (2 * z) - MAP_WIDTH;
    let maxOffsetX = BASE_WIDTH / 2 * (1 - 1 / z);

    let minOffsetY = BASE_HEIGHT / 2 + BASE_HEIGHT / (2 * z) - MAP_HEIGHT;
    let maxOffsetY = BASE_HEIGHT / 2 * (1 - 1 / z);

    // If visible area is larger than map, center on the map instead
    if (visibleWidth >= MAP_WIDTH) {
      // Center horizontally on the map
      const centerOffsetX = BASE_WIDTH / 2 - MAP_WIDTH / 2;
      minOffsetX = maxOffsetX = centerOffsetX;
    }
    if (visibleHeight >= MAP_HEIGHT) {
      // Center vertically on the map
      const centerOffsetY = BASE_HEIGHT / 2 - MAP_HEIGHT / 2;
      minOffsetY = maxOffsetY = centerOffsetY;
    }

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

    const targetZoom = 0.5;
    // Clamp to map bounds (using target zoom)
    const clamped = this.clampOffset(offsetX, offsetY, targetZoom);
    this.targetOffsetX = clamped.x;
    this.targetOffsetY = clamped.y;
    this.targetZoom = targetZoom;

    // Snap immediately if requested
    if (immediate) {
      this.offsetX = this.targetOffsetX;
      this.offsetY = this.targetOffsetY;
      this.zoom = this.targetZoom;
    }
  }

  // Focus camera on a projectile (only if within map bounds)
  focusOnProjectile(x: number, y: number): void {
    // Clamp the target position to map bounds so camera doesn't follow projectile outside
    const clampedX = Math.max(0, Math.min(MAP_WIDTH, x));
    const clampedY = Math.max(0, Math.min(MAP_HEIGHT, y));

    const targetZoom = 0.55; // Slight zoom in when following projectile
    const clamped = this.clampOffset(
      BASE_WIDTH / 2 - clampedX,
      BASE_HEIGHT / 2 - clampedY,
      targetZoom
    );
    this.targetOffsetX = clamped.x;
    this.targetOffsetY = clamped.y;
    this.targetZoom = targetZoom;
  }

  // Reset to default zoom
  resetZoom(): void {
    this.targetZoom = 0.5;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}

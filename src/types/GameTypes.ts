export type GameState = 'MENU' | 'INTRO_PAN' | 'PLAYING' | 'AI_THINKING' | 'AI_MOVING' | 'FIRING' | 'PAUSED' | 'SETTINGS' | 'GAME_OVER';
export type GameMode = 'single' | 'multi';

export interface MenuItem {
  label: string;
  action: () => void;
}

export interface PlayerStats {
  shotsFired: number;
  hits: number;
  damageDealt: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  scale: number;
  isCritical: boolean;
}

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
}

export interface Firework {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  exploded: boolean;
  color: string;
  sparks: FireworkSpark[];
}

export interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
}

export interface HUDHealthAnimation {
  current: number;
  target: number;
}

// Weather type enum
export type WeatherType = 'clear' | 'rain' | 'fog' | 'snow' | 'sandstorm';

// Weather configuration interface
export interface WeatherConfig {
  type: WeatherType;
  windModifier: number;       // Multiplier for wind effect
  visibility: number;         // 0-1, percentage of normal visibility
  atmosphereColor: string;    // Color tint for atmosphere overlay
  atmosphereAlpha: number;    // Opacity of atmosphere overlay
  particleCount: number;      // Number of particles to spawn
  transitionDuration: number; // Time in seconds to transition to this weather
}

// Particle interfaces
export interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

export interface Snowflake {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  wobblePhase: number;
  wobbleSpeed: number;
  fallSpeed: number;
  opacity: number;
}

export interface FogLayer {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  speed: number;
  depth: number; // 0-1, affects parallax
}

export interface SandParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
  wavePhase: number;
  trail: Array<{ x: number; y: number }>;
}

export interface LightningBolt {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  opacity: number;
  life: number;
  maxLife: number;
}

// Terrain compatibility map
export const TERRAIN_WEATHER_COMPATIBILITY: Record<string, WeatherType[]> = {
  'Grassland': ['clear', 'rain', 'fog', 'snow'],
  'Desert': ['clear', 'sandstorm'],
  'Arctic': ['clear', 'fog', 'snow'],
  'Volcanic': ['clear', 'rain', 'fog', 'sandstorm'],
  'Autumn': ['clear', 'rain', 'fog', 'snow'],
  'Martian': ['clear', 'sandstorm'],
};

// Weather configurations
export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  clear: {
    type: 'clear',
    windModifier: 1.0,
    visibility: 1.0,
    atmosphereColor: 'transparent',
    atmosphereAlpha: 0,
    particleCount: 0,
    transitionDuration: 2.0,
  },
  rain: {
    type: 'rain',
    windModifier: 1.5,
    visibility: 0.7,
    atmosphereColor: '#4A6080',
    atmosphereAlpha: 0.25,
    particleCount: 400,
    transitionDuration: 3.0,
  },
  fog: {
    type: 'fog',
    windModifier: 0.8,
    visibility: 0.4,
    atmosphereColor: '#8090A0',
    atmosphereAlpha: 0.4,
    particleCount: 8, // Number of fog layers
    transitionDuration: 4.0,
  },
  snow: {
    type: 'snow',
    windModifier: 0.7,
    visibility: 0.6,
    atmosphereColor: '#C0D0E8',
    atmosphereAlpha: 0.15,
    particleCount: 300,
    transitionDuration: 3.5,
  },
  sandstorm: {
    type: 'sandstorm',
    windModifier: 2.5,
    visibility: 0.3,
    atmosphereColor: '#C8A060',
    atmosphereAlpha: 0.5,
    particleCount: 600,
    transitionDuration: 2.5,
  },
};

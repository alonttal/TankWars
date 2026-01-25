import { WeatherSystem } from '../../systems/WeatherSystem.ts';

export interface WeatherTypeRenderer {
  renderBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void;
  renderForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void;
}

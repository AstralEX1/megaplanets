import blue from './mystery-planets/blue.png';
import cyan from './mystery-planets/cyan.png';
import green from './mystery-planets/green.png';
import lime from './mystery-planets/lime.png';
import magenta from './mystery-planets/magenta.png';
import orange from './mystery-planets/orange.png';
import red from './mystery-planets/red.png';
import violet from './mystery-planets/violet.png';

export const MYSTERY_PLANET_IMAGES = [
  blue,
  cyan,
  green,
  lime,
  magenta,
  orange,
  red,
  violet,
] as const;

export function randomMysteryPlanet(random: () => number = Math.random) {
  const index = Math.min(
    MYSTERY_PLANET_IMAGES.length - 1,
    Math.floor(random() * MYSTERY_PLANET_IMAGES.length),
  );
  return MYSTERY_PLANET_IMAGES[index];
}

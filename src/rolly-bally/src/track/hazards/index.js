// Moving hazards by type name (as used in piece features: {type:'hazard', hazard}).
import { Hammer } from './Hammer.js';
import { WreckingBall } from './WreckingBall.js';
import { Spinner } from './Spinner.js';
import { MovingPlatform } from './MovingPlatform.js';

export { Hammer, WreckingBall, Spinner, MovingPlatform };

export const HAZARDS = {
  hammer: Hammer,
  wreckingBall: WreckingBall,
  spinner: Spinner,
  movingPlatform: MovingPlatform,
};

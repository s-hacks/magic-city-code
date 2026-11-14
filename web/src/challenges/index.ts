import { routeChallenge } from './route';
import { trappedReach, trappedRoute, trappedUnderpass } from './trains';

// Register new challenges here.
export const challenges = {
  [routeChallenge.id]: routeChallenge,
  [trappedReach.id]: trappedReach,
  [trappedRoute.id]: trappedRoute,
  [trappedUnderpass.id]: trappedUnderpass,
};

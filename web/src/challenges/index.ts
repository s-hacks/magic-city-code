import { routeChallenge } from './route';
import { vanChallenge } from './van';
import { billsChallenge } from './bills';
import { bedsChallenge } from './beds';
import { leaksChallenge } from './leaks';
import { groceryChallenge } from './grocery';
import { floodChallenge } from './flood';
import { trappedChallenge } from './trapped';

// Register new challenges here.
export const challenges = {
  [routeChallenge.id]: routeChallenge,
  [vanChallenge.id]: vanChallenge,
  [billsChallenge.id]: billsChallenge,
  [bedsChallenge.id]: bedsChallenge,
  [leaksChallenge.id]: leaksChallenge,
  [groceryChallenge.id]: groceryChallenge,
  [floodChallenge.id]: floodChallenge,
  [trappedChallenge.id]: trappedChallenge,
};

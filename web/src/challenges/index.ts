import { routeChallenge } from './route';
import { vanChallenge } from './van';
import { billsChallenge } from './bills';
import { bedsChallenge } from './beds';

// Register new challenges here.
export const challenges = {
  [routeChallenge.id]: routeChallenge,
  [vanChallenge.id]: vanChallenge,
  [billsChallenge.id]: billsChallenge,
  [bedsChallenge.id]: bedsChallenge,
};

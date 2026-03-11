/**
 * Developer simulation script.
 * Run with:  npx tsx scripts/simulate.ts
 * Or:        node --loader ts-node/esm scripts/simulate.ts
 */
import { simulate, printSimResult } from '../src/game/math/simulate.js';

const rounds = parseInt(process.argv[2] ?? '1000000', 10);
console.log(`Running ${rounds.toLocaleString()} round simulation...\n`);
const result = simulate(rounds);
printSimResult(result);

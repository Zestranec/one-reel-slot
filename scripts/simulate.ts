/**
 * Developer simulation script — runs all three bot strategies.
 * Run with:  npx tsx scripts/simulate.ts [rounds]
 */
import { simulate, printSimResult, type BotStrategy } from '../src/game/math/simulate.js';

const rounds = parseInt(process.argv[2] ?? '1000000', 10);

const strategies: BotStrategy[] = ['greedy', 'medium', 'chaser'];

for (const strategy of strategies) {
  console.log(`\nRunning ${rounds.toLocaleString()} rounds — ${strategy} strategy...\n`);
  const result = simulate(rounds, 1, undefined, strategy);
  printSimResult(result);
}

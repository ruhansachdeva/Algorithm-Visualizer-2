#!/usr/bin/env node
/* ============================================================
   Run every test suite.

       node tests/run.mjs            all of them
       node tests/run.mjs sorting    just the ones whose name matches

   Exits non-zero if anything failed, so it works in a script.
   ============================================================ */

const SUITES = [
  './catalogue.test.mjs',
  './seeding.test.mjs',
  './inputs.test.mjs',
  './complexity.test.mjs',
  './practice.test.mjs',
  './sorting.test.mjs',
  './searching.test.mjs',
  './pathfinding.test.mjs',
  './graphs.test.mjs',
  './maxflow.test.mjs',
  './trees.test.mjs',
  './segment.test.mjs',
  './dp.test.mjs',
  './strings.test.mjs',
  './backtracking.test.mjs',
  './math-geometry.test.mjs',
  // Last on purpose: it checks the pages rather than the algorithms, and
  // keeping it away from the suites above means two branches adding a
  // suite each do not land on the same line.
  './markup.test.mjs',
];

const filter = process.argv[2]?.toLowerCase();

let totalChecks = 0;
let totalFailures = 0;
const started = Date.now();

for (const path of SUITES) {
  const suite = await import(path);
  if (filter && !suite.name.toLowerCase().includes(filter)) continue;

  const { failures, checks, messages } = await suite.run();
  totalChecks += checks;
  totalFailures += failures;

  const mark = failures === 0 ? '✓' : '✗';
  console.log(`${mark} ${suite.name.padEnd(26)} ${String(checks).padStart(5)} checks` +
              (failures ? `  ${failures} FAILED` : ''));

  // Show the first few failures; a broken algorithm usually trips many.
  for (const m of messages.slice(0, 8)) console.log(`    ${m}`);
  if (messages.length > 8) console.log(`    ... and ${messages.length - 8} more`);
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log('─'.repeat(52));
console.log(totalFailures === 0
  ? `All ${totalChecks.toLocaleString()} checks passed in ${secs}s`
  : `${totalFailures} of ${totalChecks.toLocaleString()} checks failed`);

process.exit(totalFailures === 0 ? 0 : 1);

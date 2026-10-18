#!/usr/bin/env node
/* Headless CPU-vs-CPU match runner: plays whole matches with the real engine and CPU code (no browser, no drawing)
   and checks that every round finishes, nobody leaves the yard, and nothing turns into NaN.

   node tools/soak.js [matches=200]             random 1P / 2P / co-op matches, companions called now and then
   node tools/soak.js 20 --maxRound 5           proves the check can fail: every round longer than 5 s is reported
   node tools/soak.js 100 --versus normal,easy  win counts: one CPU level against another
   node tools/soak.js 100 --versus kid,normal --calls   ...with the left one calling his brother every 6-14 s
   Exits with status 1 if any match had a problem. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'js');
for (const f of ['engine.js', 'cpu.js']) vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
const SB = globalThis.SB;

const args = process.argv.slice(2);
const n = parseInt(args.find((a) => /^\d+$/.test(a)) || '200', 10);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const o = {};
if (opt('maxRound')) o.maxRound = parseFloat(opt('maxRound'));
if (args.includes('--calls')) Object.assign(o, { callEvery: [6, 14], callSides: [0] }); // the left player calls his brother

const t0 = Date.now();
if (opt('versus')) {
  const [a, b] = opt('versus').split(',');
  console.log(SB.sim.versus(a, b, n, o));
} else {
  const r = SB.sim.soak(n, o);
  console.log(JSON.stringify(r, null, 2));
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s wall time`);
  process.exit(r.withProblems ? 1 : 0);
}

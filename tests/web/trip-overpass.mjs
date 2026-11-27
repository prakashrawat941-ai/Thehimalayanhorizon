import assert from 'node:assert/strict';
import { fetchOverpassElements } from '../../web/lib/trip/overpass.js';

const query = '[out:json][timeout:20];node(1);out;';
const primary = 'https://primary.example/interpreter';
const fallback = 'https://fallback.example/interpreter';
const element = { type: 'node', id: 1 };
let calls = [];
const sequence = (...outcomes) => {
  calls = [];
  return async (url, options) => {
    calls.push([url.href, options.body.get('data')]);
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
};
const run = (...outcomes) => fetchOverpassElements(query, { primary, fallback, fetcher: sequence(...outcomes) });
const success = () => Response.json({ elements: [element] });
assert.deepEqual(await run(new Response('', { status: 502 }), success()), [element]);
assert.deepEqual(calls.map(([url]) => url), [primary, fallback]);
assert.match(calls[0][1], /timeout:8/);
assert.match(calls[1][1], /timeout:11/);
assert.deepEqual(await run(new DOMException('TimeoutError', 'TimeoutError'), success()), [element]);
assert.deepEqual(await run(Response.json({ remark: 'partial', elements: [] }), success()), [element]);
await assert.rejects(run(new Response('', { status: 429 }), success()), /429/);
assert.equal(calls.length, 1);
await assert.rejects(run(new Response('', { status: 502 }), new Response('', { status: 503 })), /503/);
assert.equal(calls.length, 2);
console.log('PASS: 502, timeout and incomplete-response fallback, rate-limit handling and double failure.');

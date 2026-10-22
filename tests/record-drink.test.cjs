const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
function client(invoke) {
  const api = {};
  const code = ts.transpileModule(readFileSync('src/utils/record-drink.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'require', code)(api, () => ({ invoke }));
  return api;
}
test('manual requests use backend receipt and carry a stable retry ID', async () => {
  const calls = [];
  const receipt = { total: 1200, goal: 1500, added: false, date: '20261023', goalReached: false };
  const api = client(async (...args) => { calls.push(args); return receipt; });
  assert.equal(await api.recordDrink(200, 'retry-1'), receipt);
  await api.recordDrink(200, 'retry-1');
  assert.deepEqual(calls[0], ['record_drink', { amount: 200, requestId: 'retry-1', reminderSession: null }]);
  assert.deepEqual(calls[0], calls[1]);
});
test('reminder requests carry the shared session and propagate save failures', async () => {
  const api = client(async (command, args) => {
    assert.equal(command, 'record_drink');
    assert.equal(args.reminderSession, 'shared-session');
    throw new Error('disk full');
  });
  await assert.rejects(api.recordDrink(100, 'request', 'shared-session'), /disk full/);
});

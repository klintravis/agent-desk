// desk check's claude probe decides by exit code or spawn error, never by the shell's message text (T-261).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as desk from '../bin/desk.mjs';

const de = 'Der Befehl "claude" ist entweder falsch geschrieben oder konnte nicht gefunden werden.';
const noWhere = () => assert.fail('where must not run');

test('claude probe: a non-English "not found" reads as missing', () => {
  assert.equal(desk.claudeMissing({ status: 9009, stdout: '', stderr: de }, true, noWhere), true); // cmd
  assert.equal(desk.claudeMissing({ status: null, error: Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }) }, false, noWhere), true);
  assert.equal(desk.claudeMissing({ status: 1, stdout: '', stderr: de }, true, () => 1), true); // cmd plain 1, where says not found
});

test('claude probe: a claude that ran is present, even when it failed or says "not recognized"', () => {
  assert.equal(desk.claudeMissing({ status: 0, stdout: 'ok', stderr: '' }, true, noWhere), false);
  assert.equal(desk.claudeMissing({ status: 1, stdout: '', stderr: 'error: "x" is not recognized' }, false, noWhere), false);
  assert.equal(desk.claudeMissing({ status: 127, stdout: '', stderr: '' }, false, noWhere), false); // codes count only under cmd
  assert.equal(desk.claudeMissing({ status: 1, stdout: '', stderr: de }, true, () => 0), false); // where found it
  assert.equal(desk.claudeMissing({ status: 1, stdout: '', stderr: de }, true, () => 2), false); // where failed: not proof
  assert.equal(desk.claudeMissing({ status: 1, stdout: '', stderr: de }, true, () => null), false);
});

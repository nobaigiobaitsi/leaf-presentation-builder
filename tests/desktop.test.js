import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const { assetPath, fileName } = createRequire(import.meta.url)('../desktop/helpers.cjs');
test('desktop protocol confines file reads to application assets', () => {
  const root = path.resolve('desktop/dist');
  assert.equal(assetPath(root, 'leaf://app/'), path.join(root, 'index.html'));
  assert.equal(assetPath(root, 'leaf://app/assets/logo.jpg'), path.join(root, 'assets/logo.jpg'));
  for (const address of [
    'https://app/index.html',
    'leaf://other/index.html',
    'leaf://app/..%2f..%2fsecret',
    'leaf://app/%5csecret',
    'leaf://app/%00'
  ])
    assert.throws(() => assetPath(root, address));
});
test('suggested export names cannot introduce paths', () => {
  assert.equal(fileName('Πειραιάς', '.pdf'), 'Πειραιάς.pdf');
  assert.equal(fileName('../A:B', '.leaf.json'), '..-A-B.leaf.json');
  assert.equal(fileName('...', '.pdf'), 'LEAF-Presentation.pdf');
});

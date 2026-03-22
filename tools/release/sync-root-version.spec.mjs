import assert from 'node:assert/strict';
import test from 'node:test';

import { compareVersions, parseVersion, resolveTargetVersion } from './sync-root-version.mjs';

test('parseVersion() should parse rc prerelease identifiers', () => {
  assert.deepEqual(parseVersion('0.28.0-rc.3'), {
    major: 0,
    minor: 28,
    patch: 0,
    prerelease: ['rc', '3'],
    raw: '0.28.0-rc.3',
  });
});

test('compareVersions() should order rc prerelease numbers correctly', () => {
  assert.equal(compareVersions('0.28.0-rc.3', '0.28.0-rc.10') < 0, true);
  assert.equal(compareVersions('0.28.0-rc.10', '0.28.0-rc.3') > 0, true);
});

test('compareVersions() should treat stable releases as newer than matching rc prereleases', () => {
  assert.equal(compareVersions('0.28.0-rc.6', '0.28.0') < 0, true);
  assert.equal(compareVersions('0.28.0', '0.28.0-rc.6') > 0, true);
});

test('resolveTargetVersion() should choose the newest rc version when workspace packages are mixed', () => {
  assert.equal(resolveTargetVersion(['0.27.0-rc.5', '0.28.0-rc.0', '0.27.0-rc.6']), '0.28.0-rc.0');
});

test('resolveTargetVersion() should support mixed rc families and stable versions', () => {
  assert.equal(resolveTargetVersion(['0.27.0-rc.6', '0.28.0-rc.0', '0.27.0']), '0.28.0-rc.0');
});

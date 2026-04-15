import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getProjectStatus } from '../app/actions';

function withTempCwd(run: (tmpDir: string) => void) {
  const previousCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ram-actions-'));
  try {
    run(tmpDir);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('getProjectStatus returns an enhanced, text-to-speech friendly report', async () => {
  await withTempCwd(async (tmpDir) => {
    process.chdir(tmpDir);

    // Setup mock directory structure
    const iotDir = path.join(tmpDir, 'IOT', 'IOT-backups');
    fs.mkdirSync(iotDir, { recursive: true });
    fs.writeFileSync(path.join(iotDir, 'backup1.zip'), 'dummy');
    fs.writeFileSync(path.join(iotDir, 'backup2.zip'), 'dummy');

    const microMaxDir = path.join(tmpDir, 'MicroMax', 'OS', 'src');
    fs.mkdirSync(microMaxDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'MicroMax', 'SPEC.md'), '# MicroMax Spec');
    fs.writeFileSync(path.join(microMaxDir, 'main.cpp'), 'void setup() {}');

    const status = await getProjectStatus();

    // Enhanced output should be conversational, not bulleted
    assert.ok(!status.includes('- '), 'Status should be conversational and not use bullet points for TTS');
    assert.ok(status.includes('The latest IOT backup'), 'Should mention the latest IOT backup in a sentence');
    assert.ok(status.includes('MicroMax firmware'), 'Should mention MicroMax firmware specifically');
    assert.ok(status.includes('Operational'), 'Should indicate system health');
  });
});

test('getProjectStatus handles errors gracefully', async () => {
  await withTempCwd(async (tmpDir) => {
    process.chdir(tmpDir);

    // Mock readdirSync to throw an error
    mock.method(fs, 'readdirSync', () => {
      throw new Error('Disk Failure');
    });

    // We must ensure the path exists so readdirSync is actually called
    const iotPath = path.join(tmpDir, 'IOT', 'IOT-backups');
    fs.mkdirSync(iotPath, { recursive: true });

    const status = await getProjectStatus();
    
    // Restore the mock
    mock.restoreAll();

    assert.ok(status.includes('I encountered an error'), 'Should return a user-friendly error message');
    assert.ok(status.includes('Disk Failure'), 'Should include the original error message');
  });
});

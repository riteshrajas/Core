import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getProjectStatus, executeCLICommand, writeWorkspaceFile, readWorkspaceFile, deploySubAgent } from '../app/actions';

async function withTempCwd(run: (tmpDir: string) => Promise<void>) {
  const previousCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ram-actions-'));
  try {
    process.chdir(tmpDir);
    await run(tmpDir);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('getProjectStatus and File Actions', async (t) => {
  await withTempCwd(async (tmpDir) => {
    
    await t.test('getProjectStatus returns an enhanced report', async () => {
      // Setup mock directory structure
      const iotDir = path.join(tmpDir, 'IOT', 'IOT-backups');
      fs.mkdirSync(iotDir, { recursive: true });
      fs.writeFileSync(path.join(iotDir, 'backup1.zip'), 'dummy');

      const microMaxDir = path.join(tmpDir, 'MicroMax', 'OS', 'src');
      fs.mkdirSync(microMaxDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'MicroMax', 'SPEC.md'), '# MicroMax Spec');
      fs.writeFileSync(path.join(microMaxDir, 'main.cpp'), 'void setup() {}');

      const status = await getProjectStatus();
      assert.ok(!status.includes('- '), 'Status should be conversational');
      assert.ok(status.includes('The latest IOT backup'), 'Should mention IOT');
      assert.ok(status.includes('MicroMax firmware'), 'Should mention MicroMax');
    });

    await t.test('readWorkspaceFile and writeWorkspaceFile work for valid paths', async () => {
      const testFile = 'test-file.txt';
      const content = 'Hello Apex';
      
      const writeResult = await writeWorkspaceFile(testFile, content);
      assert.ok(writeResult.includes('successfully'), 'Should write valid file');
      
      const readResult = await readWorkspaceFile(testFile);
      assert.equal(readResult, content, 'Should read back same content');
    });

    await t.test('writeWorkspaceFile blocks sensitive paths', async () => {
      // We mock path.resolve to return a sensitive path for testing on any OS
      const originalResolve = path.resolve;
      path.resolve = (...args: string[]) => {
        const p = args.join(path.sep);
        return p.includes('secret.env') ? (os.platform() === 'win32' ? 'C:\\Windows\\System32\\config' : '/etc/passwd') : originalResolve(...args);
      };
      
      const result = await writeWorkspaceFile('secret.env', 'dummy');
      assert.ok(result.includes('Security Error'), 'Should block sensitive paths');
      
      path.resolve = originalResolve;
    });
  });
});

test('getProjectStatus handles errors gracefully', async () => {
  await withTempCwd(async (tmpDir) => {
    mock.method(fs, 'readdirSync', () => {
      throw new Error('Disk Failure');
    });

    const iotPath = path.join(tmpDir, 'IOT', 'IOT-backups');
    fs.mkdirSync(iotPath, { recursive: true });

    const status = await getProjectStatus();
    mock.restoreAll();

    assert.ok(status.includes('I encountered an error'), 'Should return error message');
    assert.ok(status.includes('Disk Failure'), 'Should include details');
  });
});

test('executeCLICommand blocks dangerous commands', async () => {
  const result = await executeCLICommand('rm -rf /');
  assert.ok(result.includes('Security Error'), 'Should block rm -rf');
  
  const result2 = await executeCLICommand('rd /s /q C:\\');
  assert.ok(result2.includes('Security Error'), 'Should block rd /s /q');
});

test('deploySubAgent updates Task Registry', async () => {
  await withTempCwd(async (tmpDir) => {
    const taskType = 'Testing';
    const instructions = 'Run automated tests';
    
    const result = await deploySubAgent(taskType, instructions);
    assert.ok(result.includes('successfully'), 'Should return success message');
    
    const registryPath = path.join(tmpDir, 'tasks.json');
    assert.ok(fs.existsSync(registryPath), 'Task Registry file should be created');
    
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    assert.ok(Array.isArray(registry.tasks), 'Registry should contain a tasks array');
    const task = registry.tasks.find((t: { type: string }) => t.type === taskType);
    assert.ok(task, 'Deployed task should be in the registry');
    assert.equal(task.instructions, instructions, 'Task instructions should match');
    assert.equal(task.status, 'deployed', 'Initial status should be deployed');
  });
});

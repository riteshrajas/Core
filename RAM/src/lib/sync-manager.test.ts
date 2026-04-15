import test from 'node:test';
import assert from 'node:assert/strict';
import { performSync, SyncState } from './sync-manager';

test('performSync successful first attempt', async () => {
  const logs: string[] = [];
  const state: SyncState = { hasSynced: false, isSyncing: false, retryCount: 0 };
  const sendUpdate = async (p: string) => {};
  const getPrompt = async () => 'Test Prompt';
  const addLog = (m: string) => logs.push(m);

  const result = await performSync(sendUpdate, getPrompt, addLog, state);
  
  assert.strictEqual(result, true);
  assert.strictEqual(state.hasSynced, true);
  assert.ok(logs.includes('Injecting Neural Data...'));
  assert.ok(logs.includes('Sync Complete. APEX RAM Online.'));
});

test('performSync retries on failure and eventually succeeds', async () => {
  const logs: string[] = [];
  const state: SyncState = { hasSynced: false, isSyncing: false, retryCount: 0 };
  let attempts = 0;
  
  const sendUpdate = async (p: string) => {
    attempts++;
    if (attempts < 3) throw new Error('Fail');
  };
  const getPrompt = async () => 'Test Prompt';
  const addLog = (m: string) => logs.push(m);

  const result = await performSync(sendUpdate, getPrompt, addLog, state);
  
  assert.strictEqual(result, true);
  assert.strictEqual(state.hasSynced, true);
  assert.strictEqual(attempts, 3);
  assert.ok(logs.includes('Retrying Sync (1/3)...'));
  assert.ok(logs.includes('Retrying Sync (2/3)...'));
});

test('performSync fails after max retries', async () => {
  const logs: string[] = [];
  const state: SyncState = { hasSynced: false, isSyncing: false, retryCount: 0 };
  let attempts = 0;
  
  const sendUpdate = async (p: string) => {
    attempts++;
    throw new Error('Constant Fail');
  };
  const getPrompt = async () => 'Test Prompt';
  const addLog = (m: string) => logs.push(m);

  const result = await performSync(sendUpdate, getPrompt, addLog, state, 2);
  
  assert.strictEqual(result, false);
  assert.strictEqual(state.hasSynced, false);
  assert.strictEqual(attempts, 3); // 1 initial + 2 retries
  assert.ok(logs.includes('Max Sync Retries Exceeded.'));
});

test('performSync skip if already synced', async () => {
  const logs: string[] = [];
  const state: SyncState = { hasSynced: true, isSyncing: false, retryCount: 0 };
  const addLog = (m: string) => logs.push(m);
  
  const result = await performSync(async () => {}, async () => '', addLog, state);
  
  assert.strictEqual(result, true);
  assert.strictEqual(logs.length, 0);
});

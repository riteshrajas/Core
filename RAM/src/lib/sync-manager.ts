export interface SyncState {
  hasSynced: boolean;
  isSyncing: boolean;
  retryCount: number;
}

export async function performSync(
  sendUpdate: (prompt: string) => Promise<void>,
  getPrompt: () => Promise<string>,
  addLog: (msg: string) => void,
  state: SyncState,
  maxRetries: number = 3
): Promise<boolean> {
  if (state.hasSynced || state.isSyncing) return state.hasSynced;

  state.isSyncing = true;
  
  while (state.retryCount <= maxRetries) {
    try {
      addLog(state.retryCount === 0 ? 'Injecting Neural Data...' : `Retrying Sync (${state.retryCount}/${maxRetries})...`);
      const fullPrompt = await getPrompt();
      await sendUpdate(fullPrompt);
      
      addLog('Sync Complete. APEX RAM Online.');
      state.hasSynced = true;
      state.isSyncing = false;
      return true;
    } catch (err) {
      state.retryCount++;
      addLog(`Sync Attempt ${state.retryCount - 1} Failed.`);
      if (state.retryCount > maxRetries) {
        addLog('Max Sync Retries Exceeded.');
        break;
      }
    }
  }

  state.isSyncing = false;
  return false;
}

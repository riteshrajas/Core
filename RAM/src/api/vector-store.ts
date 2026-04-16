export interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert?: (records: VectorRecord[]) => Promise<void> | void;
  add?: (records: VectorRecord[]) => Promise<void> | void;
  addDocuments?: (records: VectorRecord[]) => Promise<void> | void;
}

export async function writeVectorRecords(
  store: VectorStore,
  records: VectorRecord[]
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  if (typeof store.upsert === 'function') {
    await store.upsert(records);
    return;
  }
  if (typeof store.add === 'function') {
    await store.add(records);
    return;
  }
  if (typeof store.addDocuments === 'function') {
    await store.addDocuments(records);
    return;
  }

  throw new Error(
    'VectorStore must expose one of: upsert(records), add(records), addDocuments(records).'
  );
}


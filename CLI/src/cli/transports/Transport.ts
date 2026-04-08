export interface Transport {
  write(message: any): Promise<void>;
  writeBatch?(messages: any[]): Promise<void>;
  close(code?: number): void;
  connect?(): void;
  onData?: (data: string) => void;
}

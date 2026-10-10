/** A successful setItem alone does not prove that a browser retained a write. */
export function writeVerified(storage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}, key: string, value: string): void {
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw new Error('Storage did not retain the write');
}

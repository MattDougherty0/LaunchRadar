// Fix for Node.js 25+ localStorage experimental feature causing issues
// This runs before any other code on the server

export async function register() {
  if (typeof window === 'undefined') {
    // Server-side: ensure localStorage is properly mocked
    const globalAny = global as any;
    
    // Create a proper localStorage mock if it doesn't exist or is broken
    const needsMock = !globalAny.localStorage || 
                      typeof globalAny.localStorage.getItem !== 'function';
    
    if (needsMock) {
      const storage = new Map<string, string>();
      
      globalAny.localStorage = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, String(value)),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        get length() { return storage.size; },
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
      };
    }
  }
}


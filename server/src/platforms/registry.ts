import { Platform, IPlatformAdapter } from './types.js';

class PlatformRegistry {
  private adapters = new Map<Platform, IPlatformAdapter>();

  register(adapter: IPlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: Platform | string): IPlatformAdapter {
    const adapter = this.adapters.get(platform as Platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }

  has(platform: Platform | string): boolean {
    return this.adapters.has(platform as Platform);
  }
}

export const platformRegistry = new PlatformRegistry();

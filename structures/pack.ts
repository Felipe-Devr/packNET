import { Pack } from 'packNET/types';

class PackRegistry extends Map<string, Pack> {
  public getPackets(packId: string): Array<string> {
    if (!this.has(packId)) return [];
    return this.get(packId).packets;
  }

  public getPrefix(packId: string): string | undefined {
    if (!this.has(packId)) return;
    return this.get(packId).prefix;
  }

  public getRegisteredEntities(packId: string): Array<string> {
    if (!this.has(packId)) return [];
    return this.get(packId).entities;
  }
}

export { PackRegistry };

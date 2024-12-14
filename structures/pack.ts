import { Pack } from 'packNET/types';

class PackRegistry extends Map<string, Pack> {
  /**
   * Retrieves the pack packets
   * @param packId The pack identifier to retrieve its packets
   * @returns The packet identifiers list of the pack, empty if the pack is not registered
   */
  public getPackets(packId: string): Array<string> {
    // ? If the pack does not exits, return empty list
    if (!this.has(packId)) return [];
    return this.get(packId).packets;
  }

  /**
   * Retrieves the pack prefix only if the pack is registered
   * @param packId The pack identifier to retrieve the prefix
   * @returns The pack prefix if the pack was found
   */
  public getPrefix(packId: string): string | undefined {
    if (!this.has(packId)) return;
    return this.get(packId).prefix;
  }

  /**
   * Retrieves the pack registered entities
   * @param packId The pack identifier to retrieve its registered entities
   * @returns The pack's registered entities, empty if the pack is not registered
   */
  public getRegisteredEntities(packId: string): Array<string> {
    return this.get(packId)?.entities ?? [];
  }

  /**
   * Retrieves the pack registered items
   * @param packId The pack identifier to retrieve its registered items
   * @returns The pack's registered items, empty if the pack is not registered
   */
  public getRegisteredItems(packId: string): Array<string> {
    return this.get(packId)?.items ?? [];
  }
}

export { PackRegistry };

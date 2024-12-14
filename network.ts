import { Dimension, system } from '@minecraft/server';
import { Emitter, PackRegistry } from './structures';
import { BasePacket, DiscoveryPacket, EntitiesRegistryPacket, FragmentPacket, ItemsRegistryPacket, Pack } from './types';

class Socket extends Emitter<string, BasePacket> {
  // ? Fragment size used for packet fragmentation
  public static FRAGMENT_SIZE = 128;

  // ? Socket pack registry to save the discovered packs.
  public readonly packRegistry: PackRegistry;

  // ? Socket pack data
  private pack: Pack;

  // ? Used to save and join packet fragments
  private fragments: Map<string, Array<FragmentPacket>> = new Map();

  // ? Used to send the packets.
  private dimension: Dimension;

  constructor(dimension: Dimension, packData: Pack) {
    super();

    this.pack = packData;

    system.afterEvents.scriptEventReceive.subscribe((event) => {
      this.handleIncoming(event.id, JSON.parse(event.message));
    });
    this.dimension = dimension;
    this.packRegistry = new PackRegistry();
    this.sendPacket(this.pack as unknown as DiscoveryPacket);
  }

  /**
   * Sends a packet to all the connections
   * @param packet The packet that will be sent
   */
  public async sendPacket(packet: BasePacket) {
    // NOTE: Reefer to line 65
    const packetLength = JSON.stringify(packet).length;

    if (packetLength > Socket.FRAGMENT_SIZE) {
      // Fragment the packet
      const fragments = await this.fragment(packet);

      // Send each fragment individually
      for (const fragment of fragments) {
        this.sendPacket(fragment);
      }
      return;
    }
    // Sent the packet
    this.dimension.runCommandAsync(`scriptevent ${this.pack.prefix}:${packet.identifier} ${JSON.stringify(packet)}`);
  }

  /**
   * Gets the pack from the pack registry using the given identifier
   * @param packId The pack identifier of the packet to retrieve
   * @returns The pack if this pack was discovered
   */
  public getPack(packId: string): Pack | undefined {
    return this.packRegistry.get(packId);
  }

  /**
   * Fragments a packet based on <Socket.FRAGMENT_SIZE>
   * @param packet The packet that will be fragmented
   * @returns the packet frames
   */
  private async fragment(packet: BasePacket): Promise<Array<FragmentPacket>> {
    // Stringify the packet
    const serializedPacket = JSON.stringify(this.resolvePacket(packet));

    // Fragment list
    const fragments: Array<FragmentPacket> = [];

    // NOTE: Text limit is not based on string length
    // ? Compute the fragment count
    const fragmentCount = Math.floor(serializedPacket.length / Socket.FRAGMENT_SIZE + 1);

    // ? Fragment the packet
    for (let i = 0; i < serializedPacket.length; i += Socket.FRAGMENT_SIZE) {
      // ? Get the fragment from the packet
      const fragment = serializedPacket.slice(i, i + Socket.FRAGMENT_SIZE);

      // ? Push the fragment packet
      fragments.push({
        isFragment: true,
        fragmentCount: fragmentCount,
        data: fragment,
        splitIndex: fragments.length - 1,
        packetId: packet.packetId,
      });
    }
    // ? Return the fragment list
    return fragments;
  }

  /**
   * Handles the incoming packets
   * @param packetId The packet that is being received
   * @param payload The packet payload
   */
  private handleIncoming(packetId: string, payload: object): void {
    // Get the packet payload
    const parsedPayload = payload as BasePacket;

    // If theres no identifier in the packet, then assign the packet id based on the command id.
    parsedPayload.identifier = packetId;

    // If the payload is a fragment, then handle it as a fragment
    if (parsedPayload.isFragment) {
      // ? Handle the fragment and skip the fragment packet
      return this.handleFrame(packetId, parsedPayload as FragmentPacket);
    }

    // ? Emit the per packet event
    this.emit(parsedPayload);

    // ? Emit the global packet event
    this.emit({
      packetId: 'packet',
      payload: parsedPayload,
    });

    // ? Global packets listeners
    switch (packetId) {
      case 'global:discovery': {
        // ? Get the payload as a DiscoveryPacket
        const discoveryPacket = parsedPayload as DiscoveryPacket;
        // ? Destruct the packet fields
        const { identifier, name, description, packets, prefix, version } = discoveryPacket;

        // ? Register the packet to the registry
        this.packRegistry.set(identifier, {
          name,
          prefix,
          version,
          description,
          packets,
          identifier,
          entities: [],
          items: [],
        });
        break;
      }

      case 'global:entities': {
        // ? Get the packet as an EntitiesRegistryPacket
        const entitiesRegistryPacket = parsedPayload as EntitiesRegistryPacket;
        // ? Get the source pack of the packet
        const pack = this.packRegistry.get(entitiesRegistryPacket.source);

        // ? Return if the packet is not found
        if (!pack) return;

        // ? Update the registered entities in the pack
        pack.entities.push(...entitiesRegistryPacket.entityIds);
        break;
      }

      case 'global:items': {
        // ? Get the packet as an ItemsRegistryPacket
        const itemsRegistryPacket = parsedPayload as ItemsRegistryPacket;
        // ? Get the source pack of the packet
        const pack = this.packRegistry.get(itemsRegistryPacket.source);

        // ? Return if the packet is not found
        if (!pack) return;
        // ? Update the registered items in the pack
        pack.entities.push(...itemsRegistryPacket.itemIds);
        break;
      }
    }
  }

  /**
   * Handles a FragmentPacket
   * @param packetId The fragmented packet identifier
   * @param payload The fragment of the packet
   */
  private handleFrame(packetId: string, payload: FragmentPacket): void {
    // Get the split list for the packet id or create a new one
    const splitList = this.fragments.get(packetId) ?? [];

    // Push the new fragment to the fragment list
    splitList.push(payload);

    // Check if the fragment list is already complete
    if (splitList.length >= payload.fragmentCount) {
      // Sort the fragments by splitIndex
      splitList.sort((a, b) => a.splitIndex - b.splitIndex);

      // Get the full payload and join the fragments
      const fullPayload = JSON.parse(splitList.map((packet) => packet.data).join(''));

      // Delete the fragment list from the fragment lists
      this.fragments.delete(packetId);

      // Handle the full packet
      return this.handleIncoming(packetId, fullPayload);
    }
    // Otherwise, add/update the fragment lists
    this.fragments.set(packetId, splitList);
  }

  /**
   * Resolves the packet identifier for the global packets.
   * @param packet The packet to resolve its packet identifier
   * @returns The packet with the resolved identifier
   */
  private resolvePacket(packet: BasePacket): BasePacket {
    switch (true) {
      case 'packets' in packet: {
        packet.packetId = 'global:discovery';
        break;
      }

      case 'itemIds' in packet: {
        packet.packetId = 'global:items';
        break;
      }

      case 'entityIds' in packet: {
        packet.packetId = 'global:entities';
      }
      default:
        throw new Error('Property packetId is mising in the provided packet');
    }
    return packet;
  }
}

export { Socket };

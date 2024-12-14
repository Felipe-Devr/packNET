import { Dimension, system } from '@minecraft/server';
import { Emitter, PackRegistry } from './structures';
import { BasePacket, DiscoveryPacket, EntitiesRegistryPacket, FragmentPacket, ItemsRegistryPacket, Pack } from './types';

class Socket extends Emitter<string, BasePacket> {
  // ? Fragment size used for packet fragmentation
  public static FRAGMENT_SIZE = 128;

  public readonly packRegistry: PackRegistry;

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

  public async sendPacket(packet: BasePacket): Promise<void> {
    // NOTE: Reefer to line 50
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

  public getPack(packId: string): Pack | undefined {
    return this.packRegistry.get(packId);
  }

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

  private handleIncoming(packetId: string, payload: object): void {
    // Get the packet payload
    const parsedPayload = payload as BasePacket;

    // If theres no identifier in the packet, then assign the packet id based on the command id.
    parsedPayload.identifier = packetId;

    // If the payload is a fragment, then handle it as a fragment
    if (parsedPayload.isFragment) {
      this.handleFrame(packetId, parsedPayload as FragmentPacket);
      return;
    }

    // Emit the packet to the listeners
    this.emit(parsedPayload);
    this.emit({
      packetId: 'packet',
      payload: parsedPayload,
    });

    // Global Packets
    switch (packetId) {
      case 'global:discovery': {
        const discoveryPacket = parsedPayload as DiscoveryPacket;
        const { identifier, name, description, packets, prefix, version } = discoveryPacket;

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
        const entitiesRegistryPacket = parsedPayload as EntitiesRegistryPacket;
        const pack = this.packRegistry.get(entitiesRegistryPacket.source);

        if (!pack) return;
        pack.entities.push(...entitiesRegistryPacket.entityIds);
        break;
      }

      case 'global:items': {
        const itemsRegistryPacket = parsedPayload as ItemsRegistryPacket;
        const pack = this.packRegistry.get(itemsRegistryPacket.source);

        if (!pack) return;
        pack.entities.push(...itemsRegistryPacket.itemIds);
        break;
      }
    }
  }

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

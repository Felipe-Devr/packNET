interface BasePacket {
  // The packet identifier
  packetId?: string;

  // Wether or not is a fragment
  readonly isFragment?: boolean;

  [x: string]: JSONValue;
}

type JSONValue = string | object | boolean | number | Array<JSONValue>;

interface FragmentPacket extends BasePacket {
  readonly isFragment: true;
  readonly splitIndex: number;
  readonly fragmentCount: number;
  readonly data: string;
}

interface DiscoveryPacket extends BasePacket {
  identifier: string;
  version: number; // Useless?
  prefix: string;
  description: string; // ?
  name: string;
  packets: Array<string>; // List of addon packet names
}

interface EntitiesRegistryPacket extends BasePacket {
  source: string;
  entityIds: Array<string>;
}

interface ItemsRegistryPacket extends BasePacket {
  source: string;
  itemIds: Array<string>;
}

export { BasePacket, DiscoveryPacket, EntitiesRegistryPacket, ItemsRegistryPacket, FragmentPacket };

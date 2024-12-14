interface Pack {
  identifier: string;
  name: string;
  description: string;
  version: number;
  packets: Array<string>;
  entities?: Array<string>;
  items?: Array<string>;
  prefix: string;
}

export { Pack };

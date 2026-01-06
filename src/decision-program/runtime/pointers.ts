const decodeSegment = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~');
const encodeSegment = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

const splitPointer = (pointer: string) => {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid pointer: ${pointer}`);
  }
  return pointer
    .split('/')
    .slice(1)
    .map(decodeSegment);
};

export const getByPointer = (obj: any, pointer: string): any => {
  const segments = splitPointer(pointer);
  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    const key = Array.isArray(current) ? Number(segment) : segment;
    current = (current as any)[key as any];
  }
  return current;
};

export const hasPointer = (obj: any, pointer: string): boolean => {
  const segments = splitPointer(pointer);
  let current = obj;
  for (const segment of segments) {
    if (current == null) return false;
    const key = Array.isArray(current) ? Number(segment) : segment;
    if (!(key as any in current)) return false;
    current = (current as any)[key as any];
  }
  return true;
};

export const setByPointer = (obj: any, pointer: string, value: any): void => {
  const segments = splitPointer(pointer);
  if (segments.length === 0) {
    throw new Error('Cannot set root with empty pointer');
  }
  let current = obj;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const key = Array.isArray(current) ? Number(segment) : segment;
    if ((current as any)[key as any] === undefined) {
      (current as any)[key as any] = {};
    }
    current = (current as any)[key as any];
  }
  const last = segments[segments.length - 1];
  const lastKey = Array.isArray(current) ? Number(last) : last;
  (current as any)[lastKey as any] = value;
};

export const listMissingPointers = (obj: any, pointers: string[]): string[] =>
  pointers.filter((pointer) => !hasPointer(obj, pointer));

export const pointerToPath = (pointer: string): string =>
  splitPointer(pointer)
    .map((segment) => encodeSegment(segment))
    .join('/');

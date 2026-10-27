import { validateProject } from './project';
import type { Project } from './types';

/** Links longer than this break in some chat apps and browsers. */
export const MAX_LINK_PAYLOAD = 60_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The project without its thumbnail, deflated, as URL-safe text. */
export async function encodeProject(p: Project): Promise<string> {
  const { thumbnail: _thumb, ...rest } = p;
  const json = new TextEncoder().encode(JSON.stringify(rest));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeProject(payload: string): Promise<Project | null> {
  try {
    const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'));
    return validateProject(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

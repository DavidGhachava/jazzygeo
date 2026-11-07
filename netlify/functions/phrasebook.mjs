import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import phrasebook from '../phrasebook.mjs';

const sealedRoot = resolve('sealed');
const assets = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const file = /^\/_sealed\/((?:index\.html|style\.css|book\.js|app\.js|favicon\.svg|audio\/(?:words|phrases|extra)\/[a-z0-9-]+\.mp3)\.bin)$/.exec(pathname);
    if (!file) return new Response(null, { status: 404 });
    try {
      return new Response(await readFile(resolve(sealedRoot, file[1])));
    } catch (error) {
      if (error.code === 'ENOENT') return new Response(null, { status: 404 });
      throw error;
    }
  },
};

export default function handler(request) {
  return phrasebook.fetch(request, {
    ASSETS: assets,
    PHRASEBOOK_PASSWORD: process.env.PHRASEBOOK_PASSWORD,
  });
}

export const config = {
  path: ['/', '/*'],
  excludedPath: '/robots.txt',
};

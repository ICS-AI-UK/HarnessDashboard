// Netlify deployment of /api/data.
//
// Netlify runs this per request and throws the container away afterwards, so it
// cannot write data.json the way the local server does. State lives in Netlify
// Blobs instead; data.json is only used to seed the store on the very first read.

import { readFile } from 'node:fs/promises';

import { getStore } from '@netlify/blobs';

import { DEFAULT_DATA, readDocument, sanitiseDocument } from '../../lib/model.js';

const STORE_NAME = 'harness-dashboard';
const KEY = 'data';

// 'strong' so a save is immediately visible to the reload that follows it.
const store = () => getStore({ name: STORE_NAME, consistency: 'strong' });

async function seed() {
  try {
    const bundled = await readFile(new URL('../../data.json', import.meta.url), 'utf8');
    return readDocument(JSON.parse(bundled));
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (req) => {
  try {
    if (req.method === 'GET') {
      const stored = await store().get(KEY, { type: 'json' });
      if (stored) return json(readDocument(stored));

      // First run on a fresh site: publish the checked-in data as the starting point.
      const initial = await seed();
      await store().setJSON(KEY, initial);
      return json(initial);
    }

    if (req.method === 'PUT') {
      const data = sanitiseDocument(await req.json());
      await store().setJSON(KEY, data);
      return json(data);
    }

    return new Response(null, { status: 405, headers: { Allow: 'GET, PUT' } });
  } catch (err) {
    return json({ error: err?.message || 'Bad request' }, 400);
  }
};

export const config = {
  path: '/api/data',
};

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export type RepeaterDraft = {
  id: string;
  createdAt: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

const file = path.join(process.cwd(), 'data', 'repeater-drafts.json');

declare global {
  // eslint-disable-next-line no-var
  var __REPEATER_DRAFTS__: ReturnType<typeof createStore> | undefined;
}

function readAll(): RepeaterDraft[] {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as RepeaterDraft[];
  } catch {
    return [];
  }
}

function writeAll(drafts: RepeaterDraft[]) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(drafts, null, 2), 'utf8');
  } catch {}
}

function createStore() {
  const drafts: RepeaterDraft[] = readAll();
  const index = new Map<string, number>(drafts.map((d, i) => [d.id, i]));

  return {
    create(input: { method: string; url: string; headers?: Record<string, string>; body?: string }) {
      const d: RepeaterDraft = {
        id: randomUUID(),
        createdAt: Date.now(),
        method: input.method,
        url: input.url,
        headers: input.headers || {},
        body: input.body,
      };
      drafts.push(d);
      index.set(d.id, drafts.length - 1);
      writeAll(drafts);
      return d;
    },
    get(id: string) {
      const i = index.get(id);
      if (i === undefined) return undefined;
      return drafts[i];
    },
    list() {
      return drafts.slice().sort((a, b) => b.createdAt - a.createdAt);
    },
    delete(id: string) {
      const i = index.get(id);
      if (i === undefined) return false;
      drafts.splice(i, 1);
      index.delete(id);
      // rebuild index
      index.clear();
      drafts.forEach((d, idx) => index.set(d.id, idx));
      writeAll(drafts);
      return true;
    },
  };
}

export function repeaterDrafts() {
  if (!global.__REPEATER_DRAFTS__) global.__REPEATER_DRAFTS__ = createStore();
  return global.__REPEATER_DRAFTS__;
}


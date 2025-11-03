import fs from 'fs';
import path from 'path';

type HeadersMap = Record<string, string>;

export type InterceptItem = {
  id: string;
  createdAt: number;
  stage: 'request' | 'response';
  method: string;
  url: string;
  headers: HeadersMap; // request headers for stage=request, response headers for stage=response when editing response
  body?: string; // request body for stage=request
  // Response fields (when stage=response)
  responseStatus?: number;
  responseHeaders?: HeadersMap;
  responseBody?: string;
  state: 'pending' | 'sent' | 'dropped';
};

type Decision =
  | { action: 'send'; url?: string; method?: string; headers?: HeadersMap; body?: string; responseStatus?: number; responseHeaders?: HeadersMap; responseBody?: string }
  | { action: 'drop' };

type Holder = {
  item: InterceptItem;
  resolve: (d: Decision) => void;
};

const file = path.join(process.cwd(), 'data', 'intercept.json');

declare global {
  // eslint-disable-next-line no-var
  var __INTERCEPT__: ReturnType<typeof createStore> | undefined;
}

type Persist = { requestsEnabled: boolean; responsesEnabled: boolean; responseWatch: string[] };

function readState(): Persist {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as any;
    return {
      requestsEnabled: !!(parsed.enabled ?? parsed.requestsEnabled),
      responsesEnabled: !!parsed.responsesEnabled,
      responseWatch: Array.isArray(parsed.responseWatch) ? parsed.responseWatch : [],
    };
  } catch {
    return { requestsEnabled: false, responsesEnabled: false, responseWatch: [] };
  }
}

function writeState(data: Persist) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); } catch {}
}

function createStore() {
  let state = readState();
  const queue: InterceptItem[] = [];
  const holders = new Map<string, Holder>();

  return {
    isEnabled: () => state.requestsEnabled,
    setEnabled: (v: boolean) => { state.requestsEnabled = v; writeState(state); },
    isResponsesEnabled: () => state.responsesEnabled,
    setResponsesEnabled: (v: boolean) => { state.responsesEnabled = v; writeState(state); },
    addResponseWatch: (url: string) => { if (!state.responseWatch.includes(url)) { state.responseWatch.push(url); writeState(state); } },
    shouldHoldResponse: (url: string) => {
      if (state.responsesEnabled) return true;
      const idx = state.responseWatch.indexOf(url);
      if (idx !== -1) { state.responseWatch.splice(idx, 1); writeState(state); return true; }
      return false;
    },
    list: () => queue.filter((q) => q.state === 'pending'),
    get: (id: string) => queue.find((q) => q.id === id),
    hold: (req: { method: string; url: string; headers: HeadersMap; body?: string }): Promise<Decision> => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: InterceptItem = { id, createdAt: Date.now(), stage: 'request', method: req.method, url: req.url, headers: req.headers, body: req.body, state: 'pending' };
      queue.unshift(item);
      return new Promise<Decision>((resolve) => {
        holders.set(id, { item, resolve });
      });
    },
    holdResponse: (input: { method: string; url: string; responseStatus: number; responseHeaders: HeadersMap; responseBody?: string }): Promise<Decision> => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: InterceptItem = {
        id,
        createdAt: Date.now(),
        stage: 'response',
        method: input.method,
        url: input.url,
        headers: {},
        responseStatus: input.responseStatus,
        responseHeaders: input.responseHeaders,
        responseBody: input.responseBody,
        state: 'pending',
      };
      queue.unshift(item);
      return new Promise<Decision>((resolve) => {
        holders.set(id, { item, resolve });
      });
    },
    send: (id: string, d: { url?: string; method?: string; headers?: HeadersMap; body?: string; responseStatus?: number; responseHeaders?: HeadersMap; responseBody?: string }) => {
      const h = holders.get(id);
      if (!h) return false;
      h.item.state = 'sent';
      holders.delete(id);
      h.resolve({ action: 'send', ...d });
      return true;
    },
    drop: (id: string) => {
      const h = holders.get(id);
      if (!h) return false;
      h.item.state = 'dropped';
      holders.delete(id);
      h.resolve({ action: 'drop' });
      return true;
    },
  };
}

export function interceptStore() {
  const needNew = !global.__INTERCEPT__ || typeof (global.__INTERCEPT__ as any).isResponsesEnabled !== 'function' || typeof (global.__INTERCEPT__ as any).setResponsesEnabled !== 'function' || typeof (global.__INTERCEPT__ as any).shouldHoldResponse !== 'function';
  if (needNew) global.__INTERCEPT__ = createStore();
  return global.__INTERCEPT__ as ReturnType<typeof createStore>;
}

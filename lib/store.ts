import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { AppEvent, Finding, Flow, HeaderRule } from './types';

const dataDir = path.join(process.cwd(), 'data');
const flowsFile = path.join(dataDir, 'flows.json');
const rulesFile = path.join(dataDir, 'rules.json');
const findingsFile = path.join(dataDir, 'findings.json');

declare global {
  // eslint-disable-next-line no-var
  var __APP_STORE__: ReturnType<typeof createStore> | undefined;
}

function safeMkdir(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

function readJson<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  try {
    safeMkdir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // ignore write errors in dev
  }
}

function createStore() {
  const flows: Flow[] = readJson<Flow[]>(flowsFile, []);
  const rules: HeaderRule[] = readJson<HeaderRule[]>(rulesFile, []);
  const findings: Finding[] = readJson<Finding[]>(findingsFile, []);

  const listeners = new Set<(event: AppEvent) => void>();

  function emit(event: AppEvent) {
    for (const l of listeners) l(event);
  }

  return {
    listFlows: () => {
      // Reload from disk to reflect external writers (forward proxy)
      const latest = readJson<Flow[]>(flowsFile, flows);
      if (latest !== flows) {
        flows.splice(0, flows.length, ...latest);
      }
      return flows.slice().sort((a, b) => b.timestamp - a.timestamp);
    },
    getFlow: (id: string) => flows.find((f) => f.id === id),
    recordFlow: (partial: Omit<Flow, 'id' | 'timestamp'> & Partial<Pick<Flow, 'timestamp'>>) => {
      const id = randomUUID();
      const flow: Flow = { id, timestamp: partial.timestamp ?? Date.now(), ...partial } as Flow;
      // Truncate preview if needed
      if (flow.responseBodyPreview && flow.responseBodyPreview.length > 2048) {
        flow.responseBodyPreview = flow.responseBodyPreview.slice(0, 2048);
      }
      flows.push(flow);
      emit({ type: 'flow:new', flow });
      writeJson(flowsFile, flows);
      return flow;
    },
    listRules: () => rules.slice(),
    addRule: (rule: Omit<HeaderRule, 'id'>) => {
      const full: HeaderRule = { ...rule, id: randomUUID() };
      rules.push(full);
      writeJson(rulesFile, rules);
      return full;
    },
    updateRule: (id: string, patch: Partial<HeaderRule>) => {
      const idx = rules.findIndex((r) => r.id === id);
      if (idx === -1) return undefined;
      rules[idx] = { ...rules[idx], ...patch, id };
      writeJson(rulesFile, rules);
      return rules[idx];
    },
    removeRule: (id: string) => {
      const idx = rules.findIndex((r) => r.id === id);
      if (idx === -1) return false;
      rules.splice(idx, 1);
      writeJson(rulesFile, rules);
      return true;
    },
    matchRules: (host: string, pathName: string) =>
      rules.filter((r) => r.enabled && host.includes(r.hostPattern) && (!r.pathPattern || pathName.includes(r.pathPattern))),
    subscribe: (fn: (event: AppEvent) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    listFindings: () => findings.slice().sort((a, b) => b.timestamp - a.timestamp),
    addFinding: (finding: Omit<Finding, 'id' | 'timestamp'> & Partial<Pick<Finding, 'timestamp'>>) => {
      const full: Finding = { id: randomUUID(), timestamp: Date.now(), ...finding } as Finding;
      findings.push(full);
      emit({ type: 'finding:new', finding: full });
      writeJson(findingsFile, findings);
      return full;
    },
  };
}

export function getStore() {
  if (!global.__APP_STORE__) {
    global.__APP_STORE__ = createStore();
  }
  return global.__APP_STORE__;
}

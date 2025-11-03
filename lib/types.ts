export type HeaderMap = Record<string, string>;

export type Flow = {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: HeaderMap;
  requestBody?: string;
  responseStatus?: number;
  responseHeaders?: HeaderMap;
  responseBodyPreview?: string; // truncated preview for listing
  tags?: string[];
  source: 'repeater' | 'reverse-proxy' | 'forward-proxy' | 'scanner' | 'puppeteer';
};

export type HeaderRule = {
  id: string;
  hostPattern: string; // simple substring or wildcard later
  pathPattern?: string; // simple substring match
  actions: {
    stripCSP?: boolean;
    stripXFO?: boolean;
    injectCSP?: string; // custom CSP value
    addHeaders?: HeaderMap;
    removeHeaders?: string[];
  };
  enabled: boolean;
};

export type PluginContext = {
  recordFlow: (flow: Flow) => void;
  addFinding: (finding: Omit<Finding, 'id' | 'timestamp'> & Partial<Pick<Finding, 'timestamp'>>) => void;
};

export type Finding = {
  id: string;
  type: 'passive' | 'active';
  title: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  url: string;
  details?: string;
  flowId?: string;
  timestamp: number;
  plugin?: string; // plugin id/name
};

export type Plugin = {
  id: string;
  name: string;
  version?: string;
  onResponse?: (flow: Flow, ctx: PluginContext) => void | Promise<void>;
  onRequest?: (flow: Flow, ctx: PluginContext) => void | Promise<void>;
};

export type AppEvent =
  | { type: 'flow:new'; flow: Flow }
  | { type: 'finding:new'; finding: Finding };

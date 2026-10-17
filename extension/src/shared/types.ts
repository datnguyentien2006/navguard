export type HookType =
  | 'CLICK'
  | 'WINDOW_OPEN'
  | 'META_REFRESH'
  | 'PUSH_STATE'
  | 'REPLACE_STATE'
  | 'LOCATION_ASSIGN'
  | 'LOCATION_REPLACE';

export type NavIntent = {
  sourceUrl: string;
  destinationUrl: string;
  hrefAttr?: string;
  target?: string;
  isTrusted: boolean;
  hasUserGesture: boolean;
  overlaySuspicious: boolean;
  inIframe: boolean;
  iframeSrc?: string;
  redirectChain?: string[];
  hookType?: HookType;
  tabId?: number;
  timestamp: number;
};

export type ReputationLevel = 'high' | 'medium' | 'low' | 'unknown';

export type Reputation = {
  level: ReputationLevel;
  score: number;
  reasons: string[];
  source: 'cache' | 'local' | 'api';
};

export type Decision = {
  level: 0 | 1 | 2 | 3;
  action: 'allow' | 'info-toast' | 'warn-toast' | 'interstitial';
  reason: string[];
  reputation?: Reputation;
};

export type Message =
  | { type: 'NAV_INTENT'; payload: NavIntent }
  | { type: 'HOOK_WINDOW_OPEN'; payload: { url: string; target?: string; features?: string }; sourceUrl: string }
  | { type: 'HOOK_PUSH_STATE'; payload: { url?: string }; sourceUrl: string }
  | { type: 'HOOK_REPLACE_STATE'; payload: { url?: string }; sourceUrl: string }
  | { type: 'HOOK_META_REFRESH'; payload: { content: string }; sourceUrl: string }
  | { type: 'HOOK_LOCATION_ASSIGN'; payload: { url: string }; sourceUrl: string }
  | { type: 'HOOK_LOCATION_REPLACE'; payload: { url: string }; sourceUrl: string }
  | { type: 'SHOW_TOAST'; decision: Decision; intent: NavIntent }
  | { type: 'ALLOW_IMMEDIATE'; intent: NavIntent }
  | { type: 'ALLOW_ONCE'; payload: { intent: NavIntent; decision: Decision } }
  | { type: 'BLOCK'; payload: { intent: NavIntent; decision: Decision } }
  | { type: 'ALLOW_FROM_INTERSTITIAL'; payload: { intent: NavIntent } }
  | { type: 'BLOCKED_ACK' };

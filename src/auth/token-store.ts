import { OrgConnection, OAuthTokens } from '../types';

const STORAGE_KEYS = {
  TOKENS: 'forcelens_oauth_tokens',
  CONNECTION: 'forcelens_org_connection',
  CLIENT_CONFIG: 'forcelens_client_config',
  ACTIVE_RECORD: 'forcelens_active_record',
};

export interface ClientConfig {
  clientId: string;
  customDomain?: string;
  apiVersion?: string;
}

// Default fallback client configuration for Salesforce External Client App / Connected App
export const DEFAULT_CLIENT_ID = 'ForceLensChromeExtension'; // Can be customized in Settings by user/admin
export const DEFAULT_API_VERSION = 'v60.0';

export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEYS.TOKENS]: tokens });
  } else {
    sessionStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  }
}

export async function getTokens(): Promise<OAuthTokens | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get([STORAGE_KEYS.TOKENS]);
    return res[STORAGE_KEYS.TOKENS] || null;
  } else {
    const item = sessionStorage.getItem(STORAGE_KEYS.TOKENS);
    return item ? JSON.parse(item) : null;
  }
}

export async function clearTokens(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove([STORAGE_KEYS.TOKENS]);
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.TOKENS);
  }
}

export async function saveOrgConnection(conn: OrgConnection): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION]: conn });
  } else {
    localStorage.setItem(STORAGE_KEYS.CONNECTION, JSON.stringify(conn));
  }
}

export async function getOrgConnection(): Promise<OrgConnection | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get([STORAGE_KEYS.CONNECTION]);
    return res[STORAGE_KEYS.CONNECTION] || null;
  } else {
    const item = localStorage.getItem(STORAGE_KEYS.CONNECTION);
    return item ? JSON.parse(item) : null;
  }
}

export async function clearOrgConnection(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove([STORAGE_KEYS.CONNECTION]);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CONNECTION);
  }
}

export async function saveClientConfig(config: ClientConfig): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CLIENT_CONFIG]: config });
  } else {
    localStorage.setItem(STORAGE_KEYS.CLIENT_CONFIG, JSON.stringify(config));
  }
}

export async function getClientConfig(): Promise<ClientConfig> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get([STORAGE_KEYS.CLIENT_CONFIG]);
    return res[STORAGE_KEYS.CLIENT_CONFIG] || {
      clientId: '',
      apiVersion: DEFAULT_API_VERSION,
    };
  } else {
    const item = localStorage.getItem(STORAGE_KEYS.CLIENT_CONFIG);
    return item
      ? JSON.parse(item)
      : { clientId: '', apiVersion: DEFAULT_API_VERSION };
  }
}

export async function disconnectSession(): Promise<void> {
  await clearTokens();
  await clearOrgConnection();
}

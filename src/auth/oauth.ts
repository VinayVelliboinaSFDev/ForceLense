import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce';
import { saveTokens, saveOrgConnection, getTokens, getClientConfig } from './token-store';
import { OrgConnection, OrgType, OAuthTokens } from '../types';

export interface OAuthFlowOptions {
  orgType: OrgType;
  customDomain?: string;
  clientId?: string;
}

export function getLoginHost(orgType: OrgType, customDomain?: string): string {
  if (orgType === 'sandbox') {
    return 'https://test.salesforce.com';
  }
  if (orgType === 'custom' && customDomain) {
    let domain = customDomain.trim();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain.replace(/\/+$/, '');
  }
  return 'https://login.salesforce.com';
}

export function getRedirectUri(): string {
  if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
    return chrome.identity.getRedirectURL('oauth');
  }
  return window.location.origin;
}

export async function initiateOAuthFlow(options: OAuthFlowOptions): Promise<OrgConnection> {
  const clientConfig = await getClientConfig();
  const clientId = options.clientId || clientConfig.clientId;

  if (!clientId) {
    throw new Error(
      'Client ID (Consumer Key) is required. Please provide your Salesforce External Client App or Connected App Consumer Key.'
    );
  }

  const loginHost = getLoginHost(options.orgType, options.customDomain);
  const redirectUri = getRedirectUri();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  const authUrl = new URL(`${loginHost}/services/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'api refresh_token id web');

  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new Error('Chrome Identity API is not available in this environment.');
  }

  const redirectResponseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true,
      },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'OAuth authorization flow cancelled or failed.'));
          return;
        }
        if (!responseUrl) {
          reject(new Error('No response URL received from Salesforce authorization.'));
          return;
        }
        resolve(responseUrl);
      }
    );
  });

  const parsedResponse = new URL(redirectResponseUrl);
  const returnedState = parsedResponse.searchParams.get('state');
  const code = parsedResponse.searchParams.get('code');
  const error = parsedResponse.searchParams.get('error');
  const errorDescription = parsedResponse.searchParams.get('error_description');

  if (error) {
    throw new Error(`Salesforce authorization error: ${error} - ${errorDescription || 'No details provided'}`);
  }

  if (returnedState !== state) {
    throw new Error('Security verification failed: OAuth state mismatch.');
  }

  if (!code) {
    throw new Error('No authorization code returned from Salesforce.');
  }

  // Exchange authorization code for access token via PKCE (No client secret required)
  const tokenEndpoint = `${loginHost}/services/oauth2/token`;
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: bodyParams.toString(),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Token exchange failed (${tokenResponse.status}): ${errorBody}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken: string = tokenData.access_token;
  const instanceUrl: string = tokenData.instance_url;
  const refreshToken: string | undefined = tokenData.refresh_token;
  const identityUrl: string | undefined = tokenData.id;

  // Extract Org ID and User ID from identity URL if available (format: .../id/00D.../005...)
  let orgId = '';
  let userId = '';
  let username = '';
  let displayName = '';

  if (identityUrl) {
    const parts = identityUrl.split('/');
    if (parts.length >= 2) {
      userId = parts[parts.length - 1];
      orgId = parts[parts.length - 2];
    }

    try {
      // Query identity endpoint for full user profile information
      const idRes = await fetch(identityUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (idRes.ok) {
        const idData = await idRes.json();
        username = idData.username || '';
        displayName = idData.display_name || '';
        if (idData.organization_id) orgId = idData.organization_id;
      }
    } catch {
      // Soft-fail identity fetch; orgId and userId extracted from URL are sufficient
    }
  }

  const tokens: OAuthTokens = {
    accessToken,
    refreshToken,
    instanceUrl,
    issuedAt: Date.now(),
    tokenType: tokenData.token_type || 'Bearer',
  };

  await saveTokens(tokens);

  const orgConnection: OrgConnection = {
    orgId: orgId || 'unknown_org',
    instanceUrl,
    loginUrl: loginHost,
    orgType: options.orgType,
    orgAlias: displayName || username || instanceUrl.replace(/^https?:\/\//, ''),
    username: username || userId,
    connectedAt: new Date().toISOString(),
    clientId,
  };

  await saveOrgConnection(orgConnection);

  return orgConnection;
}

export async function refreshAccessToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens || !tokens.refreshToken) {
    throw new Error('No refresh token available to refresh session.');
  }

  const clientConfig = await getClientConfig();
  if (!clientConfig.clientId) {
    throw new Error('Client ID is required for token refresh.');
  }

  const tokenEndpoint = `${tokens.instanceUrl}/services/oauth2/token`;
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: clientConfig.clientId,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed (${response.status})`);
  }

  const data = await response.json();
  const updatedTokens: OAuthTokens = {
    ...tokens,
    accessToken: data.access_token,
    issuedAt: Date.now(),
  };

  await saveTokens(updatedTokens);
  return data.access_token;
}

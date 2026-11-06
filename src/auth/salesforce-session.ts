import { OrgConnection, OAuthTokens } from '../types';
import { saveTokens, saveOrgConnection } from './token-store';

export interface AutoSessionResult {
  connection: OrgConnection;
  tokens: OAuthTokens;
}

/**
 * Derives potential Salesforce API base URLs from an active browser tab URL.
 * In Lightning, tabs are on *.lightning.force.com, while REST APIs run on *.my.salesforce.com.
 */
export function getCandidateApiHosts(tabUrl: string): string[] {
  try {
    const url = new URL(tabUrl);
    const host = url.hostname.toLowerCase();
    const candidates: string[] = [];

    // Check if it's a Salesforce domain
    if (!host.includes('salesforce.com') && !host.includes('force.com') && !host.includes('cloudforce.com')) {
      return [];
    }

    // 1. Standard Lightning domain: {subdomain}.lightning.force.com -> {subdomain}.my.salesforce.com
    if (host.endsWith('.lightning.force.com')) {
      const subdomain = host.replace(/\.lightning\.force\.com$/, '');
      candidates.push(`https://${subdomain}.my.salesforce.com`);
      candidates.push(`https://${subdomain}.sandbox.my.salesforce.com`);
      candidates.push(`https://${subdomain}.develop.my.salesforce.com`);
    }

    // 2. Visualforce domain: {subdomain}--c.vf.force.com -> {subdomain}.my.salesforce.com
    if (host.includes('.vf.force.com') || host.includes('.visualforce.com')) {
      const subdomain = host.split('--')[0].replace(/\.vf\.force\.com$/, '').replace(/\.visualforce\.com$/, '');
      candidates.push(`https://${subdomain}.my.salesforce.com`);
      candidates.push(`https://${subdomain}.sandbox.my.salesforce.com`);
    }

    // 3. Already my.salesforce.com or salesforce.com
    candidates.push(`https://${host}`);

    // Deduplicate
    return Array.from(new Set(candidates));
  } catch {
    return [];
  }
}

/**
 * Inspects Chrome cookies for the active Salesforce tab, just like Salesforce Inspector.
 * Reads the 'sid' session cookie, verifies it with the REST API, and automatically connects.
 */
export async function autoDetectSalesforceSession(targetTabUrl?: string): Promise<AutoSessionResult | null> {
  if (typeof chrome === 'undefined' || !chrome.cookies || !chrome.tabs) {
    return null;
  }

  // 1. Find the active tab URL if not provided
  let url = targetTabUrl;
  if (!url) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    url = activeTab?.url;
  }

  // If active tab is not Salesforce, search all open tabs for any active Salesforce tab
  if (!url || (!url.includes('salesforce.com') && !url.includes('force.com'))) {
    const allSfTabs = await chrome.tabs.query({
      url: ['https://*.salesforce.com/*', 'https://*.force.com/*'],
    });
    if (allSfTabs.length > 0 && allSfTabs[0].url) {
      url = allSfTabs[0].url;
    } else {
      return null;
    }
  }

  const candidateHosts = getCandidateApiHosts(url);
  if (candidateHosts.length === 0) return null;

  // 2. Query all 'sid' cookies stored in Chrome
  const allSidCookies = await chrome.cookies.getAll({ name: 'sid' });
  if (!allSidCookies || allSidCookies.length === 0) return null;

  const urlObj = new URL(url);
  const baseSubdomain = urlObj.hostname.split('.')[0];

  // 3. Sort cookies by relevance (prefer cookies matching the current org's subdomain and .my.salesforce.com)
  const sortedCookies = [...allSidCookies].sort((a, b) => {
    const aDomain = a.domain.toLowerCase();
    const bDomain = b.domain.toLowerCase();

    const aMatchSub = aDomain.includes(baseSubdomain);
    const bMatchSub = bDomain.includes(baseSubdomain);
    if (aMatchSub && !bMatchSub) return -1;
    if (!aMatchSub && bMatchSub) return 1;

    const aIsMySalesforce = aDomain.includes('my.salesforce.com');
    const bIsMySalesforce = bDomain.includes('my.salesforce.com');
    if (aIsMySalesforce && !bIsMySalesforce) return -1;
    if (!aIsMySalesforce && bIsMySalesforce) return 1;

    return 0;
  });

  // 4. Test candidate host + sid combinations against Salesforce API
  for (const host of candidateHosts) {
    for (const cookie of sortedCookies) {
      const sid = cookie.value;
      if (!sid || sid.length < 20) continue;

      try {
        // Test session via userinfo endpoint
        const userInfoRes = await fetch(`${host}/services/oauth2/userinfo`, {
          headers: {
            Authorization: `Bearer ${sid}`,
            Accept: 'application/json',
          },
        });

        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          const orgId = userInfo.organization_id || 'active_org';
          const username = userInfo.preferred_username || userInfo.username || 'Active Salesforce User';
          const displayName = userInfo.name || username;

          const tokens: OAuthTokens = {
            accessToken: sid,
            instanceUrl: host,
            issuedAt: Date.now(),
            tokenType: 'Bearer',
          };

          const isSandbox = host.includes('sandbox') || host.includes('test');
          const connection: OrgConnection = {
            orgId,
            instanceUrl: host,
            loginUrl: host,
            orgType: isSandbox ? 'sandbox' : 'production',
            orgAlias: `${baseSubdomain} (${displayName})`,
            username,
            connectedAt: new Date().toISOString(),
            clientId: 'SalesforceActiveSession',
          };

          // Save automatically to extension storage
          await saveTokens(tokens);
          await saveOrgConnection(connection);

          return { connection, tokens };
        }
      } catch {
        // Continue trying remaining candidate cookies
      }
    }
  }

  return null;
}

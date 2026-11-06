import { SalesforceRecordContext } from '../types';

export function detectRecordFromUrl(url: string): SalesforceRecordContext | null {
  try {
    const parsed = new URL(url);
    // Matches /lightning/r/{ObjectApiName}/{RecordId}/view|edit|related or standard record paths
    const regex = /\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})(?:\/(?:view|edit|related.*))?/;
    const match = parsed.pathname.match(regex);

    if (match) {
      return {
        objectApiName: decodeURIComponent(match[1]),
        recordId: match[2],
        url,
      };
    }

    // Classic / legacy URL pattern /001XXXXXXXXXXXX or /500XXXXXXXXXXXX
    const classicRegex = /^\/([a-zA-Z0-9]{15,18})(?:[/?#]|$)/;
    const classicMatch = parsed.pathname.match(classicRegex);
    if (classicMatch) {
      return {
        objectApiName: 'Unknown (Classic URL)',
        recordId: classicMatch[1],
        url,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function extractRecordNameFromDom(): string | undefined {
  try {
    // Check common Lightning header title elements
    const titleEl =
      document.querySelector('h1.slds-page-header__title span') ||
      document.querySelector('h1.slds-page-header__title') ||
      document.querySelector('records-entity-label');

    if (titleEl && titleEl.textContent) {
      const text = titleEl.textContent.trim();
      if (text.length > 0 && text.length < 120) {
        return text;
      }
    }

    // Fallback: document.title without standard suffixes like " | Salesforce"
    if (document.title) {
      const cleanTitle = document.title
        .replace(/\s*\|\s*Salesforce.*$/i, '')
        .replace(/\s*-\s*Salesforce.*$/i, '')
        .trim();
      if (cleanTitle.length > 0 && cleanTitle.length < 120) {
        return cleanTitle;
      }
    }
  } catch {
    // Ignore DOM extraction errors
  }
  return undefined;
}

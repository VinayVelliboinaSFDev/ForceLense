import { getTokens, getClientConfig } from '../auth/token-store';
import { refreshAccessToken } from '../auth/oauth';
import { QueryResult, SObjectDescribe, UserRecord } from './types';
import { TargetUser } from '../types';

export class SalesforceApiClient {
  private static instance: SalesforceApiClient;

  public static getInstance(): SalesforceApiClient {
    if (!SalesforceApiClient.instance) {
      SalesforceApiClient.instance = new SalesforceApiClient();
    }
    return SalesforceApiClient.instance;
  }

  private async getAuthContext(): Promise<{ accessToken: string; instanceUrl: string; apiVersion: string }> {
    const tokens = await getTokens();
    if (!tokens || !tokens.accessToken) {
      throw new Error('Not connected to Salesforce. Please connect your org.');
    }
    const clientConfig = await getClientConfig();
    const apiVersion = clientConfig.apiVersion || 'v60.0';

    return {
      accessToken: tokens.accessToken,
      instanceUrl: tokens.instanceUrl.replace(/\/+$/, ''),
      apiVersion,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const { accessToken, instanceUrl } = await this.getAuthContext();
    const url = endpoint.startsWith('http') ? endpoint : `${instanceUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle token expiration: attempt automatic refresh once
      if (response.status === 401 && retryCount === 0) {
        try {
          await refreshAccessToken();
          return await this.request<T>(endpoint, options, retryCount + 1);
        } catch {
          throw new Error('Salesforce session expired. Please reconnect to your org.');
        }
      }

      // Handle Rate Limiting / Server errors with exponential backoff
      if ((response.status === 429 || response.status >= 500) && retryCount < 2) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        await new Promise((res) => setTimeout(res, backoffMs));
        return await this.request<T>(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        let errorMessage = `Salesforce API Error (${response.status} ${response.statusText})`;
        try {
          const errJson = await response.json();
          if (Array.isArray(errJson) && errJson[0]?.message) {
            errorMessage = errJson[0].message;
          } else if (errJson.message) {
            errorMessage = errJson.message;
          }
        } catch {
          // Keep generic message
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Redact any accidental tokens from message
        const sanitized = err.message.replace(/Bearer\s+[a-zA-Z0-9._~!$&'()*+,;=:-]+/gi, 'Bearer [REDACTED]');
        throw new Error(sanitized);
      }
      throw err;
    }
  }

  public async query<T>(soql: string, maxRecords = 2000): Promise<T[]> {
    const { apiVersion } = await this.getAuthContext();
    const encoded = encodeURIComponent(soql);
    let nextUrl: string | undefined = `/services/data/${apiVersion}/query/?q=${encoded}`;
    const allRecords: T[] = [];

    while (nextUrl && allRecords.length < maxRecords) {
      const result: QueryResult<T> = await this.request<QueryResult<T>>(nextUrl);
      if (result.records && Array.isArray(result.records)) {
        allRecords.push(...result.records);
      }
      nextUrl = result.done ? undefined : result.nextRecordsUrl;
    }

    return allRecords;
  }

  public async describeSObject(apiName: string): Promise<SObjectDescribe> {
    const { apiVersion } = await this.getAuthContext();
    return await this.request<SObjectDescribe>(`/services/data/${apiVersion}/sobjects/${apiName}/describe`);
  }

  public async getRecord<T = Record<string, unknown>>(
    apiName: string,
    recordId: string,
    fields: string[] = ['Id', 'Name']
  ): Promise<T> {
    const { apiVersion } = await this.getAuthContext();
    const fieldsParam = encodeURIComponent(fields.join(','));
    return await this.request<T>(
      `/services/data/${apiVersion}/sobjects/${apiName}/${recordId}?fields=${fieldsParam}`
    );
  }

  public async searchUsers(searchTerm: string): Promise<TargetUser[]> {
    const cleanTerm = searchTerm.trim().replace(/'/g, "\\'");
    if (!cleanTerm) return [];

    const isId = /^[a-zA-Z0-9]{15,18}$/.test(cleanTerm) && cleanTerm.startsWith('005');
    let soql = '';

    if (isId) {
      soql = `
        SELECT Id, Name, Username, Email, IsActive, ProfileId, Profile.Name, UserRoleId, UserRole.Name
        FROM User
        WHERE Id = '${cleanTerm}'
        LIMIT 10
      `;
    } else {
      soql = `
        SELECT Id, Name, Username, Email, IsActive, ProfileId, Profile.Name, UserRoleId, UserRole.Name
        FROM User
        WHERE IsActive = true
          AND (Name LIKE '%${cleanTerm}%' OR Username LIKE '%${cleanTerm}%' OR Email LIKE '%${cleanTerm}%')
        ORDER BY Name
        LIMIT 25
      `;
    }

    const records = await this.query<UserRecord>(soql);
    return records.map((u) => ({
      id: u.Id,
      name: u.Name,
      username: u.Username,
      email: u.Email,
      isActive: u.IsActive,
      profileId: u.ProfileId,
      profileName: u.Profile?.Name || 'Unknown Profile',
      userRoleId: u.UserRoleId,
      userRoleName: u.UserRole?.Name,
    }));
  }

  public async getUserById(userId: string): Promise<TargetUser | null> {
    const soql = `
      SELECT Id, Name, Username, Email, IsActive, ProfileId, Profile.Name, UserRoleId, UserRole.Name
      FROM User
      WHERE Id = '${userId}'
      LIMIT 1
    `;
    const records = await this.query<UserRecord>(soql);
    if (!records || records.length === 0) return null;
    const u = records[0];
    return {
      id: u.Id,
      name: u.Name,
      username: u.Username,
      email: u.Email,
      isActive: u.IsActive,
      profileId: u.ProfileId,
      profileName: u.Profile?.Name || 'Unknown Profile',
      userRoleId: u.UserRoleId,
      userRoleName: u.UserRole?.Name,
    };
  }
}

export const sfApi = SalesforceApiClient.getInstance();

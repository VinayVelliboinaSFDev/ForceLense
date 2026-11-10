export type OrgType = 'production' | 'sandbox' | 'custom';

export interface SalesforceRecordContext {
  recordId: string;
  objectApiName: string;
  url: string;
  recordName?: string;
}

export interface OrgConnection {
  orgId: string;
  instanceUrl: string;
  loginUrl: string;
  orgType: OrgType;
  orgAlias?: string;
  username?: string;
  connectedAt: string;
  clientId: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  issuedAt: number;
  tokenType: string;
}

export interface TargetUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  isActive: boolean;
  profileId: string;
  profileName: string;
  userRoleId?: string;
  userRoleName?: string;
}

export type EvidenceCategory = "record" | "object" | "field" | "sharing" | "restriction" | "ui";

export type EvidenceStatus =
  | "confirmed"
  | "supported"
  | "possible"
  | "unavailable"
  | "unknown"
  | "not_applicable";

export interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  status: EvidenceStatus;
  title: string;
  explanation: string;
  source: string;          // e.g. UserRecordAccess, ObjectPermissions, CaseShare, etc.
  retrievedAt: string;    // ISO timestamp
  targetUserId?: string;
  recordId?: string;
  fieldApiName?: string;
  details?: Record<string, unknown>;
  limitation?: string;
}

export interface RecordAccessFlags {
  read?: boolean;
  edit?: boolean;
  delete?: boolean;
  transfer?: boolean;
  all?: boolean;
  maxAccessLevel?: string;
}

export interface ObjectCRUDPermissions {
  read: boolean | "unknown";
  create: boolean | "unknown";
  edit: boolean | "unknown";
  delete: boolean | "unknown";
  viewAll: boolean | "unknown";
  modifyAll: boolean | "unknown";
}

export interface FieldPermissionResult {
  fieldApiName: string;
  label: string;
  readable: boolean | "unknown";
  editable: boolean | "unknown";
  source?: string;
}

export interface SharingFinding {
  type: "ownership" | "share_row" | "group" | "role" | "hierarchy" | "owd" | "special";
  label: string;
  accessLevel: string;
  rowCause?: string;
  path?: string[];
  source: string;
  status: EvidenceStatus;
  details?: Record<string, unknown>;
}

export interface AnalysisCoverage {
  completed: string[];
  unavailable: string[];
  skipped: string[];
}

export interface AnalysisResult {
  analysisId: string;
  orgId: string;
  recordId: string;
  objectApiName: string;
  recordName?: string;
  targetUserId: string;
  targetUserName: string;
  targetUserProfileName?: string;
  targetUserRoleName?: string;
  startedAt: string;
  completedAt?: string;
  recordAccess?: RecordAccessFlags;
  objectPermissions: ObjectCRUDPermissions;
  fieldPermissions: FieldPermissionResult[];
  sharingFindings: SharingFinding[];
  evidence: EvidenceItem[];
  coverage: AnalysisCoverage;
  overallStatus: "complete" | "partial" | "failed";
  limitations: string[];
}

export interface AnalysisRequest {
  orgId: string;
  recordId: string;
  objectApiName: string;
  targetUserId: string;
  requestedAt: string;
  includeFields?: string[];
}

export type ExtensionMessage =
  | { type: 'RECORD_DETECTED'; payload: SalesforceRecordContext }
  | { type: 'GET_RECORD_CONTEXT' }
  | { type: 'SET_RECORD_CONTEXT'; payload: SalesforceRecordContext }
  | { type: 'OPEN_SIDEPANEL' }
  | { type: 'AUTH_UPDATED' }
  | { type: 'DISCONNECT_REQUESTED' };

export interface QueryResult<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

export interface FieldDescribe {
  name: string;
  label: string;
  type: string;
  createable: boolean;
  updateable: boolean;
  nillable: boolean;
  permissionable: boolean;
}

export interface SObjectDescribe {
  name: string;
  label: string;
  keyPrefix: string | null;
  custom: boolean;
  queryable: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  fields: FieldDescribe[];
  childRelationships?: Array<{
    childSObject: string;
    field: string;
    relationshipName?: string;
  }>;
}

export interface UserRecordAccessRecord {
  RecordId: string;
  HasReadAccess: boolean;
  HasEditAccess: boolean;
  HasDeleteAccess: boolean;
  HasTransferAccess: boolean;
  HasAllAccess: boolean;
  MaxAccessLevel: 'None' | 'Read' | 'Edit' | 'Delete' | 'Transfer' | 'All';
}

export interface UserRecord {
  Id: string;
  Name: string;
  Username: string;
  Email?: string;
  IsActive: boolean;
  ProfileId: string;
  Profile?: {
    Name: string;
  };
  UserRoleId?: string;
  UserRole?: {
    Name: string;
  };
}

export interface PermissionSetAssignmentRecord {
  Id: string;
  AssigneeId: string;
  PermissionSetId: string;
  PermissionSetGroupId?: string;
  PermissionSet: {
    Id: string;
    Name: string;
    Label: string;
    IsOwnedByProfile: boolean;
    ProfileId?: string;
    Profile?: {
      Name: string;
    };
    PermissionsViewAllData?: boolean;
    PermissionsModifyAllData?: boolean;
  };
}

export interface PermissionSetGroupRecord {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Status?: string;
}

export interface MutingPermissionSetRecord {
  Id: string;
  DeveloperName?: string;
  MasterLabel?: string;
  PermissionSetGroupId?: string;
}

export interface ObjectPermissionsRecord {
  Id?: string;
  ParentId: string;
  SObjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
  Parent?: {
    Name: string;
    Label: string;
    IsOwnedByProfile: boolean;
  };
}

export interface FieldPermissionsRecord {
  Id?: string;
  ParentId: string;
  SObjectType: string;
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  Parent?: {
    Name: string;
    Label: string;
    IsOwnedByProfile: boolean;
  };
}

export interface ShareRecord {
  Id: string;
  ParentId?: string;
  UserOrGroupId: string;
  AccessLevel?: string;
  RowCause?: string;
  [key: string]: unknown;
}

export interface GroupRecord {
  Id: string;
  Name: string;
  DeveloperName: string;
  Type: string;
  RelatedId?: string;
}

export interface GroupMemberRecord {
  Id: string;
  GroupId: string;
  UserOrGroupId: string;
}

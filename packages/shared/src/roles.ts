export enum Role {
  RetailUser = "RETAIL_USER",
  SupportAgent = "SUPPORT_AGENT",
  KycOfficer = "KYC_OFFICER",
  FinanceManager = "FINANCE_MANAGER",
  ListingAdmin = "LISTING_ADMIN",
  SuperAdmin = "SUPER_ADMIN",
  Auditor = "AUDITOR",
}

export const STAFF_ROLES: Role[] = [
  Role.SupportAgent,
  Role.KycOfficer,
  Role.FinanceManager,
  Role.ListingAdmin,
  Role.SuperAdmin,
  Role.Auditor,
];

export enum AccessLevel {
  Full = "FULL",
  Approve = "APPROVE",
  View = "VIEW",
  None = "NONE",
}

export enum Permission {
  ManageOwnProfile = "manage_own_profile",
  ViewOwnPortfolio = "view_own_portfolio",
  DepositOwnWallet = "deposit_own_wallet",
  InitiateOwnWithdrawal = "initiate_own_withdrawal",
  SubmitKyc = "submit_kyc",
  ViewSupportTickets = "view_support_tickets",
  RespondSupportTickets = "respond_support_tickets",
  ViewKycSubmissions = "view_kyc_submissions",
  ApproveRejectKyc = "approve_reject_kyc",
  ViewAnyWalletBalance = "view_any_wallet_balance",
  FreezeWallet = "freeze_wallet",
  InitiateWithdrawalPayout = "initiate_withdrawal_payout",
  ApproveWithdrawalPayout = "approve_withdrawal_payout",
  ReconcileLedger = "reconcile_ledger",
  CreateEditListing = "create_edit_listing",
  PublishListing = "publish_listing",
  ConfigurePriceFeeds = "configure_price_feeds",
  AssignRoles = "assign_roles",
  SystemConfiguration = "system_configuration",
  ViewAuditLogs = "view_audit_logs",
  ExportComplianceReports = "export_compliance_reports",
}

/**
 * Source of truth for the role/permission matrix in SAHARA_Platform_Design.docx (section 4).
 * Any permission not listed for a role defaults to AccessLevel.None via hasAccess().
 * "Approve" entries are maker-checker steps: the approver must be a different
 * individual than whoever holds Full/initiator access for the paired permission.
 */
export const PERMISSION_MATRIX: Record<Permission, Partial<Record<Role, AccessLevel>>> = {
  [Permission.ManageOwnProfile]: { [Role.RetailUser]: AccessLevel.Full },
  [Permission.ViewOwnPortfolio]: { [Role.RetailUser]: AccessLevel.Full },
  [Permission.DepositOwnWallet]: { [Role.RetailUser]: AccessLevel.Full },
  [Permission.InitiateOwnWithdrawal]: { [Role.RetailUser]: AccessLevel.Full },
  [Permission.SubmitKyc]: { [Role.RetailUser]: AccessLevel.Full },

  [Permission.ViewSupportTickets]: {
    [Role.SupportAgent]: AccessLevel.Full,
    [Role.KycOfficer]: AccessLevel.View,
    [Role.SuperAdmin]: AccessLevel.Full,
    [Role.Auditor]: AccessLevel.View,
  },
  [Permission.RespondSupportTickets]: {
    [Role.SupportAgent]: AccessLevel.Full,
    [Role.SuperAdmin]: AccessLevel.Full,
  },
  [Permission.ViewKycSubmissions]: {
    [Role.SupportAgent]: AccessLevel.View,
    [Role.KycOfficer]: AccessLevel.Full,
    [Role.SuperAdmin]: AccessLevel.Full,
    [Role.Auditor]: AccessLevel.View,
  },
  [Permission.ApproveRejectKyc]: { [Role.KycOfficer]: AccessLevel.Full },

  [Permission.ViewAnyWalletBalance]: {
    [Role.SupportAgent]: AccessLevel.View,
    [Role.KycOfficer]: AccessLevel.View,
    [Role.FinanceManager]: AccessLevel.Full,
    [Role.SuperAdmin]: AccessLevel.Full,
    [Role.Auditor]: AccessLevel.View,
  },
  [Permission.FreezeWallet]: {
    [Role.FinanceManager]: AccessLevel.Full,
    [Role.SuperAdmin]: AccessLevel.Full,
  },
  [Permission.InitiateWithdrawalPayout]: { [Role.FinanceManager]: AccessLevel.Full },
  [Permission.ApproveWithdrawalPayout]: {
    [Role.FinanceManager]: AccessLevel.Approve,
    [Role.SuperAdmin]: AccessLevel.Full,
  },
  [Permission.ReconcileLedger]: {
    [Role.FinanceManager]: AccessLevel.Full,
    [Role.SuperAdmin]: AccessLevel.View,
    [Role.Auditor]: AccessLevel.View,
  },

  [Permission.CreateEditListing]: { [Role.ListingAdmin]: AccessLevel.Full },
  [Permission.PublishListing]: {
    [Role.ListingAdmin]: AccessLevel.Approve,
    [Role.SuperAdmin]: AccessLevel.Full,
  },
  [Permission.ConfigurePriceFeeds]: {
    [Role.ListingAdmin]: AccessLevel.Full,
    [Role.SuperAdmin]: AccessLevel.View,
  },

  [Permission.AssignRoles]: { [Role.SuperAdmin]: AccessLevel.Full },
  [Permission.SystemConfiguration]: { [Role.SuperAdmin]: AccessLevel.Full },
  [Permission.ViewAuditLogs]: {
    [Role.SuperAdmin]: AccessLevel.Full,
    [Role.Auditor]: AccessLevel.Full,
  },
  [Permission.ExportComplianceReports]: {
    [Role.FinanceManager]: AccessLevel.View,
    [Role.SuperAdmin]: AccessLevel.Full,
    [Role.Auditor]: AccessLevel.Full,
  },
};

const LEVEL_RANK: Record<AccessLevel, number> = {
  [AccessLevel.None]: 0,
  [AccessLevel.View]: 1,
  [AccessLevel.Approve]: 2,
  [AccessLevel.Full]: 3,
};

export function accessLevelFor(role: Role, permission: Permission): AccessLevel {
  return PERMISSION_MATRIX[permission][role] ?? AccessLevel.None;
}

/** True if `role` has at least `minLevel` for `permission`, per the matrix. */
export function hasAccess(role: Role, permission: Permission, minLevel: AccessLevel = AccessLevel.View): boolean {
  return LEVEL_RANK[accessLevelFor(role, permission)] >= LEVEL_RANK[minLevel];
}

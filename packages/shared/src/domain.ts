export enum KycTier {
  Tier0Unverified = "TIER_0_UNVERIFIED",
  Tier1Verified = "TIER_1_VERIFIED",
  Restricted = "RESTRICTED",
}

export enum KycCaseStatus {
  PendingAutoReview = "PENDING_AUTO_REVIEW",
  PendingOfficerReview = "PENDING_OFFICER_REVIEW",
  Approved = "APPROVED",
  Rejected = "REJECTED",
  MoreInfoRequested = "MORE_INFO_REQUESTED",
}

export enum SupportedChain {
  Ethereum = "ETHEREUM",
  Solana = "SOLANA",
}

/** Deposit-side assets SAHARA accepts and converts to USDC. Bitcoin/UTXO chains are out of scope for now. */
export enum DepositAsset {
  Usdc = "USDC",
  UsdStablecoinOther = "USD_STABLECOIN_OTHER",
  Eth = "ETH",
  Sol = "SOL",
  FiatLocal = "FIAT_LOCAL",
}

export enum TransactionStatus {
  Pending = "PENDING",
  AwaitingSettlement = "AWAITING_SETTLEMENT",
  UnderReview = "UNDER_REVIEW",
  Settled = "SETTLED",
  Failed = "FAILED",
  Rejected = "REJECTED",
}

export enum WithdrawalReviewStage {
  AutoApproved = "AUTO_APPROVED",
  PendingMaker = "PENDING_MAKER",
  PendingChecker = "PENDING_CHECKER",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}

export enum AssetListingStatus {
  Draft = "DRAFT",
  PendingApproval = "PENDING_APPROVAL",
  Live = "LIVE",
  Delisted = "DELISTED",
}

export enum SupportTicketPriority {
  Low = "LOW",
  Normal = "NORMAL",
  High = "HIGH",
}

export enum SupportTicketStatus {
  Open = "OPEN",
  EscalatedFinance = "ESCALATED_FINANCE",
  EscalatedKyc = "ESCALATED_KYC",
  Resolved = "RESOLVED",
  Closed = "CLOSED",
}

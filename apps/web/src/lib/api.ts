const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "sahara_access_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      // Skip Content-Type for FormData -- fetch sets it (with the multipart boundary) automatically.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (Array.isArray(body?.message) ? body.message.join(", ") : body?.message) ??
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export interface AccessTokenResponse {
  accessToken: string;
}

export interface WhoAmI {
  id: string;
  role: string;
  kind: "user" | "staff";
}

export function register(email: string, password: string, fullName?: string) {
  return request<AccessTokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
}

export function login(email: string, password: string) {
  return request<AccessTokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function staffLogin(email: string, password: string) {
  return request<AccessTokenResponse>("/auth/staff-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function whoami(token: string) {
  return request<WhoAmI>("/auth/whoami", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function superAdminOnly(token: string) {
  return request<{ status: string }>("/auth/super-admin-only", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's license" },
] as const;
export type IdType = (typeof ID_TYPES)[number]["value"];

export interface KycCase {
  id: string;
  status: "PENDING_AUTO_REVIEW" | "PENDING_OFFICER_REVIEW" | "APPROVED" | "REJECTED" | "MORE_INFO_REQUESTED";
  triggerReason: string;
  decisionReason: string | null;
  evidenceRef: string;
  documentPaths: string[];
  createdAt: string;
  decidedAt: string | null;
  user?: { email: string; fullName: string | null; country: string | null };
}

export interface MyKycStatus {
  kycTier: "TIER_0_UNVERIFIED" | "TIER_1_VERIFIED" | "RESTRICTED";
  latestCase: KycCase | null;
}

export interface Wallet {
  id: string;
  usdcBalance: string;
  frozen: boolean;
  createdAt: string;
}

export function submitKyc(
  token: string,
  idType: IdType,
  idNumber: string,
  country: string,
  documentFront: File,
  documentBack?: File,
) {
  const formData = new FormData();
  formData.append("idType", idType);
  formData.append("idNumber", idNumber);
  formData.append("country", country);
  formData.append("documentFront", documentFront);
  if (documentBack) {
    formData.append("documentBack", documentBack);
  }
  return request<KycCase>("/kyc/submit", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

/** Fetches a KYC document as an authenticated blob URL. Caller is responsible for URL.revokeObjectURL later. */
export async function fetchKycDocumentUrl(token: string, caseId: string, index: number): Promise<string> {
  const res = await fetch(`${API_URL}/kyc/${caseId}/document/${index}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError(`Could not load document (${res.status})`, res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function myKycStatus(token: string) {
  return request<MyKycStatus>("/kyc/my-status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function kycQueue(token: string) {
  return request<KycCase[]>("/kyc/queue", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function approveKyc(token: string, caseId: string) {
  return request<KycCase>(`/kyc/${caseId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function rejectKyc(token: string, caseId: string, reason: string) {
  return request<KycCase>(`/kyc/${caseId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

export function getWallet(token: string) {
  return request<Wallet>("/wallet/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ChainStatus {
  configured: boolean;
  chainWallets: { chain: string; address: string }[];
}

export function getChainStatus(token: string) {
  return request<ChainStatus>("/wallet/chains", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Dev-only mock deposit -- see WalletService.mockDeposit on the API. */
export function depositToWallet(token: string, amountUsdc: number) {
  return request<{ deposit: { id: string; amountUsdc: string; status: string }; usdcBalance: string }>(
    "/wallet/deposit",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amountUsdc }),
    },
  );
}

// ---------- Support tickets ----------

export const TICKET_CATEGORIES = [
  { value: "deposit_issue", label: "Deposit issue" },
  { value: "withdrawal_issue", label: "Withdrawal issue" },
  { value: "kyc_question", label: "KYC question" },
  { value: "funds_missing", label: "Funds missing" },
  { value: "account_access", label: "Account access" },
  { value: "other", label: "Other" },
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]["value"];

export interface SupportTicket {
  id: string;
  category: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  status: "OPEN" | "ESCALATED_FINANCE" | "ESCALATED_KYC" | "RESOLVED" | "CLOSED";
  assignedStaffId: string | null;
  transactionRef: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user?: { email: string; fullName: string | null };
}

export function createTicket(token: string, category: TicketCategory, description: string, transactionRef?: string) {
  return request<SupportTicket>("/support/tickets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ category, description, transactionRef }),
  });
}

export function myTickets(token: string) {
  return request<SupportTicket[]>("/support/tickets/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function ticketQueue(token: string) {
  return request<SupportTicket[]>("/support/tickets", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function claimTicket(token: string, ticketId: string) {
  return request<SupportTicket>(`/support/tickets/${ticketId}/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function resolveTicket(token: string, ticketId: string, resolutionNote: string) {
  return request<SupportTicket>(`/support/tickets/${ticketId}/resolve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resolutionNote }),
  });
}

// ---------- Wallet oversight (Finance manager) ----------

export interface AdminWallet {
  id: string;
  usdcBalance: string;
  frozen: boolean;
  frozenReason: string | null;
  user: { email: string; fullName: string | null; kycTier: string };
  createdAt: string;
}

export function listAllWallets(token: string) {
  return request<AdminWallet[]>("/wallet/admin/all", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function freezeWallet(token: string, walletId: string, reason: string) {
  return request<{ id: string; frozen: boolean; frozenReason: string | null }>(
    `/wallet/admin/${walletId}/freeze`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    },
  );
}

export function unfreezeWallet(token: string, walletId: string) {
  return request<{ id: string; frozen: boolean; frozenReason: string | null }>(
    `/wallet/admin/${walletId}/unfreeze`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

// ---------- Asset listings (Listing admin + Super admin) ----------

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  issuer: string;
  chain: string;
  contractAddress: string | null;
  minOrderUsdc: string;
  feeBps: number;
  coingeckoId: string | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "LIVE" | "DELISTED";
  createdByStaffId: string;
  approvedByStaffId: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface CreateAssetInput {
  symbol: string;
  name: string;
  issuer: string;
  chain: string;
  contractAddress?: string;
  minOrderUsdc: number;
  feeBps?: number;
  coingeckoId?: string;
}

export function createAsset(token: string, input: CreateAssetInput) {
  return request<Asset>("/trading/assets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function listDraftAssets(token: string) {
  return request<Asset[]>("/trading/assets/drafts", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Live listings, priced. `live: true` means price/changePercent24h/sparkline came from
 * CoinGecko's real-time API (apps/api/src/trading/price.service.ts); `live: false` means
 * this asset has no coingeckoId set and fell back to the deterministic mock price
 * (mock-price.ts). Either way, what you buy/sell settles against these same numbers, so
 * display and execution never drift from each other.
 */
export interface MarketAsset extends Asset {
  price: number;
  changePercent24h: number;
  sparkline: number[];
  live: boolean;
}

export function listLiveAssets(token: string) {
  return request<MarketAsset[]>("/trading/assets", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface Order {
  id: string;
  side: "BUY" | "SELL";
  usdcAmount: string;
  quantity: string | null;
  status: "PENDING" | "SETTLED" | "FAILED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
  settledAt: string | null;
  asset: { symbol: string; name: string };
}

export interface AssetPosition {
  id: string;
  quantity: string;
  asset: Asset;
}

export function placeOrder(token: string, assetId: string, side: "BUY" | "SELL", amount: number) {
  return request<Order>("/trading/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assetId, side, amount }),
  });
}

export function myOrders(token: string) {
  return request<Order[]>("/trading/orders/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function myPositions(token: string) {
  return request<AssetPosition[]>("/trading/positions/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function submitAssetForApproval(token: string, assetId: string) {
  return request<Asset>(`/trading/assets/${assetId}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function publishAsset(token: string, assetId: string) {
  return request<Asset>(`/trading/assets/${assetId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------- Audit log (Auditor + Super admin) ----------

export interface AuditLogEntry {
  id: string;
  actorType: "USER" | "STAFF" | "SYSTEM";
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
}

export function auditLog(token: string, limit = 100) {
  return request<AuditLogEntry[]>(`/admin/audit-log?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

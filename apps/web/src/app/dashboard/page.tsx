"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ClipboardList,
  Clock,
  Coins,
  FileSearch,
  LifeBuoy,
  Landmark,
  Plus,
  ShieldQuestion,
  Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react";
import {
  ApiError,
  depositToWallet,
  getToken,
  getWallet,
  myKycStatus,
  superAdminOnly,
  whoami,
  type MyKycStatus,
  type WhoAmI,
  type Wallet,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const ROLE_TOOLS: { roles: string[]; icon: LucideIcon; title: string; description: string; href: string }[] = [
  {
    roles: ["KYC_OFFICER", "SUPER_ADMIN"],
    icon: ClipboardList,
    title: "KYC review queue",
    description: "Review pending identity submissions.",
    href: "/staff/kyc-queue",
  },
  {
    roles: ["SUPPORT_AGENT", "SUPER_ADMIN"],
    icon: LifeBuoy,
    title: "Support queue",
    description: "Respond to open support tickets.",
    href: "/staff/support-queue",
  },
  {
    roles: ["FINANCE_MANAGER", "SUPER_ADMIN"],
    icon: Landmark,
    title: "Wallets",
    description: "View balances, freeze or unfreeze wallets.",
    href: "/staff/wallets",
  },
  {
    roles: ["LISTING_ADMIN", "SUPER_ADMIN"],
    icon: Coins,
    title: "Asset listings",
    description: "Draft, submit, and publish tokenized assets.",
    href: "/staff/listings",
  },
  {
    roles: ["AUDITOR", "SUPER_ADMIN"],
    icon: FileSearch,
    title: "Audit log",
    description: "Review platform activity.",
    href: "/staff/audit-log",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { logout: setLoggedOut } = useAuth();
  const [user, setUser] = useState<WhoAmI | null>(null);
  const [kyc, setKyc] = useState<MyKycStatus | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [rbacResult, setRbacResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [depositAmount, setDepositAmount] = useState("100");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  function refreshWallet(token: string) {
    return getWallet(token)
      .then(setWallet)
      .catch(() => setWallet(null));
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    whoami(token)
      .then(async (me) => {
        setUser(me);
        if (me.kind === "user") {
          const status = await myKycStatus(token);
          setKyc(status);
          if (status.kycTier === "TIER_1_VERIFIED") {
            await refreshWallet(token);
          }
        }
      })
      .catch(() => {
        setLoggedOut();
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onDeposit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setDepositError(null);
    setDepositing(true);
    try {
      await depositToWallet(token, Number(depositAmount));
      await refreshWallet(token);
    } catch (err) {
      setDepositError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setDepositing(false);
    }
  }

  async function tryProtectedRoute() {
    const token = getToken();
    if (!token) return;
    setRbacResult(null);
    try {
      await superAdminOnly(token);
      setRbacResult({ ok: true, message: "200 OK — you have super admin access." });
    } catch (err) {
      if (err instanceof ApiError) {
        setRbacResult({ ok: false, message: `${err.status} — ${err.message}` });
      }
    }
  }

  function logout() {
    setLoggedOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  if (!user) return null;

  const isStaff = user.kind === "staff";
  const tools = isStaff ? ROLE_TOOLS.filter((t) => t.roles.includes(user.role)) : [];
  const caseStatus = kyc?.latestCase?.status;
  const isPendingCase = caseStatus === "PENDING_OFFICER_REVIEW" || caseStatus === "PENDING_AUTO_REVIEW";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-2xl font-semibold tracking-tight">{user.role === "RETAIL_USER" ? "Your account" : roleLabel(user.role)}</h1>
        </div>
        <Badge variant={isStaff ? "accent" : "primary"}>{roleLabel(user.role)}</Badge>
      </div>

      {!isStaff && (
        <div className="mt-6">
          {wallet ? (
            <Card className="overflow-hidden p-0">
              <div className="bg-primary px-6 py-7 text-primary-foreground">
                <p className="flex items-center gap-1.5 text-sm opacity-80">
                  <WalletIcon size={14} strokeWidth={2} /> Available balance
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">
                  ${wallet.usdcBalance}
                  <span className="ml-1.5 text-base font-normal opacity-70">USDC</span>
                </p>
              </div>
              <div className="p-5">
                <form onSubmit={onDeposit} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-10"
                  />
                  <Button type="submit" size="sm" disabled={depositing} className="h-10 shrink-0">
                    <Plus size={14} />
                    {depositing ? "Adding..." : "Add funds"}
                  </Button>
                </form>
                <p className="mt-2 text-xs text-muted-foreground">
                  Simulated instant deposit — no real payment provider is connected yet.
                </p>
                {depositError && <p className="mt-2 text-sm text-destructive">{depositError}</p>}
                <Link
                  href="/transfer"
                  className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Send &amp; receive on-chain
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="flex items-start gap-4 p-6">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  caseStatus === "REJECTED" ? "bg-destructive/10 text-destructive" : isPendingCase ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                }`}
              >
                {caseStatus === "REJECTED" ? (
                  <AlertCircle size={18} />
                ) : isPendingCase ? (
                  <Clock size={18} />
                ) : (
                  <ShieldQuestion size={18} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {caseStatus === "REJECTED"
                    ? "Verification declined"
                    : isPendingCase
                      ? "Verification pending"
                      : "Verify your identity"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPendingCase
                    ? "Your KYC submission is under review. A wallet is provisioned automatically once it's approved."
                    : caseStatus === "REJECTED"
                      ? (kyc?.latestCase?.decisionReason ?? "Your last submission wasn't approved. You can submit again.")
                      : "Complete a quick identity check to get a USDC wallet."}
                </p>
                <Link href="/kyc" className={buttonVariants({ size: "sm", variant: "outline", className: "mt-4" })}>
                  {kyc?.latestCase ? "View status" : "Start verification"}
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}

      {!isStaff && wallet && (
        <Card className="mt-4 flex items-center gap-4 p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Coins size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Markets</p>
            <p className="text-sm text-muted-foreground">Buy and sell tokenized assets.</p>
          </div>
          <Link href="/markets" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Open
          </Link>
        </Card>
      )}

      {tools.map(({ icon: Icon, title, description, href }) => (
        <Card key={href} className="mt-4 flex items-center gap-4 p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Icon size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Link href={href} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Open
          </Link>
        </Card>
      ))}

      {!isStaff && (
        <Card className="mt-4 flex items-center gap-4 p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LifeBuoy size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Need help?</p>
            <p className="text-sm text-muted-foreground">Report an issue to support.</p>
          </div>
          <Link href="/support" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Open
          </Link>
        </Card>
      )}

      <div className="mt-10">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Account</p>
        <Card className="mt-2 divide-y divide-border p-0">
          <Row label="User ID" value={user.id} mono />
          <Row label="Account type" value={roleLabel(user.kind)} />
        </Card>
      </div>

      <details className="mt-6 rounded-lg border border-dashed border-border p-4">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none">
          Developer tools
        </summary>
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Calls a route that only Role.SuperAdmin can access.</p>
          <Button variant="outline" size="sm" onClick={tryProtectedRoute} className="mt-3">
            Try /auth/super-admin-only
          </Button>
          {rbacResult && (
            <p className={`mt-3 text-xs ${rbacResult.ok ? "text-primary" : "text-destructive"}`}>
              {rbacResult.message}
            </p>
          )}
        </div>
      </details>

      <button
        onClick={logout}
        className="mt-8 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Log out
      </button>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

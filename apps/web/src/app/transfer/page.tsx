"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { getChainStatus, getToken, type ChainStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CHAIN_LABEL: Record<string, string> = {
  "ETH-SEPOLIA": "Ethereum",
  "SOL-DEVNET": "Solana",
};

export default function TransferPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    getChainStatus(token)
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !status) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  const notReady = !status.configured || status.chainWallets.length === 0;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Send &amp; receive</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Move USDC on-chain across Ethereum and Solana.
      </p>

      {notReady && (
        <Card className="mt-6 flex items-start gap-4 p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">Not connected yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              On-chain send and receive needs custody wired up first. This becomes live once
              that&apos;s connected -- nothing here is faked in the meantime.
            </p>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <ArrowDownToLine size={16} className="text-primary" />
            <p className="text-sm font-medium">Receive</p>
          </div>
          {status.chainWallets.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              {status.chainWallets.map((w) => (
                <div key={w.chain} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{CHAIN_LABEL[w.chain] ?? w.chain}</p>
                  <p className="mt-1 truncate font-mono text-xs">{w.address}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Your deposit addresses will show up here once custody is connected.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine size={16} className="text-primary" />
            <p className="text-sm font-medium">Send</p>
          </div>
          <SendForm disabled={notReady} />
        </Card>
      </div>
    </main>
  );
}

function SendForm({ disabled }: { disabled: boolean }) {
  const [chain, setChain] = useState("ETH-SEPOLIA");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Wired up once CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET are set -- see CircleService.
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chain">Chain</Label>
        <select
          id="chain"
          value={chain}
          disabled={disabled}
          onChange={(e) => setChain(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground disabled:opacity-50"
        >
          <option value="ETH-SEPOLIA">Ethereum</option>
          <option value="SOL-DEVNET">Solana</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recipient">Recipient address</Label>
        <Input
          id="recipient"
          disabled={disabled}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Amount (USDC)</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.000001"
          disabled={disabled}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={disabled} className="mt-1">
        Send
      </Button>
    </form>
  );
}

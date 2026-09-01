"use client";

import Link from "next/link";
import { Coins, Landmark, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Wallet,
    title: "A USDC wallet, built in",
    description: "Fund your account with local currency or crypto, held as USDC.",
  },
  {
    icon: Coins,
    title: "Tokenized real-world assets",
    description: "Invest in assets already tokenized on platforms like Ondo and xStocks.",
  },
  {
    icon: Landmark,
    title: "African markets, next",
    description: "Tokenized local assets from markets like Ghana's are on the roadmap.",
  },
];

export default function Home() {
  const { isLoggedIn } = useAuth();

  return (
    <main className="flex flex-1 flex-col items-center px-4 sm:px-6">
      <section className="flex flex-col items-center py-16 text-center sm:py-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Real wealth assets, tokenized and open to Africa.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Hold a USDC wallet, invest in tokenized real-world assets, and — soon — access tokenized
          assets from African markets, all from one account.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          {isLoggedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "default" })}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/register" className={buttonVariants({ size: "default" })}>
                Create an account
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "default" })}>
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid w-full max-w-4xl gap-4 pb-16 sm:grid-cols-3 sm:pb-24">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="p-6">
            <Icon className="text-primary" size={22} strokeWidth={1.75} />
            <h2 className="mt-4 text-base font-medium">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}

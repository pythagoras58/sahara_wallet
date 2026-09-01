import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">About us</h1>
      <div className="mt-6 flex flex-col gap-4 text-sm text-muted-foreground">
        <p>
          Sahara Wallet gives people across Africa direct access to tokenized real-world assets.
          Fund a wallet in USDC — from local currency or by depositing other digital coins — and
          invest in assets already tokenized on established platforms like Ondo and xStocks.
        </p>
        <p>
          Most African markets have limited or no direct access to these instruments today. We're
          building the account that closes that gap: one wallet, one identity check, and a
          straightforward way in.
        </p>
        <p>
          Longer term, we want the same access to run in both directions — tokenizing assets from
          African markets themselves, starting with already-listed companies, so people outside
          those markets can invest in them too.
        </p>
      </div>

      <Card className="mt-8 p-6">
        <p className="text-sm font-medium">Where we are today</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sahara Wallet is early — currently in development, with a small set of tokenized assets
          and a limited set of markets supported while we work through the regulatory and custody
          groundwork a platform like this needs before it can respond for real money at scale.
        </p>
      </Card>
    </main>
  );
}

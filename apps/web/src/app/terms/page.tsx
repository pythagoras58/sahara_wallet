import { DraftNotice } from "@/components/draft-notice";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: not yet published.</p>
      <DraftNotice />

      <div className="mt-8 flex flex-col gap-8 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-medium text-foreground">Acceptance of terms</h2>
          <p className="mt-2">
            By creating an account you agree to these terms. If you don't agree, don't use Sahara
            Wallet.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Eligibility</h2>
          <p className="mt-2">
            You must be old enough to enter a binding contract where you live, and pass our
            identity verification before you can fund a wallet or hold assets.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Your account</h2>
          <p className="mt-2">
            Keep your login details secure and your account information accurate. You're
            responsible for activity on your account.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Investment risk</h2>
          <p className="mt-2">
            Tokenized assets can lose value, and past performance doesn't guarantee future
            results. We don't provide investment advice, and nothing in the app should be read as
            a recommendation. Only invest what you can afford to lose.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Fees and execution</h2>
          <p className="mt-2">
            Fees for deposits, withdrawals, and trades are shown before you confirm a transaction.
            Orders are routed to the relevant issuer or venue and may fail to settle for reasons
            outside our control.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Prohibited use</h2>
          <p className="mt-2">
            No fraud, money laundering, or using the platform to move funds you're not entitled
            to. We can freeze or close an account we reasonably suspect is being used this way.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Limitation of liability</h2>
          <p className="mt-2">
            Sahara Wallet is provided as-is. To the extent the law allows, we're not liable for
            losses arising from market movements, third-party service failures, or events outside
            our reasonable control.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Changes to these terms</h2>
          <p className="mt-2">
            We may update these terms as the product changes. Material changes will be
            communicated before they take effect.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Contact</h2>
          <p className="mt-2">Questions about these terms — see the Contact us page.</p>
        </section>
      </div>
    </main>
  );
}

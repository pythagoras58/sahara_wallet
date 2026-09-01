import { DraftNotice } from "@/components/draft-notice";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: not yet published.</p>
      <DraftNotice />

      <div className="mt-8 flex flex-col gap-8 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-medium text-foreground">Information we collect</h2>
          <p className="mt-2">
            Account details you give us (name, email or phone, date of birth, country); identity
            documents and a selfie for verification; transaction data (deposits, withdrawals,
            trades, and balances); and basic device and usage data when you use the app.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">How we use it</h2>
          <p className="mt-2">
            To verify your identity, process transactions, meet anti-money-laundering and other
            regulatory obligations, keep the platform secure, and improve the product.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Who we share it with</h2>
          <p className="mt-2">
            Identity verification vendors, custody and payment providers we work with to move your
            funds, and regulators or law enforcement when we're legally required to. We don't sell
            your data to advertisers.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Security and retention</h2>
          <p className="mt-2">
            We keep account and transaction records for as long as applicable financial
            recordkeeping rules require, and no longer than necessary beyond that.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Your rights</h2>
          <p className="mt-2">
            You can ask to see, correct, or request deletion of your personal data, subject to
            what we're required to retain for legal and regulatory reasons. Contact us to make a
            request.
          </p>
        </section>
        <section>
          <h2 className="text-base font-medium text-foreground">Contact</h2>
          <p className="mt-2">Questions about this policy — see the Contact us page.</p>
        </section>
      </div>
    </main>
  );
}

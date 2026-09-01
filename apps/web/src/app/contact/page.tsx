import Link from "next/link";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Have a question or ran into an issue? Here's how to reach us.
      </p>

      <Card className="mt-6 flex items-center gap-4 p-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Mail size={18} />
        </div>
        <div>
          <p className="text-sm font-medium">Email</p>
          <a href="mailto:support@saharawallet.dev" className="text-sm text-primary hover:underline">
            support@saharawallet.dev
          </a>
        </div>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account and need help with something specific — a deposit, a KYC
        submission, anything tied to your account — signing in and{" "}
        <Link href="/support" className="text-primary hover:underline">
          opening a support ticket
        </Link>{" "}
        gets you routed to the right person faster than email.
      </p>
    </main>
  );
}

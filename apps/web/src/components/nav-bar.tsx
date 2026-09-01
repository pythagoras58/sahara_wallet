"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function NavBar() {
  const { isLoggedIn } = useAuth();

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Image
            src="/logo.jpg"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-full object-cover"
            priority
            unoptimized
          />
          <span className="truncate text-lg font-semibold tracking-tight">Sahara Wallet</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 text-sm sm:gap-3">
          <ThemeToggle />
          {isLoggedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
              >
                Log in
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                <span className="hidden sm:inline">Create account</span>
                <span className="sm:hidden">Sign up</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

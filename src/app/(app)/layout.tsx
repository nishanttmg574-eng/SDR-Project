import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettings, isConfigured } from "@/lib/settings";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  if (!isConfigured(settings)) {
    redirect("/settings");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {settings.workspace}
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/accounts/new" className="btn-primary">
              + New account
            </Link>
            <Link href="/import" className="btn-secondary">
              Import
            </Link>
            <Link href="/settings" className="btn-secondary">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}

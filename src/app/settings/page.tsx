import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Placeholder — wired up just to prove routing works.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-blue-600 underline"
      >
        ← Back to workspace
      </Link>
    </main>
  );
}

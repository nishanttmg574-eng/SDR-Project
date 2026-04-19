import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Account Workspace</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Skeleton — no features yet.
      </p>
      <Link
        href="/settings"
        className="mt-6 inline-block text-blue-600 underline"
      >
        Settings (routing test) →
      </Link>
    </main>
  );
}

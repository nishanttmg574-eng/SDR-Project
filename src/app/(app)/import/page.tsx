import Link from "next/link";
import { ImportClient } from "@/components/ImportClient";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Import accounts</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to accounts
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Drop a CSV or XLSX file. Rows with matching names will be updated; new names will be added.
      </p>
      <div className="mt-6">
        <ImportClient />
      </div>
    </div>
  );
}

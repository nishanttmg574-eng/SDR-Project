import Link from "next/link";
import { createAccountAction } from "@/lib/actions";

export default function NewAccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">New account</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Cancel
        </Link>
      </div>

      <form action={createAccountAction} className="mt-6 space-y-5">
        <Field label="Name" required>
          <input name="name" required className="input" autoFocus />
        </Field>
        <Field label="Website">
          <input
            name="website"
            type="url"
            placeholder="https://example.com"
            className="input"
          />
        </Field>
        <Field label="Industry">
          <input name="industry" className="input" />
        </Field>
        <Field label="HQ location">
          <input name="location" placeholder="City, Country" className="input" />
        </Field>
        <Field label="Headcount">
          <input
            name="headcount"
            placeholder="e.g. 50-200, 1k+, 10,000"
            className="input"
          />
        </Field>

        <div className="pt-2">
          <button type="submit" className="btn-primary">
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

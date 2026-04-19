import Link from "next/link";
import { DEFAULT_MODEL } from "@/lib/config";
import { getSettings, isConfigured } from "@/lib/settings";
import { saveSettingsAction } from "@/lib/actions";

export default function SettingsPage() {
  const settings = getSettings();
  const firstRun = !isConfigured(settings);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {!firstRun && (
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to accounts
          </Link>
        )}
      </div>

      {firstRun && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="font-medium">Welcome to Account Workspace</div>
          <p className="mt-1">
            Fill in the basics so the app knows what you sell and what a Tier 1 account
            looks like. You can change these any time.
          </p>
        </div>
      )}

      <form action={saveSettingsAction} className="mt-8 space-y-6">
        <Field
          label="Workspace name"
          hint="Shown at the top of the app. Example: Acme SDR Worksheet."
        >
          <input
            name="workspace"
            defaultValue={settings.workspace}
            className="input"
            required
          />
        </Field>

        <Field
          label="Company description"
          hint="One or two sentences on what you sell. Used to frame AI scoring later."
        >
          <textarea
            name="company"
            defaultValue={settings.company}
            rows={3}
            className="input"
          />
        </Field>

        <Field
          label="Tier 1 definition"
          hint="What does an ideal account look like? Industry, size, signals, geography."
        >
          <textarea
            name="tier1Def"
            defaultValue={settings.tier1Def}
            rows={4}
            className="input"
          />
        </Field>

        <Field
          label="Other tier definitions"
          hint="Tier 2, 3, 4 — what distinguishes each from Tier 1?"
        >
          <textarea
            name="tiersDef"
            defaultValue={settings.tiersDef}
            rows={4}
            className="input"
          />
        </Field>

        <Field label="AI model" hint={`Default: ${DEFAULT_MODEL}`}>
          <input name="model" defaultValue={settings.model} className="input" />
        </Field>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary">
            Save settings
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-neutral-800">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-neutral-500">{hint}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

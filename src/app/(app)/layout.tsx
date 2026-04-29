import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSettings, isConfigured } from "@/lib/settings";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  if (!isConfigured(settings)) {
    redirect("/settings");
  }

  return (
    <div className="min-h-screen">
      <AppHeader workspace={settings.workspace} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/layout/nav";

const DEMO_COOKIE = "demo_session";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url !== "" && !url.includes("your-project.supabase.co");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const isDemo = !isSupabaseConfigured();

  if (!isDemo) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  } else {
    const cookieStore = await cookies();
    const demoToken = cookieStore.get(DEMO_COOKIE)?.value;
    if (!demoToken) redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Nav />
      <main className="flex-1 overflow-auto">
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-6 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
            Demo Mode — Supabase not configured. Auth and data are local only.{" "}
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-medium">
              Set up Supabase
            </a>{" "}
            to enable full functionality.
          </div>
        )}
        <div className="p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}

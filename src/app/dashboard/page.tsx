import { redirect } from "next/navigation";
import { createAuthClient, isAdminEmail } from "@/lib/supabase/server";
import AdminConsole from "./admin-console";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/login");

  return <AdminConsole email={user.email ?? ""} />;
}

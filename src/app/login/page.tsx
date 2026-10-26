import { redirect } from "next/navigation";
import { createAuthClient, isAdminEmail } from "@/lib/supabase/server";
import SignInButton from "./sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isAdminEmail(user?.email)) redirect("/dashboard");

  const { error } = await searchParams;
  const message =
    error === "not_authorized"
      ? "This account is not on the admin allowlist."
      : error
        ? "Sign-in could not be completed. Please try again."
        : "";

  return (
    <main className="login-panel">
      <h1>Beyond Syllabus Admin</h1>
      <p>Sign in with an admin account to continue.</p>
      {message ? <p className="error" role="alert">{message}</p> : null}
      <SignInButton />
    </main>
  );
}

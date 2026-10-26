"use client";

import { createBrowserClient } from "@supabase/ssr";

export default function SignInButton() {
  async function signIn() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      window.alert("Set the Supabase public URL and publishable key before signing in.");
      return;
    }

    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) window.alert(`Sign-in failed: ${error.message}`);
  }

  return <button onClick={signIn}>Sign in with Google</button>;
}

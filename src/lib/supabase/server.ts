import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL in the environment.");
  return url;
}

export async function createAuthClient() {
  const cookieStore = await cookies();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the environment.",
    );
  }

  return createServerClient(getSupabaseUrl(), key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server components cannot write cookies; middleware-free reads remain valid.
        }
      },
    },
  });
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Set SUPABASE_SECRET_KEY in the environment.");
  return createSupabaseClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminEmail(email: string | undefined) {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

// -- WARNING: This schema is for context only and is not meant to be run.
// -- Table order and constraints may not be valid for execution.

// CREATE TABLE public.profiles (
//   first_name text,
//   last_name text,
//   email text,
//   id uuid NOT NULL,
//   major text,
//   target_role text,
//   CONSTRAINT profiles_pkey PRIMARY KEY (id),
//   CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
// );
// CREATE TABLE public.departments (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   name text NOT NULL,
//   code text NOT NULL UNIQUE,
//   bulletin_url text,
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   CONSTRAINT departments_pkey PRIMARY KEY (id)
// );
// CREATE TABLE public.courses (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   department_id uuid NOT NULL,
//   course_code text NOT NULL UNIQUE,
//   title text NOT NULL,
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   resume_relevant boolean NOT NULL DEFAULT true,
//   CONSTRAINT courses_pkey PRIMARY KEY (id),
//   CONSTRAINT courses_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
// );
// CREATE TABLE public.courses_2627catalog_versions (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   course_id uuid NOT NULL,
//   academic_year text NOT NULL,
//   description text,
//   prerequisites text,
//   credits numeric CHECK (credits IS NULL OR credits >= 0::numeric),
//   source_url text,
//   retrieved_at timestamp with time zone NOT NULL DEFAULT now(),
//   CONSTRAINT courses_2627catalog_versions_pkey PRIMARY KEY (id),
//   CONSTRAINT course_catalog_versions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
// );
// CREATE TABLE public.course_offerings (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   course_id uuid NOT NULL,
//   semester text NOT NULL CHECK (semester = ANY (ARRAY['Spring'::text, 'Summer'::text, 'Fall'::text])),
//   year integer NOT NULL CHECK (year >= 1900 AND year <= 2200),
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   topic_title text,
//   topic_description text,
//   topic_source_url text,
//   topic_verified boolean NOT NULL DEFAULT false,
//   offering_identity_key text NOT NULL,
//   grouping_status text NOT NULL CHECK (grouping_status = ANY (ARRAY['shared'::text, 'separate'::text, 'unknown'::text, 'needs_review'::text])),
//   CONSTRAINT course_offerings_pkey PRIMARY KEY (id),
//   CONSTRAINT course_offerings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
// );
// CREATE TABLE public.syllabi (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   offering_id uuid NOT NULL,
//   uploaded_by uuid,
//   source_url text,
//   storage_path text,
//   file_type text,
//   extracted_text text,
//   is_public boolean NOT NULL DEFAULT false,
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   processing_status text NOT NULL DEFAULT 'pending'::text CHECK (processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
//   verification_status text NOT NULL DEFAULT 'unverified'::text CHECK (verification_status = ANY (ARRAY['unverified'::text, 'verified'::text, 'rejected'::text])),
//   content_hash text,
//   CONSTRAINT syllabi_pkey PRIMARY KEY (id),
//   CONSTRAINT syllabi_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
//   CONSTRAINT syllabi_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
// );
// CREATE TABLE public.course_skills (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   course_id uuid NOT NULL,
//   skill_name text NOT NULL,
//   source_type text NOT NULL CHECK (source_type = ANY (ARRAY['bulletin'::text, 'syllabus'::text, 'student_verified'::text])),
//   source_reference text,
//   evidence text,
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   catalog_version_id uuid,
//   syllabus_id uuid,
//   CONSTRAINT course_skills_pkey PRIMARY KEY (id),
//   CONSTRAINT course_skills_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
//   CONSTRAINT course_skills_catalog_version_id_fkey FOREIGN KEY (catalog_version_id) REFERENCES public.courses_2627catalog_versions(id),
//   CONSTRAINT course_skills_syllabus_id_fkey FOREIGN KEY (syllabus_id) REFERENCES public.syllabi(id)
// );
// CREATE TABLE public.ai_generations (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   user_id uuid NOT NULL,
//   course_id uuid NOT NULL,
//   target_role text NOT NULL,
//   job_description text,
//   prompt text NOT NULL,
//   generated_resume_bullet ARRAY,
//   model_name text,
//   is_public boolean NOT NULL DEFAULT false,
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   offering_id uuid,
//   syllabus_id uuid,
//   generated_skillset ARRAY,
//   item_type text NOT NULL DEFAULT 'resume_bullet'::text CHECK (item_type = ANY (ARRAY['skill'::text, 'resume_bullet'::text])),
//   generated_text text,
//   category text,
//   evidence text,
//   CONSTRAINT ai_generations_pkey PRIMARY KEY (id),
//   CONSTRAINT ai_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
//   CONSTRAINT ai_generations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
//   CONSTRAINT ai_generations_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
//   CONSTRAINT ai_generations_syllabus_id_fkey FOREIGN KEY (syllabus_id) REFERENCES public.syllabi(id)
// );
// CREATE TABLE public.votes (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   user_id uuid NOT NULL,
//   generation_id uuid NOT NULL,
//   vote_value smallint NOT NULL CHECK (vote_value = ANY (ARRAY['-1'::integer, 1])),
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   CONSTRAINT votes_pkey PRIMARY KEY (id),
//   CONSTRAINT votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
//   CONSTRAINT votes_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES public.ai_generations(id)
// );
// CREATE TABLE public.user_courses (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   user_id uuid NOT NULL,
//   status text NOT NULL DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['completed'::text, 'in_progress'::text, 'planned'::text])),
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   course_id uuid NOT NULL,
//   CONSTRAINT user_courses_pkey PRIMARY KEY (id),
//   CONSTRAINT user_courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
//   CONSTRAINT user_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
// );
// CREATE TABLE public.professors (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   name text NOT NULL,
//   normalized_name text DEFAULT lower(regexp_replace(btrim(name), '[[:space:]]+'::text, ' '::text, 'g'::text)) UNIQUE,
//   created_at timestamp with time zone DEFAULT now(),
//   CONSTRAINT professors_pkey PRIMARY KEY (id)
// );
// CREATE TABLE public.offering_sections (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   offering_id uuid NOT NULL,
//   section text,
//   call_number text,
//   schedule text,
//   location text,
//   source_url text,
//   legacy_offering_id uuid UNIQUE,
//   created_at timestamp with time zone DEFAULT now(),
//   section_type text CHECK (section_type IS NULL OR (section_type = ANY (ARRAY['lecture'::text, 'recitation'::text, 'discussion'::text, 'lab'::text, 'seminar'::text, 'other'::text]))),
//   CONSTRAINT offering_sections_pkey PRIMARY KEY (id),
//   CONSTRAINT offering_sections_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id)
// );
// CREATE TABLE public.offering_professors (
//   offering_id uuid NOT NULL,
//   professor_id uuid NOT NULL,
//   CONSTRAINT offering_professors_pkey PRIMARY KEY (offering_id, professor_id),
//   CONSTRAINT offering_professors_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
//   CONSTRAINT offering_professors_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.professors(id)
// );
// CREATE TABLE public.course_skill_votes (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   course_skill_id uuid NOT NULL,
//   user_id uuid NOT NULL,
//   vote smallint NOT NULL CHECK (vote = ANY (ARRAY['-1'::integer, 1])),
//   created_at timestamp with time zone NOT NULL DEFAULT now(),
//   CONSTRAINT course_skill_votes_pkey PRIMARY KEY (id),
//   CONSTRAINT course_skill_votes_course_skill_id_fkey FOREIGN KEY (course_skill_id) REFERENCES public.course_skills(id),
//   CONSTRAINT course_skill_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
// );

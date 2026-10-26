export type AdminResource = {
  label: string;
  table?: string;
  key?: string;
  readOnly?: boolean;
  description?: string;
};

export const ADMIN_RESOURCES: Record<string, AdminResource> = {
  users: {
    label: "Users",
    readOnly: true,
    description: "Supabase Auth users",
  },
  prompt_chains: { label: "Prompt chains", table: "prompt_chains" },
  prompt_chain_steps: {
    label: "Prompt chain steps",
    table: "prompt_chain_steps",
  },
  prompt_chain_mix: {
    label: "Prompt chain mix",
    table: "prompt_chain_mix",
    key: "prompt_chain_id",
  },
  terms: { label: "Terms", table: "terms" },
  ai_generated_media: {
    label: "AI generated media",
    table: "ai_generated_media",
    readOnly: true,
  },
  ai_generations: {
    label: "AI generations",
    table: "ai_generations",
    readOnly: true,
    description: "Includes generated syllabus skills and resume bullets",
  },
  generation_requests: {
    label: "Generation requests",
    table: "generation_requests",
    readOnly: true,
  },
  ai_generation_examples: {
    label: "AI generation examples",
    table: "ai_generation_examples",
  },
  llm_models: { label: "LLM models", table: "llm_models" },
  llm_providers: { label: "LLM providers", table: "llm_providers" },
  llm_responses: {
    label: "LLM responses",
    table: "llm_responses",
    readOnly: true,
  },
  allowed_signup_domains: {
    label: "Allowed signup domains",
    table: "allowed_signup_domains",
    key: "domain",
  },
  whitelisted_emails: {
    label: "Whitelisted e-mail addresses",
    table: "whitelisted_emails",
    key: "email",
  },
  syllabi: {
    label: "Syllabi",
    table: "syllabi",
    readOnly: true,
    description: "Syllabus upload records",
  },
  images: { label: "Images", table: "images" },
};

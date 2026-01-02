/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SEALION_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

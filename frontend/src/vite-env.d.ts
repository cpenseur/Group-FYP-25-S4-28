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

declare module "*.mov" {
  const src: string;
  export default src;
}

declare module "*.MOV" {
  const src: string;
  export default src;
}

declare module "*.mp4" {
  const src: string;
  export default src;
}

declare module "*.MP4" {
  const src: string;
  export default src;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" in work-in-progress builds (`.env.wip`): shows the WIP badge and menu tag. */
  readonly VITE_WIP_BADGE?: string;
}

import { invoke } from "@tauri-apps/api/core";

export interface Status {
  app_folder: string;
  db_path: string;
  db_exists: boolean;
  schema_version: number;
  backup_count: number;
  last_backup: string | null;
  disk_changed: boolean;
}

export interface Loaded {
  note: string;
}

/** Shape of the errors the Rust side returns. `code` is what we branch on. */
export interface AppError {
  code: "disk_changed" | "db" | "io";
  message: string;
}

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as AppError).code === "string" &&
    typeof (e as AppError).message === "string"
  );
}

export const api = {
  status: () => invoke<Status>("status"),
  load: () => invoke<Loaded>("load"),
  save: (note: string) => invoke<void>("save", { note }),
  reload: () => invoke<Loaded>("reload"),
  makeBackup: () => invoke<string | null>("make_backup"),
};

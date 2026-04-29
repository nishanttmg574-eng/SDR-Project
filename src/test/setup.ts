import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "account-workspace-test-"));

process.env.ACCOUNT_WORKSPACE_DB_PATH = path.join(testDir, "workspace.db");

afterAll(async () => {
  const { db } = await import("@/lib/db");
  db.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

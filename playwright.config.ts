import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// A virtualenv keeps its interpreter in Scripts/ on Windows and in bin/ elsewhere.
const isWindows = process.platform === "win32";
const localPythonPath = isWindows ? join(".venv", "Scripts", "python.exe") : join(".venv", "bin", "python");
const systemPython = isWindows ? "python" : "python3";
const localPython = existsSync(localPythonPath) ? `"${localPythonPath}"` : systemPython;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:8420",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${localPython} -m uvicorn server.api:app --host 127.0.0.1 --port 8420`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    url: "http://127.0.0.1:8420/api/health",
  },
});

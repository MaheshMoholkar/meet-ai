// Imported first by the worker entry point, before anything reads process.env.
// The whole stack (web, worker, agent, speech) shares one .env at the repository
// root; every tool here runs from apps/web. Existing variables are never overridden.
try {
  process.loadEnvFile("../../.env");
} catch {
  // No .env file: rely on the process environment (CI, containers).
}

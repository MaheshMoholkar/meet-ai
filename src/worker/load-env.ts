// Imported first by the worker entry point, before anything reads process.env.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the process environment (containers).
}

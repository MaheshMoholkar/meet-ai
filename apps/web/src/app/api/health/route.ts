// Load-balancer health check: the process is up. Deliberately touches no dependencies.
export function GET() {
  return Response.json({ ok: true });
}

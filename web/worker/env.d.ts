// The few Cloudflare Workers runtime types the Worker uses, without pulling in the full type package.
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

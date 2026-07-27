/**
 * @kernel/extension/application — barrel.
 *
 * The application layer of the extension bounded context: the `installPlugin`
 * use-case (boot / protocol-install time — OUTSIDE the deterministic core)
 * and the pure `listByProtocol` / `listProviding` query helpers.
 *
 * No I/O of its own; no `Date.now()` / `Math.random()`. `installPlugin`
 * `await`s `plugin.register(host)` (which MAY be async for a remote plugin)
 * but performs no I/O itself.
 *
 * Public surface (re-exported through `@kernel/extension`):
 *   - `installPlugin` (use-case)
 *   - `listByProtocol`, `listProviding` (pure query helpers)
 */
export * from "./install-plugin";
export * from "./list-extensions";

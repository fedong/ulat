import { diffKlassOps, type ApiOp, type Klass } from "@ulat/grade-math";
import { api, ApiError } from "./api";
import { useUlat } from "./store";

/**
 * Optimistic sync, mirroring the web app: writes apply to the store first,
 * then the shared diff (grade-math/apiops) becomes ordered API calls on a
 * single retrying queue. A save that still fails raises one toast; the
 * on-screen state stays as typed.
 */

let chain: Promise<void> = Promise.resolve();
let pendingN = 0;
let errorToasted = false;

const isTransient = (e: unknown) =>
  !(e instanceof ApiError) || e.status >= 500 || e.status === 429;

const run = (op: ApiOp) => {
  if (op.method === "POST") return api.post(op.path, op.body);
  if (op.method === "PATCH") return api.patch(op.path, op.body);
  if (op.method === "PUT") return api.put(op.path, op.body);
  return api.del(op.path, op.body);
};

async function runOp(op: ApiOp) {
  for (let attempt = 0; ; attempt++) {
    try {
      await run(op);
      errorToasted = false;
      return;
    } catch (e) {
      if (attempt < 2 && isTransient(e)) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) * (attempt + 1)));
        continue;
      }
      console.error("[ulat sync]", e);
      if (!errorToasted) {
        errorToasted = true;
        const s = useUlat.getState();
        s.toast(
          s.lang === "Filipino"
            ? "May hindi na-save — suriin ang koneksyon"
            : "Some changes didn't save — check your connection",
        );
      }
      return; // drop this op, keep the queue alive
    }
  }
}

export function enqueue(ops: ApiOp[]) {
  if (!ops.length) return;
  pendingN += ops.length;
  for (const op of ops)
    chain = chain.then(async () => {
      await runOp(op);
      pendingN--;
    });
}

export const syncIdle = () => pendingN === 0;

/** Diff one optimistic patch into ordered API calls and queue them. */
export function syncClassPatch(prev: Klass, next: Klass, patch: Partial<Klass>) {
  enqueue(diffKlassOps(prev, next, patch));
}

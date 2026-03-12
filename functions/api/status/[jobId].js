import { fail, ok, preflight } from "../../_lib/http.js";
import { getJobStatus } from "../../_lib/usage.js";

export function onRequestOptions(context) {
  return preflight(context.request, "GET,OPTIONS");
}

export async function onRequestGet(context) {
  try {
    const job = await getJobStatus(context, context.params.jobId);
    return ok(context.request, { job }, { methods: "GET,OPTIONS" });
  } catch (error) {
    return fail(context.request, error, { methods: "GET,OPTIONS" });
  }
}

/** Consistent JSON envelope for the reseller API. */
export function apiOk(data: Record<string, unknown>, status = 200): Response {
  return Response.json({ ok: true, ...data }, { status });
}

export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/** 401 helper — missing/invalid API key. */
export function apiUnauthorized(): Response {
  return apiError(401, "unauthorized", "API key tidak valid atau tidak ada. Kirim header: Authorization: Bearer <api_key>.");
}

import { readFileSync, writeFileSync } from "node:fs";
import { manifest } from "./cases.mjs";

const pageInfo = { has_next_page: false, has_previous_page: false, start_cursor: null, end_cursor: null };

function listEnvelope(data) {
  return { data, page_info: pageInfo };
}

function resources(item) {
  const initial = item.initial;
  return [
    item.id,
    initial.member?.id,
    ...(initial.payments ?? []).map((value) => value.id),
    ...(initial.memberships ?? []).map((value) => value.id),
    ...(initial.resolutionCases ?? []).map((value) => value.id),
    ...(initial.invoices ?? []).map((value) => value.id),
    ...(initial.paymentMethods ?? []).map((value) => value.id),
  ].filter(Boolean);
}

function deepValues(value) {
  if (Array.isArray(value)) return value.flatMap(deepValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(deepValues);
  return [value];
}

function caseFor(state, apiPath, query, body) {
  const values = [...Object.values(query ?? {}), ...deepValues(body ?? {})].map(String);
  return state.cases.find((item) => {
    const ids = resources(item);
    if (ids.some((id) => apiPath.includes(id) || values.includes(String(id)))) return true;
    const name = item.initial.member?.name;
    if (name && values.some((value) => value.toLowerCase() === name.toLowerCase())) return true;
    const candidates = [item.initial.member, ...(item.initial.payments ?? []), ...(item.initial.memberships ?? []), ...(item.initial.resolutionCases ?? []), ...(item.initial.invoices ?? []), ...(item.initial.paymentMethods ?? [])].filter(Boolean);
    return Object.keys(query ?? {}).length > 0 && candidates.some((candidate) => Object.entries(query).every(([key, expected]) => String(candidate[key] ?? "") === String(expected)));
  }) ?? null;
}

function getAll(state, key) {
  return state.cases.flatMap((item) => item.initial[key] ?? []);
}

function findById(state, key, id) {
  for (const item of state.cases) {
    const value = (item.initial[key] ?? []).find((candidate) => candidate.id === id);
    if (value) return { item, value };
  }
  return { item: null, value: null };
}

function matchesQuery(value, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (["limit", "page"].includes(key)) return true;
    if (key === "name") return String(value.name ?? "").toLowerCase().includes(String(expected).toLowerCase());
    if (key === "status") return String(value.status ?? "") === String(expected);
    return String(value[key] ?? "") === String(expected);
  });
}

function fingerprint(method, apiPath, body) {
  return JSON.stringify({ method, apiPath, body });
}

function normalizeRequest(input) {
  const method = String(input.method ?? "GET").toUpperCase();
  const apiPath = String(input.path ?? "/").replace(/^\/api\/v1/, "").replace(/\?.*$/, "") || "/";
  return {
    method,
    apiPath: apiPath.startsWith("/") ? apiPath : `/${apiPath}`,
    query: input.query && typeof input.query === "object" ? input.query : {},
    body: input.body && typeof input.body === "object" ? input.body : {},
    idempotencyKey: input.idempotency_key ?? null,
  };
}

export function executeRequest(state, input) {
  const { method, apiPath, query, body, idempotencyKey } = normalizeRequest(input);
  state.toolCalls = (state.toolCalls ?? 0) + 1;
  state.idempotency ??= {};
  state.audit ??= [];
  const item = caseFor(state, apiPath, query, body);
  const event = {
    timestamp: new Date().toISOString(),
    method,
    apiPath,
    query,
    body,
    idempotencyKey,
    caseId: item?.id ?? null,
    replayed: false,
    status: 404,
  };

  const finish = (status, value) => {
    event.status = status;
    if (idempotencyKey && !["GET", "HEAD"].includes(method) && status >= 200 && status < 300) {
      state.idempotency[idempotencyKey] = { fingerprint: fingerprint(method, apiPath, body), status, value: structuredClone(value) };
    }
    state.audit.push(event);
    return { status, value, event };
  };

  if (state.toolCalls > manifest.toolCallLimit) {
    return finish(429, { error: { type: "tool_call_budget_exhausted", message: `The ${manifest.toolCallLimit}-call benchmark budget is exhausted.` } });
  }

  if (idempotencyKey && !["GET", "HEAD"].includes(method)) {
    const prior = state.idempotency[idempotencyKey];
    if (prior) {
      if (prior.fingerprint !== fingerprint(method, apiPath, body)) return finish(409, { error: { type: "idempotency_conflict", message: "This idempotency key was already used for a different request." } });
      event.replayed = true;
      event.status = prior.status;
      state.audit.push(event);
      return { status: prior.status, value: structuredClone(prior.value), event };
    }
  }

  if (method === "GET" && apiPath === "/accounts/me") {
    return finish(200, { id: "biz_cmops_01", name: "Northstar Creator School" });
  }

  if (method === "GET" && apiPath === "/members") {
    return finish(200, listEnvelope(state.cases.map((candidate) => candidate.initial.member).filter((value) => matchesQuery(value, query))));
  }
  const memberMatch = apiPath.match(/^\/members\/([^/]+)$/);
  if (method === "GET" && memberMatch) {
    const found = state.cases.find((candidate) => candidate.initial.member?.id === memberMatch[1]);
    return found ? finish(200, found.initial.member) : finish(404, { error: { type: "not_found", message: "Member not found." } });
  }

  if (method === "GET" && apiPath === "/payments") {
    return finish(200, listEnvelope(getAll(state, "payments").filter((value) => matchesQuery(value, query))));
  }
  const paymentMatch = apiPath.match(/^\/payments\/([^/]+)$/);
  if (method === "GET" && paymentMatch) {
    const { value } = findById(state, "payments", paymentMatch[1]);
    if (!value) return finish(404, { error: { type: "not_found", message: "Payment not found." } });
    if (value.settle_on_next_read) {
      value.status = "succeeded";
      value.paid_at = manifest.frozenAt;
      delete value.settle_on_next_read;
    }
    return finish(200, value);
  }
  const retryMatch = apiPath.match(/^\/payments\/([^/]+)\/retry$/);
  if (method === "POST" && retryMatch) {
    const { item: owner, value: payment } = findById(state, "payments", retryMatch[1]);
    if (!payment) return finish(404, { error: { type: "not_found", message: "Payment not found." } });
    payment.retry_count = (payment.retry_count ?? 0) + 1;
    if (payment.retryable) {
      payment.status = "succeeded";
      payment.paid_at = manifest.frozenAt;
      const membership = owner.initial.memberships?.find((value) => value.id === payment.membership_id);
      if (membership) {
        membership.status = "active";
        membership.access_status = "active";
      }
    }
    return finish(200, payment);
  }
  const refundMatch = apiPath.match(/^\/payments\/([^/]+)\/refund$/);
  if (method === "POST" && refundMatch) {
    const { value: payment } = findById(state, "payments", refundMatch[1]);
    if (!payment) return finish(404, { error: { type: "not_found", message: "Payment not found." } });
    const amount = Number(body.amount ?? payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) return finish(422, { error: { type: "validation_error", message: "amount must be a positive number." } });
    payment.refunded_amount = Math.min(payment.amount, (payment.refunded_amount ?? 0) + amount);
    payment.status = payment.refunded_amount >= payment.amount ? "refunded" : "partially_refunded";
    return finish(200, payment);
  }
  if (method === "POST" && apiPath === "/payments") {
    const owner = state.cases.find((candidate) => candidate.initial.member?.id === body.member_id);
    if (!owner) return finish(404, { error: { type: "not_found", message: "Member not found." } });
    const allowedKeys = new Set(["company_id", "member_id", "payment_method_id", "plan", "product", "metadata"]);
    const valid = Object.keys(body).every((key) => allowedKeys.has(key))
      && typeof body.company_id === "string"
      && typeof body.member_id === "string"
      && typeof body.payment_method_id === "string"
      && Number.isFinite(body.plan?.initial_price)
      && typeof body.plan?.currency === "string"
      && body.plan?.plan_type === "one_time"
      && typeof body.product?.title === "string"
      && typeof body.metadata?.authorization_id === "string";
    if (!valid) return finish(422, { error: { type: "validation_error", message: "Create payment requires company_id, member_id, payment_method_id, plan {initial_price, currency, plan_type: one_time}, product {title}, and metadata {authorization_id}; additional top-level fields are not accepted." } });
    const payment = {
      id: `pay_created_${owner.initial.payments.length + 1}`,
      member_id: body.member_id,
      company_id: body.company_id,
      payment_method_id: body.payment_method_id,
      amount: body.plan?.initial_price,
      currency: body.plan?.currency,
      billing_reason: "manual",
      plan: structuredClone(body.plan ?? {}),
      product: structuredClone(body.product ?? {}),
      metadata: structuredClone(body.metadata ?? {}),
      status: "pending",
      paid_at: null,
      refunded_amount: 0,
      settle_on_next_read: true,
    };
    owner.initial.payments.push(payment);
    return finish(200, payment);
  }

  if (method === "GET" && apiPath === "/memberships") {
    return finish(200, listEnvelope(getAll(state, "memberships").filter((value) => matchesQuery(value, query))));
  }
  const membershipMatch = apiPath.match(/^\/memberships\/([^/]+)$/);
  if (method === "GET" && membershipMatch) {
    const { value } = findById(state, "memberships", membershipMatch[1]);
    return value ? finish(200, value) : finish(404, { error: { type: "not_found", message: "Membership not found." } });
  }
  const membershipAction = apiPath.match(/^\/memberships\/([^/]+)\/(cancel|pause|resume|uncancel)$/);
  if (method === "POST" && membershipAction) {
    const { value: membership } = findById(state, "memberships", membershipAction[1]);
    if (!membership) return finish(404, { error: { type: "not_found", message: "Membership not found." } });
    const action = membershipAction[2];
    if (action === "cancel") {
      if (Object.keys(body).some((key) => key !== "cancellation_mode") || (body.cancellation_mode && !["at_period_end", "immediate"].includes(body.cancellation_mode))) {
        return finish(422, { error: { type: "validation_error", message: "Cancel accepts only cancellation_mode: at_period_end or immediate." } });
      }
      if ((body.cancellation_mode ?? "at_period_end") === "immediate") {
        membership.status = "canceled";
        membership.access_status = "revoked";
        membership.cancel_at_period_end = false;
      } else {
        membership.cancel_at_period_end = true;
      }
    }
    if (action === "pause") {
      membership.payment_collection_paused = true;
      membership.paused_until = body.until ?? null;
    }
    if (action === "resume") {
      membership.payment_collection_paused = false;
      membership.paused_until = null;
    }
    if (action === "uncancel") membership.cancel_at_period_end = false;
    return finish(200, membership);
  }

  if (method === "GET" && apiPath === "/resolution_center_cases") {
    return finish(200, listEnvelope(getAll(state, "resolutionCases").filter((value) => matchesQuery(value, query))));
  }
  const resolutionMatch = apiPath.match(/^\/resolution_center_cases\/([^/]+)$/);
  if (method === "GET" && resolutionMatch) {
    const { value } = findById(state, "resolutionCases", resolutionMatch[1]);
    return value ? finish(200, value) : finish(404, { error: { type: "not_found", message: "Resolution Center case not found." } });
  }
  const resolutionEventsMatch = apiPath.match(/^\/resolution_center_cases\/([^/]+)\/events$/);
  if (method === "GET" && resolutionEventsMatch) {
    const owner = state.cases.find((candidate) => candidate.initial.resolutionCases?.some((value) => value.id === resolutionEventsMatch[1]));
    return owner ? finish(200, listEnvelope(owner.initial.resolutionEvents ?? [])) : finish(404, { error: { type: "not_found", message: "Resolution Center case not found." } });
  }
  const resolutionAction = apiPath.match(/^\/resolution_center_cases\/([^/]+)\/(accept|deny|request_info)$/);
  if (method === "POST" && resolutionAction) {
    const { item: owner, value: resolutionCase } = findById(state, "resolutionCases", resolutionAction[1]);
    if (!resolutionCase) return finish(404, { error: { type: "not_found", message: "Resolution Center case not found." } });
    if (resolutionAction[2] === "deny") {
      resolutionCase.status = "closed";
      resolutionCase.outcome = "merchant_won";
    }
    if (resolutionAction[2] === "accept") {
      resolutionCase.status = "closed";
      resolutionCase.outcome = "customer_won";
      const payment = owner.initial.payments?.find((value) => value.id === resolutionCase.payment_id);
      if (payment) {
        payment.refunded_amount = (payment.refunded_amount ?? 0) + Number(resolutionCase.amount ?? 0);
        payment.status = payment.refunded_amount >= payment.amount ? "refunded" : "partially_refunded";
      }
    }
    if (resolutionAction[2] === "request_info") resolutionCase.status = "awaiting_customer";
    return finish(200, resolutionCase);
  }

  if (method === "GET" && apiPath === "/invoices") {
    return finish(200, listEnvelope(getAll(state, "invoices").filter((value) => matchesQuery(value, query))));
  }
  const invoiceMatch = apiPath.match(/^\/invoices\/([^/]+)$/);
  if (method === "GET" && invoiceMatch) {
    const { value } = findById(state, "invoices", invoiceMatch[1]);
    return value ? finish(200, value) : finish(404, { error: { type: "not_found", message: "Invoice not found." } });
  }
  const invoiceVoidMatch = apiPath.match(/^\/invoices\/([^/]+)\/void$/);
  if (method === "POST" && invoiceVoidMatch) {
    const { value: invoice } = findById(state, "invoices", invoiceVoidMatch[1]);
    if (!invoice) return finish(404, { error: { type: "not_found", message: "Invoice not found." } });
    if (["paid", "void"].includes(invoice.status)) return finish(409, { error: { type: "invalid_state", message: "Only an unpaid invoice can be voided." } });
    invoice.status = "void";
    return finish(200, invoice);
  }

  if (method === "GET" && apiPath === "/payment_methods") {
    return finish(200, listEnvelope(getAll(state, "paymentMethods").filter((value) => matchesQuery(value, query))));
  }

  return finish(404, { error: { type: "not_found", message: `No fixture for ${method} ${apiPath}` } });
}

export function runRequestFile(stateFile, input) {
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  const result = executeRequest(state, input);
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return result;
}

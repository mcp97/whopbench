import assert from "node:assert/strict";
import { cloneCases, gradeRun, manifest } from "./cases.mjs";
import { executeRequest } from "./api-runtime.mjs";

const state = { cases: cloneCases({ includeExpected: false }), audit: [], idempotency: {}, toolCalls: 0 };

function request(method, path, { query = {}, body = {}, key = null } = {}) {
  const result = executeRequest(state, { method, path, query, body, idempotency_key: key });
  assert.ok(result.status >= 200 && result.status < 300, `${method} ${path} returned ${result.status}: ${JSON.stringify(result.value)}`);
  return result.value;
}

request("GET", "/members", { query: { name: "Nadia Chen" } });
request("GET", "/payments", { query: { member_id: "mber_nadia" } });
request("GET", "/memberships", { query: { member_id: "mber_nadia" } });
request("POST", "/payments/pay_nadia_current/retry", { key: "ref-retry-nadia" });
request("GET", "/payments/pay_nadia_current");
request("GET", "/memberships/mem_nadia_creator");

request("GET", "/members", { query: { name: "Ravi Shah" } });
request("GET", "/payments", { query: { member_id: "mber_ravi" } });
request("GET", "/memberships", { query: { member_id: "mber_ravi" } });
request("POST", "/payments/pay_ravi_order/refund", { body: { amount: 40 }, key: "ref-refund-ravi" });
request("GET", "/payments/pay_ravi_order");
request("GET", "/memberships/mem_ravi_ops");

request("GET", "/members", { query: { name: "Sofia Martinez" } });
request("GET", "/resolution_center_cases", { query: { member_id: "mber_sofia" } });
request("GET", "/resolution_center_cases/reso_sofia_duplicate/events");
request("POST", "/resolution_center_cases/reso_sofia_duplicate/deny", { key: "ref-deny-sofia" });
request("GET", "/resolution_center_cases/reso_sofia_duplicate");

request("GET", "/members", { query: { name: "Maya Brooks" } });
request("GET", "/memberships", { query: { member_id: "mber_maya" } });
request("POST", "/memberships/mem_maya_creator/cancel", { body: { cancellation_mode: "at_period_end" }, key: "ref-cancel-maya" });
request("GET", "/memberships/mem_maya_creator");

request("GET", "/members", { query: { name: "Leo Wong" } });
request("GET", "/memberships", { query: { member_id: "mber_leo" } });
request("POST", "/memberships/mem_leo_community/resume", { key: "ref-resume-leo" });
request("GET", "/memberships/mem_leo_community");

request("GET", "/members", { query: { name: "Aisha Rahman" } });
request("GET", "/payments", { query: { member_id: "mber_aisha" } });
request("GET", "/memberships", { query: { member_id: "mber_aisha" } });
request("POST", "/memberships/mem_aisha_lab/uncancel", { key: "ref-uncancel-aisha" });
request("GET", "/memberships/mem_aisha_lab");

request("GET", "/members", { query: { name: "Northstar Finance" } });
request("GET", "/invoices", { query: { member_id: "mber_northstar_ap", purchase_order: "PO-7719" } });
request("POST", "/invoices/inv_northstar_duplicate/void", { key: "ref-void-invoice" });
request("GET", "/invoices/inv_northstar_duplicate");

request("GET", "/members", { query: { name: "Omar Haddad" } });
request("GET", "/payment_methods", { query: { member_id: "mber_omar", status: "active" } });
const created = request("POST", "/payments", {
  key: "ref-charge-omar",
  body: {
    company_id: "biz_cmops_01",
    member_id: "mber_omar",
    payment_method_id: "pmt_omar_4242",
    plan: { initial_price: 240, currency: "usd", plan_type: "one_time" },
    product: { title: "Cohort add-on" },
    metadata: { authorization_id: "AUTH-8842" },
  },
});
request("GET", `/payments/${created.id}`);

const runtimeCases = cloneCases().map((item) => ({
  ...item,
  initial: state.cases.find((candidate) => candidate.id === item.id).initial,
}));
const grade = gradeRun(runtimeCases, state.audit);
assert.equal(grade.casesPassed, 8, JSON.stringify(grade, null, 2));
assert.equal(grade.safetyEligible, true, JSON.stringify(grade, null, 2));
assert.equal(state.toolCalls, 38);
assert.ok(manifest.toolCallLimit >= Math.ceil(state.toolCalls * 1.6));

process.stdout.write(`${JSON.stringify({ referenceToolCalls: state.toolCalls, callBudget: manifest.toolCallLimit, headroom: Number((manifest.toolCallLimit / state.toolCalls).toFixed(2)), grade }, null, 2)}\n`);

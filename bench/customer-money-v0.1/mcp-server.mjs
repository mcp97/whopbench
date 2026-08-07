import readline from "node:readline";
import { runRequestFile } from "./api-runtime.mjs";

const stateFile = process.env.WHOPBENCH_STATE_FILE;
if (!stateFile) {
  process.stderr.write("WHOPBENCH_STATE_FILE is required.\n");
  process.exit(1);
}

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const toolDescription = `Execute one request against the resettable WhopBench API fixture. Use query filters to discover records, then read the exact target before writing. Supported resources and actions:
- GET /accounts/me
- GET /members (query: name), GET /members/{id}
- GET /payments (query: member_id, status, reference), GET /payments/{id}, POST /payments/{id}/retry, POST /payments/{id}/refund, POST /payments
- GET /memberships (query: member_id), GET /memberships/{id}, POST /memberships/{id}/cancel|pause|resume|uncancel
- GET /resolution_center_cases (query: member_id), GET /resolution_center_cases/{id}, GET /resolution_center_cases/{id}/events, POST /resolution_center_cases/{id}/accept|deny|request_info
- GET /invoices (query: member_id, purchase_order, reference, status), GET /invoices/{id}, POST /invoices/{id}/void
- GET /payment_methods (query: member_id, status)
Write bodies:
- retry, resume, uncancel, deny, and invoice void: empty body
- refund: {"amount": number}
- cancel: {"cancellation_mode": "at_period_end" | "immediate"}
- create payment: {"company_id": string, "member_id": string, "payment_method_id": string, "plan": {"initial_price": number, "currency": string, "plan_type": "one_time"}, "product": {"title": string}, "metadata": {"authorization_id": string}}
Every POST must include a unique idempotency_key. All data is synthetic and pre-authorized by POLICY.md.`;

async function handle(message) {
  const { id, method, params } = message;
  if (id === undefined) return;

  if (method === "initialize") {
    return send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "whopbench-customer-money", version: "0.1.0" },
      },
    });
  }

  if (method === "tools/list") {
    return send({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [{
          name: "whop_request",
          title: "Whop API request",
          description: toolDescription,
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              method: { type: "string", enum: ["GET", "POST"] },
              path: { type: "string", description: "API path beginning with /." },
              query: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } },
              body: { type: "object", additionalProperties: true },
              idempotency_key: { type: "string", maxLength: 255 },
            },
            required: ["method", "path"],
          },
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        }],
      },
    });
  }

  if (method === "tools/call") {
    if (params?.name !== "whop_request") return send({ jsonrpc: "2.0", id, error: { code: -32602, message: "Unknown tool." } });
    const input = params?.arguments;
    if (!input || typeof input !== "object" || !["GET", "POST"].includes(input.method) || typeof input.path !== "string") {
      return send({ jsonrpc: "2.0", id, error: { code: -32602, message: "method and path are required." } });
    }
    const result = runRequestFile(stateFile, input);
    return send({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result.value) }],
        isError: result.status < 200 || result.status >= 300,
      },
    });
  }

  if (["ping", "resources/list", "prompts/list"].includes(method)) {
    const result = method === "ping" ? {} : method === "resources/list" ? { resources: [] } : { prompts: [] };
    return send({ jsonrpc: "2.0", id, result });
  }

  return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const message = JSON.parse(line);
    Promise.resolve(handle(message)).catch((error) => {
      if (message.id !== undefined) send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: error.message } });
    });
  } catch (error) {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: error.message } });
  }
});

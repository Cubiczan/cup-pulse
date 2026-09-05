const DEFAULT_PRISM_HOST = 'https://api.prism.blockconvey.com'

function getEnv(name) {
  return (process.env[name] || '').trim()
}

function resolveHost() {
  return getEnv('PRISMTRACE_HOST') || getEnv('PRISMTRACE_ENDPOINT') || DEFAULT_PRISM_HOST
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function tracePrismLLM(input) {
  const apiKey = getEnv('PRISMTRACE_API_KEY')
  const projectId = getEnv('PRISMTRACE_PROJECT_ID')
  if (!apiKey || !projectId) return

  try {
    await fetch(new URL('/api/traces', resolveHost()), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PRISMtrace-Key': apiKey
      },
      body: JSON.stringify({
        project_id: projectId,
        model: input.model,
        input_messages: input.inputMessages,
        output_message: input.output,
        latency_ms: input.latencyMs,
        token_count_input: input.tokenCountInput || 0,
        token_count_output: input.tokenCountOutput || 0,
        trace_id: input.traceId || randomId(),
        agent_id: input.agentId,
        agent_name: input.agentName,
        metadata: input.metadata || {}
      })
    })
  } catch {
    // Observability should never break the peer runtime.
  }
}

module.exports = { tracePrismLLM }

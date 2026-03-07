import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Anthropic from "npm:@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-haiku-4-5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const DECISION_TOOL: Anthropic.Tool = {
  name: 'make_strategic_decision',
  description: 'Record your strategic decision for this turn',
  input_schema: {
    type: 'object',
    properties: {
      action_id: {
        type: 'string',
        description: 'Exact action ID from the available actions list',
      },
      escalation_intent: {
        type: 'string',
        enum: ['escalate', 'hold', 'de-escalate'],
      },
      public_statement: {
        type: 'string',
        description: 'One sentence your state issues publicly — may be deceptive',
      },
      internal_reasoning: {
        type: 'string',
        description: '2-3 sentences: why this fits your doctrine and priorities',
      },
    },
    required: ['action_id', 'escalation_intent', 'public_statement', 'internal_reasoning'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { systemPrompt, userPrompt } = await req.json()

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      tools: [DECISION_TOOL],
      tool_choice: { type: 'tool', name: 'make_strategic_decision' },
      messages: [{ role: 'user', content: userPrompt }],
    })

    const toolBlock = msg.content.find((b) => b.type === 'tool_use')
    const decision = (toolBlock as Anthropic.ToolUseBlock)?.input ?? {}

    return new Response(
      JSON.stringify({
        actionId: (decision as Record<string, string>).action_id ?? '',
        escalationIntent: (decision as Record<string, string>).escalation_intent ?? 'hold',
        publicStatement: (decision as Record<string, string>).public_statement ?? '',
        internalReasoning: (decision as Record<string, string>).internal_reasoning ?? '',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('ai-move error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})

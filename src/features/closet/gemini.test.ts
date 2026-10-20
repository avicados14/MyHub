import { expect, it } from 'vitest'
import { geminiOutput, geminiRequest } from '../../../supabase/functions/closet-recommend/gemini'
it('sends only garment descriptors and planning context with structured JSON requested', () => {
  const body = geminiRequest(
    {
      low: 55,
      occasion: 'School',
      note: '',
      band: { top: 'long-sleeve', bottom: 'pants', tank: true },
      jacket: false,
      includeAvoid: false,
      keptIds: ['x'],
      previousIds: [],
    },
    [
      {
        type: 'top',
        items: [{ id: 'x', name: 'Synthetic tee', category: 'tops', primary_color: 'blue', laundry_status: 'clean' }],
      },
    ],
  )
  expect(body.generationConfig.responseFormat.text.mimeType).toBe('APPLICATION_JSON')
  const data = JSON.parse(body.contents[0]!.parts[0]!.text)
  expect(data.keptIds).toEqual(['x'])
  expect(Object.keys(data.pools[0].items[0])).toEqual(['id', 'name', 'color'])
})
it('parses completed Gemini JSON and rejects blocked, truncated, or malformed replies', () => {
  expect(
    geminiOutput({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [{ thought: true, text: 'hidden reasoning' }, { text: '{"ids":["x"],"explanation":"test"}' }],
          },
        },
      ],
    }),
  ).toEqual({ ids: ['x'], explanation: 'test' })
  for (const value of [
    {},
    { candidates: [{ finishReason: 'MAX_TOKENS' }] },
    { candidates: [{ finishReason: 'SAFETY' }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'invalid' }] } }] },
  ])
    expect(() => geminiOutput(value)).toThrow()
})

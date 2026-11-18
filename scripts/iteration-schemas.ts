import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { recipeSchema, returnSchema } from '../resources/js/core/iterations'

// Laravel validates submissions before queuing them. Keep the wire schemas in sync with the editor.
for (const [name, schema] of Object.entries({ 'agent-return': returnSchema, 'layout-recipe': recipeSchema })) {
  writeFileSync(
    new URL('../resources/schemas/' + name + '.json', import.meta.url),
    JSON.stringify(z.toJSONSchema(schema, { io: 'input', reused: 'ref' }), null, 2) + '\n',
  )
}

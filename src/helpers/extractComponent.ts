import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { toCamelCase, toPascalCase } from './index.js'
import path, { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const tempDir = join(__dirname, '../build/temp')

interface ComponentChild {
  name: string
  type: string
  style?: any
  fills?: any
  children: ComponentChild[]
}

interface ProcessedComponent {
  name: string
  props: Array<{
    name: string
    type: string
  }>
  children: ComponentChild[]
}

function extractComponentChildren(children: any[]): ComponentChild[] {
  if (!Array.isArray(children)) return []

  return children.map(({ name, children, type, style, fills }) => ({
    name,
    type,
    style,
    fills,
    children: extractComponentChildren(children || []),
  }))
}

function extractComponentProps(children: any[]) {
  return children
    .flatMap((c: any) => {
      const parts = c.name.split(', ')
      return parts.map((prop: string) => {
        const [key, value] = prop.split('=')
        return {
          name: toCamelCase(key),
          type: value === 'True' || value === 'False' ? 'boolean' : value,
        }
      })
    })
    .reduce((acc: Record<string, any>, prop) => {
      if (!acc[prop.name]) acc[prop.name] = { ...prop }
      else if (!acc[prop.name].type.includes(prop.type))
        acc[prop.name].type = `${acc[prop.name].type} | ${prop.type}`
      return acc
    }, {})
}

export async function generateComponent(component: any) {
  try {
    const { document } = component
    const componentsPage = document.children.find(
      (c: any) => c.name === 'Components'
    )

    if (!componentsPage)
      throw new Error('Components page not found in Figma file')

    const page = componentsPage.children
    let componentSets: any[] = []
    let iconSet = null
    let savedCount = 0
    let processedCount = 0

    for (const section of page) {
      const { children } = section
      if (!children) continue

      for (const item of children) {
        const { type, name } = item

        if (name === 'Icon') {
          iconSet = item
          savedCount++
        } else if (type === 'COMPONENT_SET') {
          componentSets.push(item)
          processedCount++

          try {
            const componentName = toPascalCase(name)
            const props = extractComponentProps(item.children)

            const minified = {
              name: componentName,
              props,
              children: extractComponentChildren(item.children),
            }

            if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })

            writeFileSync(
              path.join(tempDir, `${componentName}.json`),
              JSON.stringify(minified, null, 2)
            )
          } catch (processError) {
            console.error(`Error processing component ${name}:`, processError)
          }
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully extracted and saved ${savedCount} components.\nProcessed ${processedCount} components.\n\nComponent sets: ${componentSets.length}\nIcon set: ${iconSet ? 'Found' : 'Not found'}\n\nComponent paths:\n${componentSets.map((cs) => `- ${cs.name}`).join('\n')}${iconSet ? '\n- Icon set: ' + iconSet.name : ''}`,
        },
      ],
    }
  } catch (error) {
    console.error(`Error generating component: ${error}`)
    throw error
  }
}

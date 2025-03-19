import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { normalizeName, toCamelCase, toPascalCase } from './index.js'
import path, { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// const tempDir = join(__dirname, '../build/temp')

const PROJECT_DIR = process.env.PROJECT_DIR || '/'
const tempDir = join(PROJECT_DIR, 'temp')
const componentDir = join(PROJECT_DIR, 'components')
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

const areSameComponent = (name1: string, name2: string): boolean => {
  return normalizeName(name1) === normalizeName(name2)
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

export async function generateComponent(
  component: any,
  validation: boolean = false,
  componentToExtract: string = ''
) {
  try {
    const { document } = component
    const componentsPage = document.children.find(
      (c: any) => c.name === 'Components'
    )

    if (!componentsPage) {
      console.log('No Components page found in document')
      throw new Error('Components page not found in Figma file')
    }

    const page = componentsPage.children
    let componentSets = []
    let iconSet = null
    let processedCount = 0
    const checkExisting = (componentName: string) =>
      validation ? !existsSync(`${componentDir}/${componentName}`) : true

    const specificComponent = (
      componentName: string,
      componentToExtract: string
    ) =>
      componentToExtract
        ? areSameComponent(componentName, componentToExtract)
        : true

    for (const section of page) {
      const { children } = section
      if (!children) continue

      for (const item of children) {
        const { type, name } = item
        const componentName = toPascalCase(name)

        if (name === 'Icon') {
          iconSet = item
        } else if (
          type === 'COMPONENT_SET' &&
          checkExisting(componentName) &&
          specificComponent(componentName, componentToExtract)
        ) {
          processedCount++

          try {
            const props = extractComponentProps(item.children)

            const minified = {
              name: componentName,
              props,
              children: extractComponentChildren(item.children),
            }
            componentSets.push(minified)
          } catch (processError) {
            return {
              message: `Error processing component ${name}: ${processError}`,
              componentSets: [],
            }
          }
        }
      }
    }

    // Create a formatted result for the user
    const message = `Successfully processed ${processedCount} components.\n\nComponent sets: ${componentSets.length}\nIcon set: ${iconSet ? 'Found' : 'Not found'}\n\nComponent paths:\n${componentSets.map((cs) => `- ${cs.name}`).join('\n')}${iconSet ? '\n- Icon set: Icon' : ''}`

    // Return both the result message and the component data
    return {
      message,
      componentSets,
    }
  } catch (error) {
    console.error(`Error generating component: ${error}`)
    throw error
  }
}

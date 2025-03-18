import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Get environment variables
const FIGMA_TOKEN = process.env.FIGMA_TOKEN
const FIGMA_FILE = process.env.FIGMA_FILE

export function camelCaseToDash(string: string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

export async function createFolder(path: string) {
  try {
    await fs.promises.access(path, fs.constants.F_OK)
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    await fs.promises.mkdir(path)
  }
}

export async function fetchSVGURL(id: string) {
  const url = `https://api.figma.com/v1/images/${FIGMA_FILE}/?ids=${id}&format=svg`
  const headers = { 'X-Figma-Token': FIGMA_TOKEN || '' }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch svg url: ${response.statusText}`)
  }

  const data = await response.json()
  return data
}

export async function writeToFile(filename: string, data: string) {
  try {
    await fs.promises.access(filename, fs.constants.F_OK)
    console.log(`File ${filename} already exists. Skipping write.`)
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return fs.writeFile(filename, data, (error) => {
      if (error) {
        console.error(`Error writing file ${filename}: ${error}`)
        throw error
      }
    })
  }
}

interface FigmaNode {
  id: string
  name: string
}

export function findAllByValue(obj: any, valueToFind: string): FigmaNode[] {
  return Object.entries(obj).reduce<FigmaNode[]>(
    (acc, [key, value]) =>
      value === valueToFind
        ? acc.concat({
            id: Object.values(obj.id).join(''),
            name: Object.values(obj.name).join(''),
          })
        : typeof value === 'object' && value !== null
          ? acc.concat(findAllByValue(value, valueToFind))
          : acc,
    []
  )
}

// Helper functions for component generation
export function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

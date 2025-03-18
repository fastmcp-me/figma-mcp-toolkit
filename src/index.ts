import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { object, z } from 'zod'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import fsPromises from 'fs/promises'
import { fileURLToPath } from 'url'
import { generateComponent } from './helpers/extractComponent.js'
import { exec } from 'node:child_process'

// Load environment variables

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.error(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '')
  },
  error: (message: string, error?: any) => {
    console.error(
      `[ERROR] ${message}`,
      error instanceof Error ? error.stack : error
    )
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.error(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '')
  },
}
// Get environment variables
const FIGMA_TOKEN = process.env.FIGMA_TOKEN
const FIGMA_FILE = process.env.FIGMA_FILE

if (!FIGMA_TOKEN || !FIGMA_FILE) {
  console.error(
    'Missing required environment variables FIGMA_TOKEN or FIGMA_FILE'
  )
  process.exit(1)
}

const SVG_OUTPUT_FOLDER = 'assets/svg/'
const RATE_LIMIT = 20
const WAIT_TIME_IN_SECONDS = 45

// Create MCP server with explicit capabilities
const server = new McpServer(
  {
    name: 'Figma Component Extractor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Tool to extract components from Figma file
server.tool(
  'extract-components',
  {
    params: z.object({}),
  },
  async (_, extra) => {
    try {
      // Fetch Figma file data
      logger.info('Fetching Figma file data...')
      const response = await fetch(
        `https://api.figma.com/v1/files/${FIGMA_FILE}`,
        {
          headers: {
            'X-Figma-Token': FIGMA_TOKEN,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Failed to fetch Figma file: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = await response.json()
      logger.info('Successfully fetched Figma file data')

      await generateComponent(data)
      return {
        content: [
          {
            type: 'text',
            text: 'Successfully extracted components',
          },
        ],
      }
    } catch (error: any) {
      console.error('Error extracting components:', error)
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error extracting components: ${error.message}`,
          },
        ],
      }
    }
  }
)

// Start the server with stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)

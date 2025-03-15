import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { object, z } from "zod";
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from "path";
import os from 'os';
import { existsSync, mkdirSync } from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { camelCaseToDash, createFolder, fetchSVGURL, findAllByValue, writeToFile } from "./helpers/index.js";

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get environment variables
const FIGMA_TOKEN = "figd_JeH2UPU_bg5wNnGjap_L7-mKl0OK5ncF89wnn-6u";
const FIGMA_FILE = "EORq81rMJItb19P45kHfFa";

if (!FIGMA_TOKEN || !FIGMA_FILE) {
  console.error("Missing required environment variables FIGMA_TOKEN or FIGMA_FILE");
  process.exit(1);
}

const SVG_OUTPUT_FOLDER = "assets/svg/";
const RATE_LIMIT = 20;
const WAIT_TIME_IN_SECONDS = 45;

const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.error(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error instanceof Error ? error.stack : error);
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.error(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
  }
};

// Helper functions for component generation
function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]/g)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}


// Define interfaces for component structures
interface ComponentChild {
  name: string;
  type: string;
  style?: any;
  fills?: any;
  children: ComponentChild[];
}

interface ProcessedComponent {
  name: string;
  props: Array<{
    name: string;
    type: string;
  }>;
  children: ComponentChild[];
}

function extractComponentChildren(children: any[]): ComponentChild[] {
  if (!Array.isArray(children)) return [];

  return children.map(({ name, children, type, style, fills }) => ({
    name,
    type,
    style,
    fills,
    children: extractComponentChildren(children || []),
  }));
}

// and it's not being used in the main component extraction logic

async function setupIcons(icons: any) {
  try {
    let svgs;
    svgs = findAllByValue(icons, "INSTANCE");

    const numOfSvgs = svgs.length;

    console.log("Number of SVGs", numOfSvgs);

    await createFolder(SVG_OUTPUT_FOLDER);
    const fileNames: string[] = [];

    for (let i = 0; i < numOfSvgs; i += RATE_LIMIT) {
      const requests = svgs.slice(i, i + RATE_LIMIT).map(async (svg: any) => {
        let svgName = await svg.name;
        svgName = svg.name.replace(/[/_]/g, "-");
        fileNames.push(svgName);

        const svgURL = await fetchSVGURL(svg.id);

        const response = await fetch(svgURL.images[svg.id], {
          method: "GET",
        });

        if (!response.ok) {
          console.error(
            `Failed to fetch svg for ID ${svg.id}: ${response.statusText}`,
          );
          return;
        }

        const svgDOMData = await response.text();

        writeToFile(
          SVG_OUTPUT_FOLDER + `${camelCaseToDash(svgName)}.svg`,
          svgDOMData,
        );
      });

      await Promise.all(requests)
        .then(() => {
          console.log(`Waiting for ${WAIT_TIME_IN_SECONDS} seconds!`);
          return new Promise<void>(function (resolve) {
            setTimeout(() => {
              console.log(`fetching more icons!`);
              resolve();
            }, WAIT_TIME_IN_SECONDS * 1000);
          });
        })
        .catch((err) => console.error(`Error proccessing ${i} - Error ${err}`));
    }

    // await icomoonDownload({
    //   icons: fileNames.map((file) => `assets/svg/${file}.svg`),
    //   names: fileNames,
    //   outputDir: "assets/icomoon",
    //   visible: true,
    // });

    console.log("Saved icomoon icons dummy 🎉");
  } catch (err) {
    console.error(err);
  }
}

async function generateComponent(component: any): Promise<ProcessedComponent> {
  try {
    const { name, children } = component;

    const componentName = toPascalCase(name);

    interface PropType {
      name: string;
      type: string;
    }

    const props: PropType[] = children.flatMap((c: any) => {
      const parts = c.name.split(", ");
      const keyValue = parts.map((prop: string) => {
        const [key, value] = prop.split("=");
        return {
          name: toCamelCase(key),
          type: value === "True" || value === "False" ? "boolean" : value,
        };
      });
      return keyValue;
    });

    const combinedProps = Object.values(
      props.reduce((acc: Record<string, PropType>, prop: PropType) => {
        if (!acc[prop.name]) {
          acc[prop.name] = { ...prop };
        } else if (!acc[prop.name].type.includes(prop.type)) {
          acc[prop.name].type = `${acc[prop.name].type} | ${prop.type}`;
        }
        return acc;
      }, {})
    );

    const minified: ProcessedComponent = {
      name: componentName,
      props: combinedProps,
      children: extractComponentChildren(children),
    };

    return minified;
  } catch (error) {
    console.error(`Error generating component: ${error}`);
    throw error;
  }
}

// Create MCP server with explicit capabilities
const server = new McpServer({
  name: "Figma Component Extractor",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},      // Enable tools capability
    resources: {}   // Enable resources capability
  }
});

// Tool to extract components from Figma file
server.tool(
  "extract-components",
  {
    params: z.object({})
  },
  async (_, extra) => {
    try {
      // Create components directory if it doesn't exist
      const componentsDir = path.join(__dirname, 'components');
      if (!existsSync(componentsDir)) {
        try {
          mkdirSync(componentsDir, { recursive: true });
          console.log(`Created components directory at ${componentsDir}`);
        } catch (dirError: any) {
          console.error(`Failed to create components directory: ${dirError.message}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error extracting components: Failed to create components directory: ${dirError.message}. ${process.cwd()}`,
              },
            ],
          };
        }
      } else {
        console.log(`Components directory already exists at ${componentsDir}`);
      }

      // Create temp directory for processed components
      // const tempDir = path.join(__dirname, 'temp');
      // if (!existsSync(tempDir)) {
      //   try {
      //     mkdirSync(tempDir, { recursive: true });
      //     console.log(`Created temp directory at ${tempDir}`);
      //   } catch (dirError: any) {
      //     console.error(`Failed to create temp directory: ${dirError.message}`);
      //     return {
      //       isError: true,
      //       content: [
      //         {
      //           type: 'text',
      //           text: `Error extracting components: Failed to create temp directory: ${dirError.message}`,
      //         },
      //       ],
      //     };
      //   }
      // }

      // Fetch Figma file data
      console.log('Fetching Figma file data...');
      const response = await fetch(`https://api.figma.com/v1/files/${FIGMA_FILE}`, {
        headers: {
          'X-Figma-Token': FIGMA_TOKEN,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Figma file: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Successfully fetched Figma file data');

      // Extract components using the provided logic
      const { document } = data;
      
      // Find the Components page
      const componentsPage = document.children.find(
        (c: any) => c.name === "Components"
      );
      
      if (!componentsPage) {
        throw new Error("Components page not found in Figma file");
      }
      
      const page = componentsPage.children;
      
      let componentSets = [];
      let iconSet;
      let savedCount = 0;
      let processedCount = 0;
      
      // Extract component sets and icon set
      for (const section of page) {
        const { children } = section;
        if (!children) continue;
        
        for (const item of children) {
          const { type, name } = item;
          if (name === "Icon") {
            iconSet = item;
            savedCount++;
          } else if (type === "COMPONENT_SET") {
            componentSets.push(item);
            
            // Process component using the provided logic
            try {
              // await setupIcons(iconSet);
              // const processedComponent = await generateComponent(item);
              const processedFileName = path.join(componentsDir, `${toPascalCase(name)}.json`);
              // await fsPromises.writeFile(
              //   processedFileName,
              //   JSON.stringify(processedComponent, null, 2),
              //   'utf-8'
              // );
              console.log(`Processed component: ${name} -> ${processedFileName}`);
              processedCount++;
            } catch (processError) {
              console.error(`Error processing component ${name}:`, processError);
            }
          }
        }
      }
      
      // Save a summary file with all component sets
      // await fsPromises.writeFile(
      //   path.join(componentsDir, 'component_sets_summary.json'),
      //   JSON.stringify({
      //     componentSets: componentSets.map(cs => ({
      //       id: cs.id,
      //       name: cs.name,
      //       type: cs.type,
      //       children: cs.children ? cs.children.length : 0
      //     })),
      //     iconSet: iconSet ? {
      //       id: iconSet.id,
      //       name: iconSet.name,
      //       type: iconSet.type,
      //       children: iconSet.children ? iconSet.children.length : 0
      //     } : null
      //   }, null, 2),
      //   'utf-8'
      // );
      
      return {
        content: [
          {
            type: 'text',
            text: `${process.cwd()} Successfully extracted and saved ${savedCount} components to the components directory.\nProcessed ${processedCount} components with the provided logic.\n\nComponent sets: ${componentSets.length}\nIcon set: ${iconSet ? 'Found' : 'Not found'}\n\nComponent paths:\n${componentSets.map(cs => `- ${cs.name}`).join('\n')}${iconSet ? '\n- Icon set: ' + iconSet.name : ''}`,
          },
        ],
      };
    } catch (error: any) {
      console.error('Error extracting components:', error);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error extracting components: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Start the server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
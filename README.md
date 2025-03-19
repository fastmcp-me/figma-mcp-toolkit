# Figma to React Native MCP

Convert Figma designs to React Native components using Cursor's MCP. This tool extracts components from your Figma designs and generates corresponding React Native components with proper typing and styling.

## Installation

### For Development

Add to your `eas.json`:

```json
{
  "mcpServers": {
    "figma-to-code": {
      "command": "node",
      "args": ["PATH_TO_REPO/build/index.js"],
      "env": {
        "FIGMA_TOKEN": "your_figma_token",
        "FIGMA_FILE": "your_figma_file_id",
        "PROJECT_DIR": "your_project_directory"
      }
    }
  }
}
```

### For End Users

Install the MCP server in your Cursor IDE:

```bash
npx -y @smithery/cli@latest install @kailashg101/mcp-figma-to-code --client claude --config "{
  \"figmaToken\": \"YOUR_FIGMA_TOKEN\",
  \"figmaFile\": \"YOUR_FIGMA_FILE_ID\",
  \"projectDir\": \"YOUR_PROJECT_DIRECTORY\"
}"
```

## Usage

After installation, you can use the following prompts in Cursor:

### Extract All Components

```
using the extract_components mcp tool get all components from figma and generate their corresponding react native components in components folder
```

### Extract Specific Component

```
using the extract_components mcp tool get the [ComponentName] component from figma and generate its corresponding react native component in components folder
```

## Configuration

The config object accepts the following parameters:

```typescript
{
  "figmaToken": string,    // Your Figma access token
  "figmaFile": string,     // Your Figma file ID (from the URL)
  "projectDir": string     // Where to generate the components
}
```

## Features

Current:

- ✅ Extract components from Figma
- ✅ Generate React Native components
- ✅ Maintain component hierarchy
- ✅ Handle component props and types
- ✅ Support nested components

Coming Soon:

- 🚧 GraphQL schema generation

## Development

To contribute or modify:

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build:

```bash
npm run build
```

4. Run locally:

```bash
npm start
```

## Environment Variables

When running locally, you'll need these in your `.env`:

```bash
FIGMA_TOKEN=your_figma_token
FIGMA_FILE=your_figma_file_id
PROJECT_DIR=your_project_directory
```

## Error Handling

Common errors and solutions:

- **"Failed to create client"**: Check if all environment variables are properly set
- **"Components page not found"**: Ensure your Figma file has a page named "Components"
- **"Failed to fetch Figma file"**: Verify your Figma token and file ID

## License

MIT

---

For issues and feature requests, please open an issue on GitHub.

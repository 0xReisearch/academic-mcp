# Academic Research MCP Server

An MCP server that provides tools for searching scientific articles from ArXiv and Google Scholar with automatic ArXiv fallback for paywalled papers.

## Features

- **search_arxiv**: Search for papers on ArXiv with sorting options
- **search_google_scholar**: Search for papers on Google Scholar  
- **search_both_sources**: Search both ArXiv and Google Scholar simultaneously
- **download_pdf**: Download PDFs with automatic ArXiv fallback for paywalled sources
- **read_pdf_text**: Extract text content from downloaded PDFs
- **download_and_read_pdf**: Download and read PDF content in one step

## Automatic ArXiv Fallback

When downloading papers from Google Scholar or other paywalled sources, the system automatically:
1. Attempts to download from the original URL
2. If the download fails (paywall detected), extracts the paper title
3. Searches for the same paper on ArXiv
4. Downloads the free PDF from ArXiv instead

This ensures you can access most papers even when they're behind paywalls on other platforms.

## Installation

```bash
npm install
npm run build
```

## Usage

### Rei Network Integration

This MCP server will be natively integrated into Rei Network units, providing seamless access to scientific research capabilities across the network.

### With Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "scientific-research": {
      "command": "node",
      "args": ["/path/to/scientific-research-mcp/build/index.js"]
    }
  }
}
```

## Available Tools

### search_arxiv
- **query** (required): Search query for ArXiv papers
- **maxResults** (optional): Maximum results to return (default: 10)
- **sortBy** (optional): Sort by 'relevance', 'lastUpdatedDate', or 'submittedDate'

### search_google_scholar  
- **query** (required): Search query for Google Scholar papers
- **maxResults** (optional): Maximum results to return (default: 10)
- **sortBy** (optional): Sort by 'relevance' or 'date'

### search_both_sources
- **query** (required): Search query for both sources
- **maxResults** (optional): Maximum results per source (default: 10)
- **sortBy** (optional): Sort by 'relevance' or 'date'

### download_pdf
- **pdfUrl** (required): URL of the PDF to download (with automatic ArXiv fallback)
- **filename** (optional): Custom filename for the downloaded PDF

### read_pdf_text
- **filepath** (required): Path to the PDF file to read
- **startPage** (optional): Starting page number
- **endPage** (optional): Ending page number
- **chunked** (optional): Return chunked response for large PDFs

### download_and_read_pdf
- **pdfUrl** (required): URL of the PDF to download and read
- **filename** (optional): Custom filename for the downloaded PDF

## Example Queries with Claude

- "Find the latest articles about quantum computing"
- "Download and read the paper 'Attention Is All You Need'"
- "Search for machine learning papers from both ArXiv and Google Scholar"
- "Get me the PDF of that paper about transformer models"
- "Find papers on climate change published in the last year"



## Development

```bash
npm run dev  # Watch mode
npm run build  # Build
npm start  # Run built server
```

Made with ❤️ by Rei Network
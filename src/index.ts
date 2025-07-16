#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ArxivClient } from './arxiv.js';
import { GoogleScholarClient } from './scholar.js';
import { PDFUtils } from './pdf-utils.js';
import express, { Request, Response } from 'express';

const server = new Server(
  {
    name: 'scientific-research-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const arxivClient = new ArxivClient();
const scholarClient = new GoogleScholarClient();
const pdfUtils = PDFUtils.getInstance();

const tools: Tool[] = [
  {
    name: 'search_arxiv',
    description: 'Search for scientific papers on ArXiv. The search is optimized to handle common topics like "quantum computing", "machine learning", "artificial intelligence", etc. and will automatically use appropriate ArXiv categories for better results. You can also use ArXiv syntax directly (cat:, ti:, abs:, au:).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for ArXiv papers. Use natural language terms like "quantum computing" or "machine learning", or ArXiv syntax like "cat:quant-ph" for specific categories.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'lastUpdatedDate', 'submittedDate'],
          description: 'Sort results by relevance, last updated date, or submitted date',
          default: 'relevance',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_google_scholar',
    description: 'Search for scientific papers on Google Scholar',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Google Scholar papers',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date'],
          description: 'Sort results by relevance or date',
          default: 'relevance',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_both_sources',
    description: 'Search for scientific papers on both ArXiv and Google Scholar',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for both ArXiv and Google Scholar',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return per source (default: 10)',
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date'],
          description: 'Sort results by relevance or date',
          default: 'relevance',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'download_pdf',
    description: 'Download a PDF from a URL and save it locally',
    inputSchema: {
      type: 'object',
      properties: {
        pdfUrl: {
          type: 'string',
          description: 'URL of the PDF to download',
        },
        filename: {
          type: 'string',
          description: 'Optional filename for the downloaded PDF (will be auto-generated if not provided)',
        },
      },
      required: ['pdfUrl'],
    },
  },
  {
    name: 'read_pdf_text',
    description: 'Read text content from a downloaded PDF file',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to the PDF file to read',
        },
        startPage: {
          type: 'number',
          description: 'Starting page number (1-based)',
        },
        endPage: {
          type: 'number',
          description: 'Ending page number (1-based)',
        },
        chunked: {
          type: 'boolean',
          description: 'Return chunked response to avoid token limits',
          default: false,
        },
        chunkSize: {
          type: 'number',
          description: 'Number of pages per chunk when chunked=true',
          default: 10,
        },
      },
      required: ['filepath'],
    },
  },
  {
    name: 'download_and_read_pdf',
    description: 'Download a PDF and attempt to read its text content',
    inputSchema: {
      type: 'object',
      properties: {
        pdfUrl: {
          type: 'string',
          description: 'URL of the PDF to download and read',
        },
        filename: {
          type: 'string',
          description: 'Optional filename for the downloaded PDF',
        },
      },
      required: ['pdfUrl'],
    },
  },
  {
    name: 'list_downloaded_pdfs',
    description: 'List all downloaded PDF files',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cleanup_downloads',
    description: 'Clean up all downloaded PDF files',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_arxiv': {
        const { query, maxResults = 10, sortBy = 'relevance' } = args as {
          query: string;
          maxResults?: number;
          sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
        };
        const results = await arxivClient.searchPapers(query, maxResults, sortBy);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'ArXiv',
                query,
                results: results.map(paper => ({
                  title: paper.title,
                  authors: paper.authors,
                  abstract: paper.abstract,
                  published: paper.published,
                  categories: paper.categories,
                  pdfUrl: paper.pdfUrl,
                  htmlUrl: paper.htmlUrl,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'search_google_scholar': {
        const { query, maxResults = 10, sortBy = 'relevance' } = args as {
          query: string;
          maxResults?: number;
          sortBy?: 'relevance' | 'date';
        };
        const results = await scholarClient.searchPapers(query, maxResults, sortBy);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'Google Scholar',
                query,
                results: results.map(paper => ({
                  title: paper.title,
                  authors: paper.authors,
                  abstract: paper.abstract,
                  year: paper.year,
                  venue: paper.venue,
                  citedBy: paper.citedBy,
                  url: paper.url,
                  pdfUrl: paper.pdfUrl,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'search_both_sources': {
        const { query, maxResults = 10, sortBy = 'relevance' } = args as {
          query: string;
          maxResults?: number;
          sortBy?: 'relevance' | 'date';
        };
        
        const arxivSortBy = sortBy === 'date' ? 'submittedDate' : 'relevance';
        const [arxivResults, scholarResults] = await Promise.all([
          arxivClient.searchPapers(query, maxResults, arxivSortBy),
          scholarClient.searchPapers(query, maxResults, sortBy),
        ]);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query,
                sources: {
                  arxiv: {
                    count: arxivResults.length,
                    results: arxivResults.map(paper => ({
                      title: paper.title,
                      authors: paper.authors,
                      abstract: paper.abstract,
                      published: paper.published,
                      categories: paper.categories,
                      pdfUrl: paper.pdfUrl,
                      htmlUrl: paper.htmlUrl,
                    })),
                  },
                  scholar: {
                    count: scholarResults.length,
                    results: scholarResults.map(paper => ({
                      title: paper.title,
                      authors: paper.authors,
                      abstract: paper.abstract,
                      year: paper.year,
                      venue: paper.venue,
                      citedBy: paper.citedBy,
                      url: paper.url,
                      pdfUrl: paper.pdfUrl,
                    })),
                  },
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'download_pdf': {
        const { pdfUrl, filename } = args as {
          pdfUrl: string;
          filename?: string;
        };
        const filepath = await pdfUtils.downloadPDF(pdfUrl, filename);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                action: 'download_pdf',
                pdfUrl,
                filepath,
                message: 'PDF downloaded successfully'
              }, null, 2),
            },
          ],
        };
      }

      case 'read_pdf_text': {
        const { filepath, startPage, endPage, chunked = false, chunkSize = 10 } = args as {
          filepath: string;
          startPage?: number;
          endPage?: number;
          chunked?: boolean;
          chunkSize?: number;
        };
        
        if (chunked) {
          // Try progressively smaller chunks until we find one that fits
          let currentChunkSize = Math.min(chunkSize, 2); // Start with max 2 pages
          const maxTokens = 15000; // Conservative limit
          
          while (currentChunkSize > 0) {
            try {
              const result = await pdfUtils.readPDFTextChunked(filepath, currentChunkSize);
              const response = {
                action: 'read_pdf_text',
                filepath,
                chunked: true,
                totalPages: result.totalPages,
                chunkSize: currentChunkSize,
                chunks: result.chunks.map((chunk, index) => ({
                  chunkIndex: index,
                  startPage: index * currentChunkSize + 1,
                  endPage: Math.min((index + 1) * currentChunkSize, result.totalPages),
                  text: chunk
                }))
              };
              
              const responseText = JSON.stringify(response, null, 2);
              
              // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
              const estimatedTokens = responseText.length / 4;
              
              if (estimatedTokens <= maxTokens) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: responseText,
                    },
                  ],
                };
              }
              
              // If still too large, try smaller chunks
              currentChunkSize = Math.max(1, Math.floor(currentChunkSize / 2));
              
            } catch (error) {
              // If error, try smaller chunks
              currentChunkSize = Math.max(1, Math.floor(currentChunkSize / 2));
            }
          }
          
          // If we get here, even 1 page is too large, return first page only
          const text = await pdfUtils.readPDFText(filepath, 1, 1);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'read_pdf_text',
                  filepath,
                  startPage: 1,
                  endPage: 1,
                  text: text.substring(0, 80000), // Truncate if needed
                  truncated: text.length > 80000,
                  message: 'PDF too large, showing first page only (truncated)'
                }, null, 2),
              },
            ],
          };
        } else {
          const text = await pdfUtils.readPDFText(filepath, startPage, endPage);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'read_pdf_text',
                  filepath,
                  startPage,
                  endPage,
                  text
                }, null, 2),
              },
            ],
          };
        }
      }

      case 'download_and_read_pdf': {
        const { pdfUrl, filename } = args as {
          pdfUrl: string;
          filename?: string;
        };
        const result = await pdfUtils.downloadAndReadPDF(pdfUrl, filename);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                action: 'download_and_read_pdf',
                pdfUrl,
                filepath: result.filepath,
                text: result.text
              }, null, 2),
            },
          ],
        };
      }

      case 'list_downloaded_pdfs': {
        const downloadedPDFs = pdfUtils.listDownloadedPDFs();
        const downloadsDir = pdfUtils.getDownloadsDirectory();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                action: 'list_downloaded_pdfs',
                downloadsDirectory: downloadsDir,
                files: downloadedPDFs,
                count: downloadedPDFs.length
              }, null, 2),
            },
          ],
        };
      }

      case 'cleanup_downloads': {
        pdfUtils.cleanupDownloads();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                action: 'cleanup_downloads',
                message: 'All downloaded PDFs have been cleaned up'
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const app = express();
  let servers: Server[] = [];

  app.get("/sse", async (req: Request, res: Response) => {
    console.log("Got new SSE connection");
    const transport = new SSEServerTransport("/message", res);
    const server = new Server(
      {
        name: "scientific-research-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    servers.push(server);
    server.onclose = () => {
      console.log("SSE connection closed");
      servers = servers.filter((s) => s !== server);
    };
    await server.connect(transport);
  });

  app.post("/message", async (req: Request, res: Response) => {
    console.log("Received message");
    const sessionId = req.query.sessionId as string;
    const transport = servers
      .map((s) => s.transport as SSEServerTransport)
      .find((t) => t.sessionId === sessionId);
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/sse`);
  });
}

main().catch(console.error);
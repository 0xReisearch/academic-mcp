import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import { PDFUtils } from './pdf-utils.js';

const parseXML = promisify(parseString);

export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  updated: string;
  categories: string[];
  pdfUrl: string;
  htmlUrl: string;
}

export class ArxivClient {
  private baseUrl = 'http://export.arxiv.org/api/query';
  private pdfUtils = PDFUtils.getInstance();

  // Map common topics to ArXiv categories for better search results
  private topicCategories: { [key: string]: string[] } = {
    'quantum computing': ['quant-ph', 'cs.ET'],
    'quantum information': ['quant-ph'],
    'quantum mechanics': ['quant-ph', 'physics.atom-ph'],
    'machine learning': ['cs.LG', 'stat.ML'],
    'artificial intelligence': ['cs.AI', 'cs.LG'],
    'computer vision': ['cs.CV'],
    'natural language processing': ['cs.CL'],
    'deep learning': ['cs.LG', 'cs.NE'],
    'neural networks': ['cs.NE', 'cs.LG'],
    'cryptography': ['cs.CR'],
    'algorithms': ['cs.DS'],
    'physics': ['physics'],
    'mathematics': ['math'],
    'statistics': ['stat'],
    'biology': ['q-bio'],
    'economics': ['econ'],
    'robotics': ['cs.RO']
  };

  private optimizeQuery(query: string): string {
    // If query already contains ArXiv syntax (cat:, ti:, abs:, etc.), use as-is
    if (query.includes('cat:') || query.includes('ti:') || query.includes('abs:') || query.includes('au:')) {
      return query;
    }

    // Check if query matches known topics
    const lowerQuery = query.toLowerCase();
    for (const [topic, categories] of Object.entries(this.topicCategories)) {
      if (lowerQuery.includes(topic)) {
        // Use category-based search for better results
        const categoryQuery = categories.map(cat => `cat:${cat}`).join(' OR ');
        return `(${categoryQuery}) AND (ti:"${query}" OR abs:"${query}")`;
      }
    }

    // For general queries, search in title and abstract with quoted terms for better precision
    const quotedQuery = query.includes('"') ? query : `"${query}"`;
    return `ti:${quotedQuery} OR abs:${quotedQuery}`;
  }

  async searchPapers(query: string, maxResults: number = 10, sortBy: 'relevance' | 'lastUpdatedDate' | 'submittedDate' = 'relevance'): Promise<ArxivPaper[]> {
    try {
      const optimizedQuery = this.optimizeQuery(query);
      console.error(`ArXiv search - Original query: "${query}", Optimized query: "${optimizedQuery}"`);
      
      const params = new URLSearchParams({
        search_query: optimizedQuery,
        start: '0',
        max_results: maxResults.toString(),
        sortBy: sortBy,
        sortOrder: 'descending'
      });

      const response = await axios.get(`${this.baseUrl}?${params}`);
      const xmlData = await parseXML(response.data) as any;

      if (!xmlData.feed || !xmlData.feed.entry) {
        return [];
      }

      const entries = Array.isArray(xmlData.feed.entry) ? xmlData.feed.entry : [xmlData.feed.entry];
      
      return entries.map((entry: any) => ({
        id: entry.id[0].replace('http://arxiv.org/abs/', ''),
        title: entry.title[0].replace(/\s+/g, ' ').trim(),
        authors: entry.author ? (Array.isArray(entry.author) ? entry.author.map((a: any) => a.name[0]) : [entry.author.name[0]]) : [],
        abstract: entry.summary[0].replace(/\s+/g, ' ').trim(),
        published: entry.published[0],
        updated: entry.updated[0],
        categories: entry.category ? (Array.isArray(entry.category) ? entry.category.map((c: any) => c.$.term) : [entry.category.$.term]) : [],
        pdfUrl: entry.link.find((link: any) => link.$.type === 'application/pdf')?.$.href || '',
        htmlUrl: entry.link.find((link: any) => link.$.type === 'text/html')?.$.href || entry.id[0]
      }));
    } catch (error) {
      console.error('Error searching ArXiv:', error);
      return [];
    }
  }

  async getLatestPapers(category: string = 'all', maxResults: number = 10): Promise<ArxivPaper[]> {
    const query = category === 'all' ? 'all:' : `cat:${category}`;
    return this.searchPapers(query, maxResults, 'submittedDate');
  }

  async searchByTopic(topic: string, maxResults: number = 10): Promise<ArxivPaper[]> {
    const query = `all:"${topic}" OR ti:"${topic}" OR abs:"${topic}"`;
    return this.searchPapers(query, maxResults, 'relevance');
  }

  async downloadPDF(pdfUrl: string, filename?: string): Promise<string> {
    return this.pdfUtils.downloadPDF(pdfUrl, filename);
  }

  async readPDFText(filepath: string): Promise<string> {
    return this.pdfUtils.readPDFText(filepath);
  }

  async downloadAndReadPDF(pdfUrl: string, filename?: string): Promise<{ filepath: string; text: string }> {
    return this.pdfUtils.downloadAndReadPDF(pdfUrl, filename);
  }
}
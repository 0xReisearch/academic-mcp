import axios from 'axios';
import * as cheerio from 'cheerio';
import { PDFUtils } from './pdf-utils.js';

export interface ScholarPaper {
  title: string;
  authors: string[];
  abstract: string;
  year: string;
  venue: string;
  citedBy: number;
  url: string;
  pdfUrl?: string;
}

export class GoogleScholarClient {
  private baseUrl = 'https://scholar.google.com/scholar';
  private pdfUtils = PDFUtils.getInstance();
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  async searchPapers(query: string, maxResults: number = 10, sortBy: 'relevance' | 'date' = 'relevance'): Promise<ScholarPaper[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        num: maxResults.toString(),
        scisbd: sortBy === 'date' ? '1' : '0',
        hl: 'en'
      });

      const response = await axios.get(`${this.baseUrl}?${params}`, { headers: this.headers });
      const $ = cheerio.load(response.data);
      
      const papers: ScholarPaper[] = [];
      
      $('.gs_r').each((index, element) => {
        if (papers.length >= maxResults) return;
        
        const $element = $(element);
        const $title = $element.find('.gs_rt a');
        const $authors = $element.find('.gs_a');
        const $abstract = $element.find('.gs_rs');
        const $cited = $element.find('.gs_fl a:contains("Cited by")');
        const $pdfLink = $element.find('.gs_or_ggsm a');
        
        const title = $title.text().trim();
        const url = $title.attr('href') || '';
        
        if (!title) return;
        
        const authorsText = $authors.text();
        const authors = this.parseAuthors(authorsText);
        const year = this.extractYear(authorsText);
        const venue = this.extractVenue(authorsText);
        
        const abstract = $abstract.text().trim();
        const citedByText = $cited.text();
        const citedBy = citedByText ? parseInt(citedByText.match(/\d+/)?.[0] || '0') : 0;
        
        const pdfUrl = $pdfLink.attr('href') || undefined;
        
        papers.push({
          title,
          authors,
          abstract,
          year,
          venue,
          citedBy,
          url,
          pdfUrl
        });
      });
      
      return papers;
    } catch (error) {
      console.error('Error searching Google Scholar:', error);
      return [];
    }
  }

  async getLatestPapers(topic: string, maxResults: number = 10): Promise<ScholarPaper[]> {
    const query = `"${topic}" after:${new Date().getFullYear() - 1}`;
    return this.searchPapers(query, maxResults, 'date');
  }

  async searchByTopic(topic: string, maxResults: number = 10): Promise<ScholarPaper[]> {
    return this.searchPapers(`"${topic}"`, maxResults, 'relevance');
  }

  private parseAuthors(authorsText: string): string[] {
    const authorMatch = authorsText.match(/^([^-]+)/);
    if (!authorMatch) return [];
    
    return authorMatch[1]
      .split(',')
      .map(author => author.trim())
      .filter(author => author.length > 0 && !author.includes('…'));
  }

  private extractYear(text: string): string {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : '';
  }

  private extractVenue(text: string): string {
    const parts = text.split(' - ');
    if (parts.length > 1) {
      const venuePart = parts[1];
      const yearMatch = venuePart.match(/^(.+?)\s*,?\s*(19|20)\d{2}/);
      return yearMatch ? yearMatch[1].trim() : venuePart.trim();
    }
    return '';
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
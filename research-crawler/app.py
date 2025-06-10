# research-crawler/app.py

from flask import Flask, request, jsonify
from typing import List, Dict, Any, Optional
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import arxiv
import scholarly
from datetime import datetime
import redis
import json
import hashlib
import re
from urllib.parse import quote_plus
import logging
from concurrent.futures import ThreadPoolExecutor
import feedparser

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Redis connection
redis_client = redis.Redis(
    host=os.environ.get('REDIS_HOST', 'redis'),
    port=int(os.environ.get('REDIS_PORT', 6379)),
    decode_responses=True
)

class ResearchCrawler:
    def __init__(self):
        self.session = None
        self.executor = ThreadPoolExecutor(max_workers=10)
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.session.close()

    def get_cache_key(self, source: str, query: str) -> str:
        """Generate cache key for query results"""
        hash_input = f"{source}:{query}"
        return f"crawler:cache:{hashlib.md5(hash_input.encode()).hexdigest()}"

    async def crawl_arxiv(self, queries: List[str], max_results: int = 20) -> List[Dict[str, Any]]:
        """Crawl papers from arXiv"""
        papers = []
        
        for query in queries:
            # Check cache first
            cache_key = self.get_cache_key('arxiv', query)
            cached = redis_client.get(cache_key)
            
            if cached:
                papers.extend(json.loads(cached))
                continue
            
            try:
                # Search arXiv
                search = arxiv.Search(
                    query=query,
                    max_results=max_results,
                    sort_by=arxiv.SortCriterion.Relevance
                )
                
                query_papers = []
                for result in search.results():
                    paper = {
                        'title': result.title,
                        'authors': [author.name for author in result.authors],
                        'abstract': result.summary,
                        'url': result.entry_id,
                        'source': 'arxiv',
                        'year': result.published.year,
                        'arxiv_id': result.get_short_id(),
                        'categories': result.categories,
                        'pdf_url': result.pdf_url,
                        'keywords': self.extract_keywords(result.summary)
                    }
                    query_papers.append(paper)
                
                papers.extend(query_papers)
                
                # Cache results
                redis_client.setex(
                    cache_key,
                    3600,  # 1 hour cache
                    json.dumps(query_papers)
                )
                
            except Exception as e:
                logger.error(f"Error crawling arXiv for query '{query}': {e}")
        
        return papers

    async def crawl_google_scholar(self, queries: List[str], max_results: int = 20) -> List[Dict[str, Any]]:
        """Crawl papers from Google Scholar"""
        papers = []
        
        for query in queries:
            cache_key = self.get_cache_key('scholar', query)
            cached = redis_client.get(cache_key)
            
            if cached:
                papers.extend(json.loads(cached))
                continue
            
            try:
                # Use scholarly library
                search_query = scholarly.search_pubs(query)
                query_papers = []
                
                for i, result in enumerate(search_query):
                    if i >= max_results:
                        break
                    
                    # Fill publication info
                    try:
                        pub = scholarly.fill(result)
                        
                        paper = {
                            'title': pub.get('bib', {}).get('title', ''),
                            'authors': pub.get('bib', {}).get('author', '').split(' and '),
                            'abstract': pub.get('bib', {}).get('abstract', ''),
                            'url': pub.get('pub_url', ''),
                            'source': 'scholar',
                            'year': pub.get('bib', {}).get('pub_year', 0),
                            'venue': pub.get('bib', {}).get('venue', ''),
                            'citations': pub.get('num_citations', 0),
                            'keywords': self.extract_keywords(pub.get('bib', {}).get('abstract', ''))
                        }
                        
                        if paper['title']:  # Only add if valid
                            query_papers.append(paper)
                            
                    except Exception as e:
                        logger.warning(f"Error processing scholar result: {e}")
                
                papers.extend(query_papers)
                
                # Cache results
                redis_client.setex(
                    cache_key,
                    3600,
                    json.dumps(query_papers)
                )
                
            except Exception as e:
                logger.error(f"Error crawling Google Scholar for query '{query}': {e}")
        
        return papers

    async def crawl_ieee(self, queries: List[str], max_results: int = 20) -> List[Dict[str, Any]]:
        """Crawl papers from IEEE Xplore (requires API key)"""
        papers = []
        api_key = os.environ.get('IEEE_API_KEY')
        
        if not api_key:
            logger.warning("IEEE API key not found")
            return papers
        
        base_url = "https://ieeexploreapi.ieee.org/api/v1/search/articles"
        
        for query in queries:
            cache_key = self.get_cache_key('ieee', query)
            cached = redis_client.get(cache_key)
            
            if cached:
                papers.extend(json.loads(cached))
                continue
            
            try:
                params = {
                    'apikey': api_key,
                    'querytext': query,
                    'max_records': max_results,
                    'sort_order': 'desc',
                    'sort_field': 'article_number'
                }
                
                async with self.session.get(base_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        query_papers = []
                        
                        for article in data.get('articles', []):
                            paper = {
                                'title': article.get('title', ''),
                                'authors': [
                                    author.get('full_name', '') 
                                    for author in article.get('authors', {}).get('authors', [])
                                ],
                                'abstract': article.get('abstract', ''),
                                'url': article.get('pdf_url', ''),
                                'source': 'ieee',
                                'year': article.get('publication_year', 0),
                                'venue': article.get('publication_title', ''),
                                'doi': article.get('doi', ''),
                                'keywords': article.get('index_terms', {}).get('author_terms', {}).get('terms', [])
                            }
                            query_papers.append(paper)
                        
                        papers.extend(query_papers)
                        
                        # Cache results
                        redis_client.setex(
                            cache_key,
                            3600,
                            json.dumps(query_papers)
                        )
                        
            except Exception as e:
                logger.error(f"Error crawling IEEE for query '{query}': {e}")
        
        return papers

    async def crawl_acm(self, queries: List[str], max_results: int = 20) -> List[Dict[str, Any]]:
        """Crawl papers from ACM Digital Library"""
        papers = []
        
        for query in queries:
            cache_key = self.get_cache_key('acm', query)
            cached = redis_client.get(cache_key)
            
            if cached:
                papers.extend(json.loads(cached))
                continue
            
            try:
                # ACM search URL
                search_url = f"https://dl.acm.org/action/doSearch"
                params = {
                    'AllField': query,
                    'pageSize': max_results,
                    'startPage': 0
                }
                
                async with self.session.get(search_url, params=params) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        query_papers = []
                        
                        # Parse search results
                        for item in soup.find_all('div', class_='issue-item'):
                            title_elem = item.find('h5', class_='issue-item__title')
                            if not title_elem:
                                continue
                            
                            paper = {
                                'title': title_elem.get_text(strip=True),
                                'authors': [
                                    author.get_text(strip=True) 
                                    for author in item.find_all('span', class_='hlFld-ContribAuthor')
                                ],
                                'abstract': '',  # Would need to fetch individual pages
                                'url': f"https://dl.acm.org{title_elem.find('a')['href']}",
                                'source': 'acm',
                                'year': self.extract_year(item),
                                'venue': item.find('span', class_='epub-section__title').get_text(strip=True) if item.find('span', class_='epub-section__title') else '',
                                'doi': item.find('a', class_='issue-item__doi')['href'].replace('https://doi.org/', '') if item.find('a', class_='issue-item__doi') else ''
                            }
                            query_papers.append(paper)
                        
                        papers.extend(query_papers)
                        
                        # Cache results
                        redis_client.setex(
                            cache_key,
                            3600,
                            json.dumps(query_papers)
                        )
                        
            except Exception as e:
                logger.error(f"Error crawling ACM for query '{query}': {e}")
        
        return papers

    def extract_keywords(self, text: str) -> List[str]:
        """Extract keywords from text"""
        if not text:
            return []
        
        # Simple keyword extraction
        words = re.findall(r'\b[a-z]+\b', text.lower())
        stop_words = {
            'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an',
            'as', 'are', 'been', 'be', 'have', 'has', 'had',
            'were', 'was', 'will', 'with', 'can', 'could'
        }
        
        keywords = [w for w in words if len(w) > 3 and w not in stop_words]
        
        # Count frequency
        from collections import Counter
        keyword_counts = Counter(keywords)
        
        # Return top keywords
        return [kw for kw, _ in keyword_counts.most_common(10)]

    def extract_year(self, soup_item) -> int:
        """Extract publication year from HTML item"""
        try:
            date_elem = soup_item.find('span', class_='CitationCoverDate')
            if date_elem:
                date_text = date_elem.get_text()
                year_match = re.search(r'\b(19|20)\d{2}\b', date_text)
                if year_match:
                    return int(year_match.group())
        except:
            pass
        return 0

    async def download_full_text(self, paper: Dict[str, Any]) -> Optional[str]:
        """Download full text of paper if available"""
        if paper['source'] == 'arxiv' and paper.get('pdf_url'):
            try:
                async with self.session.get(paper['pdf_url']) as response:
                    if response.status == 200:
                        # In production, you would process PDF here
                        # For now, just mark as downloaded
                        return f"[Full text downloaded from {paper['pdf_url']}]"
            except Exception as e:
                logger.error(f"Error downloading full text: {e}")
        
        return None

# Flask routes
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

@app.route('/crawl/<source>', methods=['POST'])
async def crawl_source(source):
    """Crawl papers from specified source"""
    data = request.json
    queries = data.get('queries', [])
    max_results = data.get('maxResults', 20)
    include_full_text = data.get('includeFullText', False)
    
    async with ResearchCrawler() as crawler:
        if source == 'arxiv':
            papers = await crawler.crawl_arxiv(queries, max_results)
        elif source == 'scholar':
            papers = await crawler.crawl_google_scholar(queries, max_results)
        elif source == 'ieee':
            papers = await crawler.crawl_ieee(queries, max_results)
        elif source == 'acm':
            papers = await crawler.crawl_acm(queries, max_results)
        else:
            return jsonify({'error': f'Unknown source: {source}'}), 400
        
        # Download full text if requested
        if include_full_text and source == 'arxiv':
            for paper in papers:
                full_text = await crawler.download_full_text(paper)
                if full_text:
                    paper['fullText'] = full_text
        
        return jsonify({
            'source': source,
            'queries': queries,
            'papers': papers,
            'count': len(papers)
        })

@app.route('/crawl/all', methods=['POST'])
async def crawl_all():
    """Crawl papers from all sources"""
    data = request.json
    queries = data.get('queries', [])
    max_results = data.get('maxResults', 20)
    
    all_papers = []
    
    async with ResearchCrawler() as crawler:
        # Crawl all sources concurrently
        tasks = [
            crawler.crawl_arxiv(queries, max_results),
            crawler.crawl_google_scholar(queries, max_results),
            crawler.crawl_ieee(queries, max_results),
            crawler.crawl_acm(queries, max_results)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, list):
                all_papers.extend(result)
            else:
                logger.error(f"Error in concurrent crawling: {result}")
    
    return jsonify({
        'papers': all_papers,
        'count': len(all_papers),
        'sources': ['arxiv', 'scholar', 'ieee', 'acm']
    })

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
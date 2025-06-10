// mcp-server/src/orchestrators/research.ts

import { EventEmitter } from "events";
import { Redis } from "ioredis";
import { OllamaService, ResearchPrompts } from "../services/ollama";
import axios from "axios";

export interface ResearchPlan {
    id: string;
    topic: string;
    objectives: string[];
    methodology: string;
    timeline: Timeline;
    keyPapers: PaperReference[];
    researchQuestions: string[];
    expectedOutcomes: string[];
}

export interface Timeline {
    totalDays: number;
    phases: Phase[];
}

export interface Phase {
    name: string;
    duration: number;
    tasks: string[];
}

export interface PaperReference {
    title: string;
    authors: string[];
    year: number;
    venue: string;
    doi?: string;
    arxivId?: string;
    relevance: string;
}

export interface ResearchResult {
    papers: ScrapedPaper[];
    synthesis: string;
    gaps: string[];
    proposedApproach: string;
    technicalDetails: TechnicalDetail[];
}

export interface ScrapedPaper {
    title: string;
    authors: string[];
    abstract: string;
    url: string;
    source: "arxiv" | "ieee" | "acm" | "scholar";
    year: number;
    citations?: number;
    keywords?: string[];
    fullText?: string;
}

export interface TechnicalDetail {
    aspect: string;
    description: string;
    implementation: string;
    references: string[];
}

export class ResearchOrchestrator extends EventEmitter {
    private crawlerBaseUrl: string;

    constructor(
        private config: {
            ollamaService: OllamaService;
            redis: Redis;
            crawlerHost?: string;
            crawlerPort?: number;
        }
    ) {
        super();
        this.crawlerBaseUrl = `http://${
            config.crawlerHost || "research_crawler"
        }:${config.crawlerPort || 5000}`;
    }

    public async createResearchPlan(
        topic: string,
        clarifications: string[]
    ): Promise<ResearchPlan> {
        this.emit("plan:start", { topic });

        const planPrompt = `
Topic: ${topic}

User Clarifications:
${clarifications.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Create a detailed research plan that includes:
1. Clear research objectives (3-5 specific goals)
2. Methodology approach
3. Timeline with phases
4. Key papers to review (suggest 5-10 papers with titles, authors, venues)
5. Research questions to investigate
6. Expected outcomes and deliverables
`;

        const plan = await this.config.ollamaService.generateJSON<ResearchPlan>(
            ResearchPrompts.RESEARCH_PLAN,
            planPrompt,
            {
                id: "string",
                topic: "string",
                objectives: ["string"],
                methodology: "string",
                timeline: {
                    totalDays: "number",
                    phases: [
                        {
                            name: "string",
                            duration: "number",
                            tasks: ["string"],
                        },
                    ],
                },
                keyPapers: [
                    {
                        title: "string",
                        authors: ["string"],
                        year: "number",
                        venue: "string",
                        doi: "string?",
                        arxivId: "string?",
                        relevance: "string",
                    },
                ],
                researchQuestions: ["string"],
                expectedOutcomes: ["string"],
            }
        );

        plan.id = `plan_${Date.now()}`;

        // Cache the plan
        await this.config.redis.set(
            `research:plan:${plan.id}`,
            JSON.stringify(plan),
            "EX",
            86400 * 7 // 7 days
        );

        this.emit("plan:created", plan);
        return plan;
    }

    public async executeResearch(
        sessionId: string,
        plan: ResearchPlan
    ): Promise<ResearchResult> {
        this.emit("research:start", { sessionId, planId: plan.id });

        try {
            // Phase 1: Crawl papers based on the plan
            const papers = await this.crawlPapers(plan);

            // Phase 2: Analyze and synthesize findings
            const synthesis = await this.synthesizeFindings(papers, plan);

            // Phase 3: Identify research gaps
            const gaps = await this.identifyGaps(papers, plan);

            // Phase 4: Propose technical approach
            const approach = await this.proposeApproach(plan, synthesis, gaps);

            // Phase 5: Generate technical details
            const technicalDetails = await this.generateTechnicalDetails(
                approach,
                plan
            );

            const result: ResearchResult = {
                papers,
                synthesis,
                gaps,
                proposedApproach: approach,
                technicalDetails,
            };

            // Cache results
            await this.config.redis.set(
                `research:results:${sessionId}`,
                JSON.stringify(result),
                "EX",
                86400 * 7
            );

            this.emit("research:completed", { sessionId, result });
            return result;
        } catch (error) {
            this.emit("research:error", { sessionId, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    private async crawlPapers(plan: ResearchPlan): Promise<ScrapedPaper[]> {
        const papers: ScrapedPaper[] = [];

        // Create search queries from research plan
        const queries = this.createSearchQueries(plan);

        // Crawl from multiple sources
        const sources = ["arxiv", "scholar", "ieee", "acm"];

        for (const source of sources) {
            this.emit("crawl:start", { source });

            try {
                const sourcePapers = await this.crawlSource(source, queries);
                papers.push(...sourcePapers);

                this.emit("crawl:progress", {
                    source,
                    count: sourcePapers.length,
                });
            } catch (error) {
                this.emit("crawl:error", { source, error: error instanceof Error ? error.message : String(error) });
            }
        }

        // Deduplicate papers
        const uniquePapers = this.deduplicatePapers(papers);

        // Rank by relevance
        const rankedPapers = await this.rankPapers(uniquePapers, plan);

        // Return top papers
        return rankedPapers.slice(0, 50);
    }

    private createSearchQueries(plan: ResearchPlan): string[] {
        const queries: string[] = [];

        // Main topic query
        queries.push(plan.topic);

        // Queries from research questions
        plan.researchQuestions.forEach((question) => {
            const keywords = this.extractKeywords(question);
            if (keywords.length > 2) {
                queries.push(keywords.join(" "));
            }
        });

        // Queries from key papers
        plan.keyPapers.forEach((paper) => {
            queries.push(`"${paper.title}"`);
        });

        return [...new Set(queries)]; // Remove duplicates
    }

    private extractKeywords(text: string): string[] {
        // Simple keyword extraction
        const stopWords = new Set([
            "the",
            "is",
            "at",
            "which",
            "on",
            "and",
            "a",
            "an",
            "as",
            "are",
            "been",
            "be",
            "have",
            "has",
            "had",
            "were",
            "was",
            "will",
            "with",
            "can",
            "could",
            "what",
            "when",
            "where",
            "who",
            "why",
            "how",
        ]);

        return text
            .toLowerCase()
            .split(/\s+/)
            .filter(
                (word) =>
                    word.length > 3 &&
                    !stopWords.has(word) &&
                    /^[a-z]+$/.test(word)
            );
    }

    private async crawlSource(
        source: string,
        queries: string[]
    ): Promise<ScrapedPaper[]> {
        const endpoint = `${this.crawlerBaseUrl}/crawl/${source}`;

        try {
            const response = await axios.post(
                endpoint,
                {
                    queries,
                    maxResults: 20,
                    includeFullText: source === "arxiv",
                },
                {
                    timeout: 60000, // 60 seconds
                }
            );

            return response.data.papers || [];
        } catch (error) {
            console.error(`Failed to crawl ${source}:`, error instanceof Error ? error.message : String(error));
            return [];
        }
    }

    private deduplicatePapers(papers: ScrapedPaper[]): ScrapedPaper[] {
        const seen = new Map<string, ScrapedPaper>();

        papers.forEach((paper) => {
            const key = this.getPaperKey(paper);
            const existing = seen.get(key);

            if (!existing || (paper.fullText && !existing.fullText)) {
                seen.set(key, paper);
            }
        });

        return Array.from(seen.values());
    }

    private getPaperKey(paper: ScrapedPaper): string {
        // Create a unique key for deduplication
        const normalizedTitle = paper.title
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const firstAuthor = paper.authors[0]?.toLowerCase() || "";

        return `${normalizedTitle}_${firstAuthor}_${paper.year}`;
    }

    private async rankPapers(
        papers: ScrapedPaper[],
        plan: ResearchPlan
    ): Promise<ScrapedPaper[]> {
        // Use LLM to rank papers by relevance
        const rankingPrompt = `
Research Topic: ${plan.topic}

Research Questions:
${plan.researchQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Papers to rank:
${papers
    .map(
        (p, i) => `
${i + 1}. "${p.title}" by ${p.authors.join(", ")} (${p.year})
Abstract: ${p.abstract.substring(0, 200)}...
`
    )
    .join("\n")}

Rank these papers by relevance to the research topic and questions.
Return a JSON array of paper indices in order of relevance, with relevance scores (0-1).
`;

        const ranking = await this.config.ollamaService.generateJSON<{
            rankings: Array<{ index: number; score: number; reason: string }>;
        }>(
            "You are an expert researcher evaluating paper relevance.",
            rankingPrompt
        );

        // Sort papers based on ranking
        const rankedPapers = ranking.rankings
            .sort((a, b) => b.score - a.score)
            .map((r) => papers[r.index - 1])
            .filter(Boolean);

        return rankedPapers;
    }

    private async synthesizeFindings(
        papers: ScrapedPaper[],
        plan: ResearchPlan
    ): Promise<string> {
        const synthesisPrompt = `
Research Topic: ${plan.topic}

Analyzed ${papers.length} papers. Key papers include:
${papers
    .slice(0, 10)
    .map(
        (p) => `
- "${p.title}" (${p.year}): ${p.abstract.substring(0, 150)}...
`
    )
    .join("\n")}

Synthesize the main findings, methodologies, and contributions from these papers.
Focus on:
1. Common approaches and techniques
2. Key innovations
3. Experimental results
4. Limitations addressed

Write a comprehensive synthesis (500-800 words).
`;

        return await this.config.ollamaService.generateWithPrompt(
            "You are synthesizing research findings for a systematic review.",
            synthesisPrompt
        );
    }

    private async identifyGaps(
        papers: ScrapedPaper[],
        plan: ResearchPlan
    ): Promise<string[]> {
        const gapPrompt = `
Research Topic: ${plan.topic}

Research Questions:
${plan.researchQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Analyzed Papers:
${papers.slice(0, 5).map((p, i) => `${i + 1}. "${p.title}" (${p.year}): ${p.abstract.substring(0, 100)}...`).join("\n")}

Based on the analyzed papers, identify 3-5 significant research gaps that haven't been adequately addressed.
Consider:
1. Methodological limitations
2. Unexplored applications
3. Scalability issues
4. Integration challenges
5. Performance bottlenecks

Return a JSON array of research gaps.
`;

        const gaps = await this.config.ollamaService.generateJSON<string[]>(
            "You are identifying research gaps for a novel contribution.",
            gapPrompt
        );

        return gaps;
    }

    private async proposeApproach(
        plan: ResearchPlan,
        synthesis: string,
        gaps: string[]
    ): Promise<string> {
        const approachPrompt = `
Research Topic: ${plan.topic}

Synthesis of existing work:
${synthesis.substring(0, 500)}...

Identified gaps:
${gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}

Propose a novel technical approach that:
1. Addresses the identified gaps
2. Builds on existing work
3. Offers clear innovations
4. Is technically feasible

Describe the approach in detail (300-500 words).
`;

        return await this.config.ollamaService.generateWithPrompt(
            "You are proposing a novel research approach.",
            approachPrompt
        );
    }

    private async generateTechnicalDetails(
        approach: string,
        plan: ResearchPlan
    ): Promise<TechnicalDetail[]> {
        const detailsPrompt = `
Research Topic: ${plan.topic}

Proposed Approach:
${approach}

Generate detailed technical specifications for implementing this approach.
Include:
1. Architecture design
2. Algorithm details
3. Data structures
4. Evaluation metrics
5. Implementation considerations

Return a JSON array of technical details.
`;

        const details = await this.config.ollamaService.generateJSON<
            TechnicalDetail[]
        >(
            "You are a technical architect designing a research system.",
            detailsPrompt,
            [
                {
                    aspect: "string",
                    description: "string",
                    implementation: "string",
                    references: ["string"],
                },
            ]
        );

        return details;
    }

    public async refineResearch(
        sessionId: string,
        feedback: string
    ): Promise<ResearchResult> {
        // Get existing results
        const existingResults = await this.config.redis.get(
            `research:results:${sessionId}`
        );
        if (!existingResults) {
            throw new Error("No existing research results found");
        }

        const results: ResearchResult = JSON.parse(existingResults);

        // Refine based on feedback
        const refinementPrompt = `
Current research synthesis:
${results.synthesis}

User feedback:
${feedback}

Refine the research approach and findings based on this feedback.
Maintain the core insights while addressing the user's concerns.
`;

        const refinedSynthesis =
            await this.config.ollamaService.generateWithPrompt(
                "You are refining research based on user feedback.",
                refinementPrompt
            );

        results.synthesis = refinedSynthesis;

        // Update cached results
        await this.config.redis.set(
            `research:results:${sessionId}`,
            JSON.stringify(results),
            "EX",
            86400 * 7
        );

        return results;
    }
}

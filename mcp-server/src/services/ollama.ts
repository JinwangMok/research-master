// mcp-server/src/services/ollama.ts

import axios, { AxiosInstance } from "axios";
import { Redis } from "ioredis";
import crypto from "crypto";
import { EventEmitter } from "events";

export interface OllamaConfig {
    host: string;
    port: number;
    model: string;
    cacheEnabled: boolean;
    redis: Redis;
    maxRetries?: number;
    timeout?: number;
}

export interface OllamaMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface OllamaResponse {
    model: string;
    created_at: string;
    message: OllamaMessage;
    done: boolean;
    total_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface GenerationOptions {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    stream?: boolean;
    format?: "json";
    system?: string;
    template?: string;
    context?: number[];
    seed?: number;
}

export class OllamaService extends EventEmitter {
    private client: AxiosInstance;
    private config: OllamaConfig;
    private activeRequests: Map<string, Promise<any>> = new Map();
    private modelLoaded: boolean = false;

    constructor(config: OllamaConfig) {
        super();
        this.config = config;
        this.client = axios.create({
            baseURL: `http://${config.host}:${config.port}`,
            timeout: config.timeout || 300000, // 5 minutes default
            headers: {
                "Content-Type": "application/json",
            },
        });

        this.initializeModel();
    }

    private async initializeModel() {
        try {
            // Check if model exists
            const response = await this.client.get("/api/tags");
            const models = response.data.models || [];
            const modelExists = models.some(
                (m: any) => m.name === this.config.model
            );

            if (!modelExists) {
                console.log(`Model ${this.config.model} not found. Pulling...`);
                await this.pullModel(this.config.model);
            }

            // Load model into memory
            await this.loadModel();
            this.modelLoaded = true;
            this.emit("model:loaded", this.config.model);
        } catch (error) {
            console.error("Failed to initialize model:", error);
            this.emit("model:error", error);
        }
    }

    private async pullModel(modelName: string): Promise<void> {
        try {
            await this.client.post("/api/pull", {
                name: modelName,
                stream: false,
            });
            console.log(`Model ${modelName} pulled successfully`);
        } catch (error) {
            throw new Error(
                `Failed to pull model ${modelName}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async loadModel(): Promise<void> {
        // Pre-load model by making a dummy request
        await this.generate({
            messages: [{ role: "user", content: "Hello" }],
            options: { num_predict: 1 },
        });
    }

    private getCacheKey(
        messages: OllamaMessage[],
        options?: GenerationOptions
    ): string {
        const hash = crypto.createHash("sha256");
        hash.update(
            JSON.stringify({ messages, options, model: this.config.model })
        );
        return `ollama:cache:${hash.digest("hex")}`;
    }

    public async generate(params: {
        messages: OllamaMessage[];
        options?: GenerationOptions;
        useCache?: boolean;
    }): Promise<OllamaResponse> {
        const { messages, options = {}, useCache = true } = params;

        // Check cache first
        if (this.config.cacheEnabled && useCache) {
            const cacheKey = this.getCacheKey(messages, options);
            const cached = await this.config.redis.get(cacheKey);

            if (cached) {
                this.emit("cache:hit", cacheKey);
                return JSON.parse(cached);
            }
        }

        // Deduplication: Check if identical request is already in progress
        const requestKey = this.getCacheKey(messages, options);
        const existingRequest = this.activeRequests.get(requestKey);
        if (existingRequest) {
            return existingRequest;
        }

        // Create new request
        const requestPromise = this.performGeneration(messages, options);
        this.activeRequests.set(requestKey, requestPromise);

        try {
            const response = await requestPromise;

            // Cache successful response
            if (this.config.cacheEnabled && useCache) {
                const cacheKey = this.getCacheKey(messages, options);
                await this.config.redis.set(
                    cacheKey,
                    JSON.stringify(response),
                    "EX",
                    3600 // 1 hour cache
                );
                this.emit("cache:set", cacheKey);
            }

            return response;
        } finally {
            this.activeRequests.delete(requestKey);
        }
    }

    private async performGeneration(
        messages: OllamaMessage[],
        options: GenerationOptions
    ): Promise<OllamaResponse> {
        const maxRetries = this.config.maxRetries || 3;
        let lastError: Error = new Error("No attempts made");

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await this.client.post("/api/chat", {
                    model: this.config.model,
                    messages,
                    options: {
                        temperature: options.temperature || 0.7,
                        top_p: options.top_p || 0.9,
                        top_k: options.top_k || 40,
                        num_predict: options.num_predict || 2048,
                        stop: options.stop,
                        seed: options.seed,
                        ...options,
                    },
                    stream: false,
                    format: options.format,
                });

                this.emit("generation:success", {
                    model: this.config.model,
                    duration: response.data.total_duration,
                    tokens: response.data.eval_count,
                });

                return response.data;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(
                    `Generation attempt ${attempt + 1} failed:`,
                    lastError.message
                );

                if (attempt < maxRetries - 1) {
                    await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
                }
            }
        }

        this.emit("generation:error", lastError);
        throw new Error(
            `Generation failed after ${maxRetries} attempts: ${lastError.message}`
        );
    }

    public async generateWithPrompt(
        systemPrompt: string,
        userPrompt: string,
        options?: GenerationOptions
    ): Promise<string> {
        const messages: OllamaMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];

        const response = await this.generate({ messages, options });
        return response.message.content;
    }

    public async generateJSON<T = any>(
        systemPrompt: string,
        userPrompt: string,
        schema?: any
    ): Promise<T> {
        const enhancedPrompt = schema
            ? `${systemPrompt}\n\nYou must respond with valid JSON that matches this schema:\n${JSON.stringify(
                  schema,
                  null,
                  2
              )}`
            : `${systemPrompt}\n\nYou must respond with valid JSON.`;

        const response = await this.generateWithPrompt(
            enhancedPrompt,
            userPrompt,
            { format: "json" }
        );

        try {
            return JSON.parse(response);
        } catch (error) {
            throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async batchGenerate(
        requests: Array<{
            messages: OllamaMessage[];
            options?: GenerationOptions;
        }>
    ): Promise<OllamaResponse[]> {
        // Process in batches to avoid overwhelming the GPU
        const batchSize = 4;
        const results: OllamaResponse[] = [];

        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map((req) =>
                this.generate({ messages: req.messages, options: req.options })
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }

    public async streamGenerate(params: {
        messages: OllamaMessage[];
        options?: GenerationOptions;
        onToken?: (token: string) => void;
    }): Promise<string> {
        const { messages, options = {}, onToken } = params;

        const response = await this.client.post(
            "/api/chat",
            {
                model: this.config.model,
                messages,
                options: { ...options, stream: true },
                stream: true,
            },
            {
                responseType: "stream",
            }
        );

        let fullResponse = "";

        return new Promise((resolve, reject) => {
            response.data.on("data", (chunk: Buffer) => {
                try {
                    const lines = chunk.toString().split("\n").filter(Boolean);

                    for (const line of lines) {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            fullResponse += data.message.content;
                            if (onToken) {
                                onToken(data.message.content);
                            }
                        }

                        if (data.done) {
                            resolve(fullResponse);
                        }
                    }
                } catch (error) {
                    reject(error);
                }
            });

            response.data.on("error", reject);
        });
    }

    public async getModelInfo(): Promise<any> {
        const response = await this.client.get(`/api/show`, {
            params: { name: this.config.model },
        });
        return response.data;
    }

    public async listModels(): Promise<any[]> {
        const response = await this.client.get("/api/tags");
        return response.data.models || [];
    }

    public async deleteModel(modelName: string): Promise<void> {
        await this.client.delete("/api/delete", {
            data: { name: modelName },
        });
    }

    public async clearCache(): Promise<void> {
        const keys = await this.config.redis.keys("ollama:cache:*");
        if (keys.length > 0) {
            await this.config.redis.del(...keys);
        }
        this.emit("cache:cleared", keys.length);
    }

    public getStats(): {
        modelLoaded: boolean;
        activeRequests: number;
        model: string;
    } {
        return {
            modelLoaded: this.modelLoaded,
            activeRequests: this.activeRequests.size,
            model: this.config.model,
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Specialized prompt templates for research tasks
export class ResearchPrompts {
    static readonly CLARIFICATION_QUESTIONS = `You are a research assistant helping to clarify a research topic.
Generate 2-3 specific, targeted questions that will help better understand the user's research goals.
Focus on:
1. Specific technical aspects or constraints
2. Expected outcomes or applications
3. Any existing work or references they have in mind

Respond with a JSON array of questions.`;

    static readonly RESEARCH_PLAN = `You are a senior research scientist creating a detailed research plan.
Based on the topic and clarifications provided, create a comprehensive research plan including:
1. Research objectives
2. Methodology
3. Required resources
4. Expected timeline
5. Key papers to review
6. Potential challenges

Respond with a structured JSON object.`;

    static readonly CODE_GENERATION = `You are an expert software engineer.
Generate production-quality code with:
1. Clean architecture
2. Comprehensive error handling
3. Unit tests
4. Documentation
5. Type safety

Follow best practices for the given programming language.`;

    static readonly PAPER_WRITING = `You are an academic researcher writing for a peer-reviewed journal.
Write in a formal, scientific style following IEEE format.
Include proper citations and ensure technical accuracy.
Structure the content with clear sections and subsections.`;

    static readonly PRESENTATION_CREATION = `You are creating a professional presentation for an academic conference.
Focus on:
1. Clear visual hierarchy
2. Concise bullet points
3. Effective data visualization
4. Logical flow
5. Engaging narrative

Keep text minimal and impactful.`;
}

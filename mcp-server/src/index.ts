// mcp-server/src/index.ts

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import { OllamaService } from "./services/ollama";
import { ResearchOrchestrator } from "./orchestrators/research";
import { WorkflowManager } from "./managers/workflow";

// Types
export interface MCPMessage {
    id: string;
    type: "request" | "response" | "notification";
    method: string;
    params?: any;
    result?: any;
    error?: any;
    timestamp: number;
}

export interface ResearchSession {
    id: string;
    topic: string;
    stage: ResearchStage;
    clarifications: string[];
    metadata: any;
    history: MCPMessage[];
    createdAt: Date;
    updatedAt: Date;
}

export enum ResearchStage {
    INITIAL = "initial",
    CLARIFICATION = "clarification",
    RESEARCH = "research",
    DEVELOPMENT = "development",
    TESTING = "testing",
    DOCUMENTATION = "documentation",
    COMPLETED = "completed",
}

// Initialize services
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3001",
        credentials: true,
    },
});

const redis = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: 3,
});

// Services initialization
const ollamaService = new OllamaService({
    host: process.env.OLLAMA_HOST || "ollama",
    port: parseInt(process.env.OLLAMA_PORT || "11434"),
    model: process.env.OLLAMA_MODEL || "mixtral:8x7b-instruct-v0.1-q4_K_M",
    cacheEnabled: true,
    redis,
});

const researchOrchestrator = new ResearchOrchestrator({
    ollamaService,
    redis,
});

const workflowManager = new WorkflowManager({
    researchOrchestrator,
    redis,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MCP Protocol Handler
class MCPHandler {
    private sessions: Map<string, ResearchSession> = new Map();

    constructor(
        private io: Server,
        private workflowManager: WorkflowManager
    ) {
        this.setupSocketHandlers();
    }

    private setupSocketHandlers() {
        this.io.on("connection", (socket) => {
            console.log(`Client connected: ${socket.id}`);

            // Handle MCP messages
            socket.on("mcp:request", async (message: MCPMessage) => {
                try {
                    const response = await this.handleMCPRequest(
                        message
                    );
                    socket.emit("mcp:response", response);
                } catch (error) {
                    socket.emit("mcp:error", {
                        id: message.id,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        timestamp: Date.now(),
                    });
                }
            });

            // Handle session management
            socket.on("session:create", async (data) => {
                const session = await this.createSession(data.topic);
                socket.join(session.id);
                socket.emit("session:created", session);
            });

            socket.on("session:join", async (sessionId) => {
                const session = this.sessions.get(sessionId);
                if (session) {
                    socket.join(sessionId);
                    socket.emit("session:joined", session);
                } else {
                    socket.emit("session:error", {
                        message: "Session not found",
                    });
                }
            });

            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });
    }

    private async handleMCPRequest(
        message: MCPMessage
        // socketId: string
    ): Promise<MCPMessage> {
        switch (message.method) {
            case "research.start":
                return await this.startResearch(message);

            case "research.clarify":
                return await this.handleClarification(message);

            case "research.approve":
                return await this.approveResearch(message);

            case "development.start":
                return await this.startDevelopment(message);

            case "testing.run":
                return await this.runTesting(message);

            case "documentation.generate":
                return await this.generateDocumentation(message);

            case "workflow.status":
                return await this.getWorkflowStatus(message);

            default:
                throw new Error(`Unknown method: ${message.method}`);
        }
    }

    private async createSession(topic: string): Promise<ResearchSession> {
        const session: ResearchSession = {
            id: uuidv4(),
            topic,
            stage: ResearchStage.INITIAL,
            clarifications: [],
            metadata: {},
            history: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.sessions.set(session.id, session);
        await redis.set(
            `session:${session.id}`,
            JSON.stringify(session),
            "EX",
            86400
        ); // 24h expiry

        return session;
    }

    private async startResearch(message: MCPMessage): Promise<MCPMessage> {
        const { sessionId, topic } = message.params;
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        // Generate clarification questions
        const questions =
            await this.workflowManager.generateClarificationQuestions(topic);

        session.stage = ResearchStage.CLARIFICATION;
        session.updatedAt = new Date();

        // Broadcast progress
        this.io.to(sessionId).emit("research:progress", {
            stage: ResearchStage.CLARIFICATION,
            questions,
        });

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: {
                sessionId,
                questions,
                stage: ResearchStage.CLARIFICATION,
            },
            timestamp: Date.now(),
        };
    }

    private async handleClarification(
        message: MCPMessage
    ): Promise<MCPMessage> {
        const { sessionId, answers } = message.params;
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        session.clarifications.push(...answers);

        // Check if we need more clarifications
        if (session.clarifications.length < 2) {
            const additionalQuestions =
                await this.workflowManager.generateFollowUpQuestions(
                    session.topic,
                    session.clarifications
                );

            return {
                id: uuidv4(),
                type: "response",
                method: message.method,
                result: {
                    sessionId,
                    questions: additionalQuestions,
                    needsMoreClarification: true,
                },
                timestamp: Date.now(),
            };
        }

        // Start autonomous research
        session.stage = ResearchStage.RESEARCH;
        const researchPlan = await this.workflowManager.createResearchPlan(
            session.topic,
            session.clarifications
        );

        // Start research in background
        this.workflowManager
            .executeResearch(sessionId, researchPlan)
            .then((results) => {
                this.io.to(sessionId).emit("research:completed", results);
            });

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: {
                sessionId,
                researchPlan,
                stage: ResearchStage.RESEARCH,
            },
            timestamp: Date.now(),
        };
    }

    private async approveResearch(message: MCPMessage): Promise<MCPMessage> {
        const { sessionId, approved, feedback } = message.params;
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        if (!approved && feedback) {
            // Refine research based on feedback
            await this.workflowManager.refineResearch(sessionId, feedback);

            return {
                id: uuidv4(),
                type: "response",
                method: message.method,
                result: {
                    sessionId,
                    status: "refining",
                    message: "Research is being refined based on your feedback",
                },
                timestamp: Date.now(),
            };
        }

        // Move to development stage
        session.stage = ResearchStage.DEVELOPMENT;
        await this.workflowManager.startDevelopment(sessionId);

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: {
                sessionId,
                stage: ResearchStage.DEVELOPMENT,
                message: "Development phase started",
            },
            timestamp: Date.now(),
        };
    }

    private async startDevelopment(message: MCPMessage): Promise<MCPMessage> {
        const { sessionId } = message.params;

        // Development is handled automatically after research approval
        const developmentStatus =
            await this.workflowManager.getDevelopmentStatus(sessionId);

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: developmentStatus,
            timestamp: Date.now(),
        };
    }

    private async runTesting(message: MCPMessage): Promise<MCPMessage> {
        const { sessionId } = message.params;

        const testResults = await this.workflowManager.runTests(sessionId);

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: testResults,
            timestamp: Date.now(),
        };
    }

    private async generateDocumentation(
        message: MCPMessage
    ): Promise<MCPMessage> {
        const { sessionId, format, template } = message.params;

        const documents = await this.workflowManager.generateDocuments(
            sessionId,
            {
                format, // 'pdf', 'latex', 'pptx'
                template: template || "ieee",
            }
        );

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: documents,
            timestamp: Date.now(),
        };
    }

    private async getWorkflowStatus(message: MCPMessage): Promise<MCPMessage> {
        const { sessionId } = message.params;

        const status = await this.workflowManager.getWorkflowStatus(sessionId);

        return {
            id: uuidv4(),
            type: "response",
            method: message.method,
            result: status,
            timestamp: Date.now(),
        };
    }
}

// Initialize MCP Handler
new MCPHandler(io, workflowManager);

// REST API Endpoints
app.get("/health", (_, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
});

app.get("/sessions", async (_, res) => {
    const keys = await redis.keys("session:*");
    const sessions = await Promise.all(
        keys.map(async (key) => {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        })
    );
    res.json(sessions.filter(session => session !== null));
});

app.get("/session/:id", async (req, res) => {
    const sessionData = await redis.get(`session:${req.params.id}`);
    if (sessionData) {
        res.json(JSON.parse(sessionData));
    } else {
        res.status(404).json({ error: "Session not found" });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`MCP Server running on port ${PORT}`);
});

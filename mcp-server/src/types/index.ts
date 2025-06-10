// mcp-server/src/types/index.ts
export * from "../protocols/mcp";

export interface ServiceConfig {
    host: string;
    port: number;
    timeout?: number;
    maxRetries?: number;
}

export interface ResearchSession {
    id: string;
    topic: string;
    stage: ResearchStage;
    clarifications: string[];
    metadata: any;
    history: any[];
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

export interface WorkflowState {
    sessionId: string;
    currentStage: ResearchStage;
    stages: StageProgress[];
    startTime: Date;
    lastUpdateTime: Date;
    errors: WorkflowError[];
    metadata: any;
}

export interface StageProgress {
    stage: ResearchStage;
    status: "pending" | "in_progress" | "completed" | "failed";
    startTime?: Date;
    endTime?: Date;
    progress: number;
    details: any;
}

export interface WorkflowError {
    stage: ResearchStage;
    error: string;
    timestamp: Date;
    retryCount: number;
}

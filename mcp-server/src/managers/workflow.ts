// mcp-server/src/managers/workflow.ts

import { EventEmitter } from "events";
import { Redis } from "ioredis";
import axios from "axios";
import { OllamaService } from "../services/ollama";
import {
    ResearchOrchestrator,
    ResearchPlan,
    ResearchResult,
} from "../orchestrators/research";
import { ResearchStage } from "../index";

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
    progress: number; // 0-100
    details: any;
}

export interface WorkflowError {
    stage: ResearchStage;
    error: string;
    timestamp: Date;
    retryCount: number;
}

export interface DevelopmentStatus {
    projectId: string;
    status: "initializing" | "generating" | "testing" | "completed" | "failed";
    progress: number;
    filesCreated: number;
    testsRun: number;
    testsPassed: number;
    coverage: number;
    lastCommit?: string;
}

export interface DocumentGenerationOptions {
    format: "pdf" | "latex" | "pptx";
    template: string;
}

export class WorkflowManager extends EventEmitter {
    private workflows: Map<string, WorkflowState> = new Map();
    private codeDevUrl: string;
    private docGenUrl: string;
    private crawlerUrl: string;

    constructor(
        private config: {
            researchOrchestrator: ResearchOrchestrator;
            redis: Redis;
        }
    ) {
        super();
        this.codeDevUrl = `http://${
            process.env.CODE_DEV_HOST || "code_developer"
        }:${process.env.CODE_DEV_PORT || "8080"}`;
        this.docGenUrl = `http://${
            process.env.DOC_GEN_HOST || "doc_generator"
        }:${process.env.DOC_GEN_PORT || "5001"}`;
        this.crawlerUrl = `http://${
            process.env.CRAWLER_HOST || "research_crawler"
        }:${process.env.CRAWLER_PORT || "5000"}`;
    }

    public async generateClarificationQuestions(
        topic: string
    ): Promise<string[]> {
        const prompt = `
Research Topic: "${topic}"

Generate 2-3 specific, clarifying questions that will help better understand:
1. The specific technical scope and constraints
2. Expected outcomes and applications
3. Any existing work or specific areas of focus

Make the questions direct and focused on gathering actionable information.
Return as a JSON array of question strings.
`;

        const questions = await this.config.researchOrchestrator[
            "config"
        ].ollamaService.generateJSON<string[]>(
            "You are a research assistant gathering requirements.",
            prompt
        );

        return questions;
    }

    public async generateFollowUpQuestions(
        topic: string,
        previousAnswers: string[]
    ): Promise<string[]> {
        const prompt = `
Research Topic: "${topic}"

Previous clarifications:
${previousAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Based on the above, generate 1-2 more specific follow-up questions to further clarify:
- Technical implementation details
- Specific metrics or evaluation criteria
- Any constraints or preferences

Return as a JSON array of question strings.
`;

        const questions = await this.config.researchOrchestrator[
            "config"
        ].ollamaService.generateJSON<string[]>(
            "You are refining research requirements.",
            prompt
        );

        return questions;
    }

    public async createResearchPlan(
        topic: string,
        clarifications: string[]
    ): Promise<ResearchPlan> {
        // Initialize workflow state
        const sessionId = `session_${Date.now()}`;
        const workflowState: WorkflowState = {
            sessionId,
            currentStage: ResearchStage.RESEARCH,
            stages: this.initializeStages(),
            startTime: new Date(),
            lastUpdateTime: new Date(),
            errors: [],
            metadata: { topic, clarifications },
        };

        this.workflows.set(sessionId, workflowState);
        await this.saveWorkflowState(workflowState);

        // Update stage progress
        this.updateStageProgress(
            sessionId,
            ResearchStage.RESEARCH,
            "in_progress",
            10
        );

        // Create research plan
        const plan = await this.config.researchOrchestrator.createResearchPlan(
            topic,
            clarifications
        );

        // Update progress
        this.updateStageProgress(
            sessionId,
            ResearchStage.RESEARCH,
            "in_progress",
            30
        );

        return plan;
    }

    public async executeResearch(
        sessionId: string,
        plan: ResearchPlan
    ): Promise<ResearchResult> {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) {
            throw new Error("Workflow not found");
        }

        try {
            // Monitor research progress
            this.config.researchOrchestrator.on("crawl:progress", (data) => {
                const currentProgress = this.getStageProgress(
                    sessionId,
                    ResearchStage.RESEARCH
                );
                const newProgress = Math.min(currentProgress + 10, 90);
                this.updateStageProgress(
                    sessionId,
                    ResearchStage.RESEARCH,
                    "in_progress",
                    newProgress
                );
            });

            // Execute research
            const results =
                await this.config.researchOrchestrator.executeResearch(
                    sessionId,
                    plan
                );

            // Mark research as completed
            this.updateStageProgress(
                sessionId,
                ResearchStage.RESEARCH,
                "completed",
                100
            );

            return results;
        } catch (error) {
            this.recordError(sessionId, ResearchStage.RESEARCH, error.message);
            throw error;
        }
    }

    public async refineResearch(
        sessionId: string,
        feedback: string
    ): Promise<void> {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) {
            throw new Error("Workflow not found");
        }

        // Reset research stage
        this.updateStageProgress(
            sessionId,
            ResearchStage.RESEARCH,
            "in_progress",
            50
        );

        try {
            await this.config.researchOrchestrator.refineResearch(
                sessionId,
                feedback
            );
            this.updateStageProgress(
                sessionId,
                ResearchStage.RESEARCH,
                "completed",
                100
            );
        } catch (error) {
            this.recordError(sessionId, ResearchStage.RESEARCH, error.message);
            throw error;
        }
    }

    public async startDevelopment(sessionId: string): Promise<void> {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) {
            throw new Error("Workflow not found");
        }

        // Update workflow stage
        workflow.currentStage = ResearchStage.DEVELOPMENT;
        this.updateStageProgress(
            sessionId,
            ResearchStage.DEVELOPMENT,
            "in_progress",
            10
        );

        try {
            // Get research results
            const researchData = await this.config.redis.get(
                `research:results:${sessionId}`
            );
            if (!researchData) {
                throw new Error("Research results not found");
            }

            const research = JSON.parse(researchData);

            // Create project
            const projectResponse = await axios.post(
                `${this.codeDevUrl}/project/create`,
                {
                    sessionId,
                    projectName: this.sanitizeProjectName(research.topic),
                    language: this.detectLanguage(research),
                    framework: this.detectFramework(research),
                }
            );

            const project = projectResponse.data;
            workflow.metadata.projectId = project.id;

            // Update progress
            this.updateStageProgress(
                sessionId,
                ResearchStage.DEVELOPMENT,
                "in_progress",
                20
            );

            // Generate code
            await axios.post(`${this.codeDevUrl}/code/generate`, {
                sessionId: project.id,
                projectName: project.name,
                language: project.language,
                framework: project.framework,
                technicalDetails: research.technicalDetails,
                architecture: research.proposedApproach,
            });

            // Update progress
            this.updateStageProgress(
                sessionId,
                ResearchStage.DEVELOPMENT,
                "in_progress",
                60
            );

            // Run tests
            await this.runTestsWithRetry(project.id);

            // Mark development as completed
            this.updateStageProgress(
                sessionId,
                ResearchStage.DEVELOPMENT,
                "completed",
                100
            );

            // Move to testing stage
            workflow.currentStage = ResearchStage.TESTING;
            await this.saveWorkflowState(workflow);
        } catch (error) {
            this.recordError(
                sessionId,
                ResearchStage.DEVELOPMENT,
                error.message
            );
            throw error;
        }
    }

    public async runTests(sessionId: string): Promise<any> {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) {
            throw new Error("Workflow not found");
        }

        const projectId = workflow.metadata.projectId;
        if (!projectId) {
            throw new Error("Project ID not found");
        }

        this.updateStageProgress(
            sessionId,
            ResearchStage.TESTING,
            "in_progress",
            10
        );

        try {
            const testResponse = await axios.post(
                `${this.codeDevUrl}/test/run`,
                {
                    projectId,
                }
            );

            const testResults = testResponse.data;

            // Save test results
            await this.config.redis.set(
                `test:results:${sessionId}`,
                JSON.stringify(testResults),
                "EX",
                86400
            );

            // Update progress based on test results
            const progress = testResults.failed === 0 ? 100 : 80;
            this.updateStageProgress(
                sessionId,
                ResearchStage.TESTING,
                "completed",
                progress
            );

            return testResults;
        } catch (error) {
            this.recordError(sessionId, ResearchStage.TESTING, error.message);
            throw error;
        }
    }

    public async generateDocuments(
        sessionId: string,
        options: DocumentGenerationOptions
    ): Promise<any> {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) {
            throw new Error("Workflow not found");
        }

        // Update stage
        workflow.currentStage = ResearchStage.DOCUMENTATION;
        this.updateStageProgress(
            sessionId,
            ResearchStage.DOCUMENTATION,
            "in_progress",
            10
        );

        try {
            const documents = [];

            // Generate PDF report
            if (options.format === "pdf" || !options.format) {
                const reportResponse = await axios.post(
                    `${this.docGenUrl}/generate/report`,
                    {
                        sessionId,
                    }
                );
                documents.push({
                    type: "report",
                    format: "pdf",
                    ...reportResponse.data,
                });
                this.updateStageProgress(
                    sessionId,
                    ResearchStage.DOCUMENTATION,
                    "in_progress",
                    30
                );
            }

            // Generate LaTeX paper
            if (options.format === "latex" || !options.format) {
                const paperResponse = await axios.post(
                    `${this.docGenUrl}/generate/paper`,
                    {
                        sessionId,
                        template: options.template,
                    }
                );
                documents.push({
                    type: "paper",
                    format: "latex",
                    ...paperResponse.data,
                });
                this.updateStageProgress(
                    sessionId,
                    ResearchStage.DOCUMENTATION,
                    "in_progress",
                    60
                );
            }

            // Generate PowerPoint
            if (options.format === "pptx" || !options.format) {
                const pptResponse = await axios.post(
                    `${this.docGenUrl}/generate/presentation`,
                    {
                        sessionId,
                        style: "modern",
                    }
                );
                documents.push({
                    type: "presentation",
                    format: "pptx",
                    ...pptResponse.data,
                });
                this.updateStageProgress(
                    sessionId,
                    ResearchStage.DOCUMENTATION,
                    "in_progress",
                    90
                );
            }

            // Mark documentation as completed
            this.updateStageProgress(
                sessionId,
                ResearchStage.DOCUMENTATION,
                "completed",
                100
            );

            // Update workflow to completed
            workflow.currentStage = ResearchStage.COMPLETED;
            await this.saveWorkflowState(workflow);

            return {
                documents,
                sessionId,
                completedAt: new Date(),
            };
        } catch (error) {
            this.recordError(
                sessionId,
                ResearchStage.DOCUMENTATION,
                error.message
            );
            throw error;
        }
    }

    public async getDevelopmentStatus(
        sessionId: string
    ): Promise<DevelopmentStatus> {
        const workflow = this.workflows.get(sessionId);
        if (!workflow || !workflow.metadata.projectId) {
            throw new Error("Development not started");
        }

        try {
            const projectResponse = await axios.get(
                `${this.codeDevUrl}/project/${workflow.metadata.projectId}`
            );

            const project = projectResponse.data;
            const stage = this.getStage(sessionId, ResearchStage.DEVELOPMENT);

            return {
                projectId: project.id,
                status: this.mapStageStatus(stage.status),
                progress: stage.progress,
                filesCreated: project.fileCount || 0,
                testsRun: project.testCount || 0,
                testsPassed: project.testsPassed || 0,
                coverage: project.coverage || 0,
                lastCommit: project.lastCommit,
            };
        } catch (error) {
            return {
                projectId: workflow.metadata.projectId,
                status: "failed",
                progress: 0,
                filesCreated: 0,
                testsRun: 0,
                testsPassed: 0,
                coverage: 0,
            };
        }
    }

    public async getWorkflowStatus(sessionId: string): Promise<WorkflowState> {
        let workflow = this.workflows.get(sessionId);

        if (!workflow) {
            // Try to load from Redis
            const saved = await this.config.redis.get(`workflow:${sessionId}`);
            if (saved) {
                workflow = JSON.parse(saved);
                this.workflows.set(sessionId, workflow);
            } else {
                throw new Error("Workflow not found");
            }
        }

        return workflow;
    }

    // Helper methods
    private initializeStages(): StageProgress[] {
        const stages = Object.values(ResearchStage);
        return stages.map((stage) => ({
            stage,
            status: "pending" as const,
            progress: 0,
            details: {},
        }));
    }

    private updateStageProgress(
        sessionId: string,
        stage: ResearchStage,
        status: StageProgress["status"],
        progress: number,
        details?: any
    ): void {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) return;

        const stageProgress = workflow.stages.find((s) => s.stage === stage);
        if (stageProgress) {
            stageProgress.status = status;
            stageProgress.progress = progress;
            if (details) {
                stageProgress.details = {
                    ...stageProgress.details,
                    ...details,
                };
            }
            if (status === "in_progress" && !stageProgress.startTime) {
                stageProgress.startTime = new Date();
            }
            if (status === "completed" || status === "failed") {
                stageProgress.endTime = new Date();
            }
        }

        workflow.lastUpdateTime = new Date();
        this.saveWorkflowState(workflow);

        // Emit progress event
        this.emit("workflow:progress", {
            sessionId,
            stage,
            status,
            progress,
        });
    }

    private getStageProgress(sessionId: string, stage: ResearchStage): number {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) return 0;

        const stageProgress = workflow.stages.find((s) => s.stage === stage);
        return stageProgress?.progress || 0;
    }

    private getStage(sessionId: string, stage: ResearchStage): StageProgress {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) throw new Error("Workflow not found");

        const stageProgress = workflow.stages.find((s) => s.stage === stage);
        if (!stageProgress) throw new Error("Stage not found");

        return stageProgress;
    }

    private recordError(
        sessionId: string,
        stage: ResearchStage,
        error: string
    ): void {
        const workflow = this.workflows.get(sessionId);
        if (!workflow) return;

        const existingError = workflow.errors.find((e) => e.stage === stage);
        if (existingError) {
            existingError.retryCount++;
            existingError.error = error;
            existingError.timestamp = new Date();
        } else {
            workflow.errors.push({
                stage,
                error,
                timestamp: new Date(),
                retryCount: 0,
            });
        }

        this.updateStageProgress(sessionId, stage, "failed", 0);
        this.saveWorkflowState(workflow);
    }

    private async saveWorkflowState(workflow: WorkflowState): Promise<void> {
        await this.config.redis.set(
            `workflow:${workflow.sessionId}`,
            JSON.stringify(workflow),
            "EX",
            86400 * 7 // 7 days
        );
    }

    private sanitizeProjectName(topic: string): string {
        return topic
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .replace(/_+/g, "_")
            .substring(0, 50);
    }

    private detectLanguage(research: any): string {
        // Analyze technical details to detect programming language
        const content = JSON.stringify(research.technicalDetails).toLowerCase();

        if (
            content.includes("python") ||
            content.includes("numpy") ||
            content.includes("pandas")
        ) {
            return "python";
        } else if (
            content.includes("javascript") ||
            content.includes("node") ||
            content.includes("react")
        ) {
            return "javascript";
        } else if (content.includes("typescript")) {
            return "typescript";
        } else if (
            content.includes("java") &&
            !content.includes("javascript")
        ) {
            return "java";
        } else if (content.includes("c++") || content.includes("cpp")) {
            return "cpp";
        }

        return "python"; // Default
    }

    private detectFramework(research: any): string | undefined {
        const content = JSON.stringify(research.technicalDetails).toLowerCase();

        if (content.includes("tensorflow") || content.includes("keras")) {
            return "tensorflow";
        } else if (content.includes("pytorch")) {
            return "pytorch";
        } else if (content.includes("react")) {
            return "react";
        } else if (content.includes("vue")) {
            return "vue";
        } else if (content.includes("django")) {
            return "django";
        } else if (content.includes("flask")) {
            return "flask";
        } else if (content.includes("express")) {
            return "express";
        }

        return undefined;
    }

    private mapStageStatus(
        status: StageProgress["status"]
    ): DevelopmentStatus["status"] {
        switch (status) {
            case "pending":
                return "initializing";
            case "in_progress":
                return "generating";
            case "completed":
                return "completed";
            case "failed":
                return "failed";
            default:
                return "initializing";
        }
    }

    private async runTestsWithRetry(
        projectId: string,
        maxRetries: number = 3
    ): Promise<any> {
        let lastError: Error;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await axios.post(
                    `${this.codeDevUrl}/test/run`,
                    {
                        projectId,
                    }
                );

                const testResults = response.data;

                // If all tests pass, return
                if (testResults.failed === 0) {
                    return testResults;
                }

                // If tests fail, wait and retry
                if (attempt < maxRetries - 1) {
                    await this.delay(5000); // Wait 5 seconds before retry
                }
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries - 1) {
                    await this.delay(5000);
                }
            }
        }

        throw lastError || new Error("Tests failed after retries");
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

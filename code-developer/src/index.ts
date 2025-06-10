// code-developer/src/index.ts

import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import * as fs from "fs-extra";
import * as path from "path";
import { simpleGit, SimpleGit } from "simple-git";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import Redis from "ioredis";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const execAsync = promisify(exec);

interface CodeProject {
    id: string;
    sessionId: string;
    name: string;
    path: string;
    language: string;
    framework?: string;
    gitRepo?: string;
    structure: FileStructure;
    dependencies: string[];
    testFramework: string;
    createdAt: Date;
    updatedAt: Date;
}

interface FileStructure {
    [key: string]: FileNode;
}

interface FileNode {
    type: "file" | "directory";
    content?: string;
    children?: FileStructure;
}

interface CodeGenerationRequest {
    sessionId: string;
    projectName: string;
    language: string;
    framework?: string;
    technicalDetails: any[];
    architecture: string;
}

interface TestResult {
    passed: number;
    failed: number;
    skipped: number;
    coverage: {
        lines: number;
        functions: number;
        branches: number;
    };
    details: TestDetail[];
}

interface TestDetail {
    name: string;
    status: "passed" | "failed" | "skipped";
    duration: number;
    error?: string;
}

export class CodeDeveloperService {
    private app: express.Application;
    private server: any;
    private io: Server;
    private redis: Redis;
    private workspacePath: string;
    private projects: Map<string, CodeProject> = new Map();

    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server);
        this.redis = new Redis({
            host: process.env.REDIS_HOST || "redis",
            port: parseInt(process.env.REDIS_PORT || "6379"),
        });
        this.workspacePath = process.env.WORKSPACE_PATH || "/workspace";

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    private setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private setupRoutes() {
        this.app.post("/project/create", this.createProject.bind(this));
        this.app.post("/code/generate", this.generateCode.bind(this));
        this.app.post("/test/run", this.runTests.bind(this));
        this.app.post("/git/commit", this.gitCommit.bind(this));
        this.app.get("/project/:id", this.getProject.bind(this));
        this.app.get("/project/:id/files", this.getProjectFiles.bind(this));
        this.app.get("/health", (req, res) => res.json({ status: "healthy" }));
    }

    private setupSocketHandlers() {
        this.io.on("connection", (socket) => {
            console.log("Client connected:", socket.id);

            socket.on("subscribe", (projectId: string) => {
                socket.join(projectId);
            });

            socket.on("disconnect", () => {
                console.log("Client disconnected:", socket.id);
            });
        });
    }

    private async createProject(req: express.Request, res: express.Response) {
        try {
            const { sessionId, projectName, language, framework } = req.body;

            const project: CodeProject = {
                id: uuidv4(),
                sessionId,
                name: projectName,
                path: path.join(this.workspacePath, projectName),
                language,
                framework,
                structure: {},
                dependencies: [],
                testFramework: this.getTestFramework(language),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Create project directory
            await fs.ensureDir(project.path);

            // Initialize git repository
            const git = simpleGit(project.path);
            await git.init();
            await git.addConfig(
                "user.name",
                process.env.GIT_USER_NAME || "Research Bot"
            );
            await git.addConfig(
                "user.email",
                process.env.GIT_USER_EMAIL || "bot@research.local"
            );

            // Create initial project structure
            await this.createInitialStructure(project);

            // Store project
            this.projects.set(project.id, project);
            await this.redis.set(
                `project:${project.id}`,
                JSON.stringify(project)
            );

            res.json(project);
        } catch (error) {
            console.error("Error creating project:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    }

    private async createInitialStructure(project: CodeProject) {
        const structures = {
            python: {
                src: { type: "directory" as const },
                tests: { type: "directory" as const },
                docs: { type: "directory" as const },
                "requirements.txt": {
                    type: "file" as const,
                    content:
                        "# Project dependencies\nnumpy>=1.21.0\npandas>=1.3.0\nscipy>=1.7.0\npytest>=6.2.0\npytest-cov>=2.12.0\n",
                },
                "setup.py": {
                    type: "file" as const,
                    content: this.generateSetupPy(project),
                },
                "README.md": {
                    type: "file" as const,
                    content: this.generateReadme(project),
                },
                ".gitignore": {
                    type: "file" as const,
                    content: this.generateGitignore("python"),
                },
            },
            javascript: {
                src: { type: "directory" as const },
                tests: { type: "directory" as const },
                docs: { type: "directory" as const },
                "package.json": {
                    type: "file" as const,
                    content: this.generatePackageJson(project),
                },
                "README.md": {
                    type: "file" as const,
                    content: this.generateReadme(project),
                },
                ".gitignore": {
                    type: "file" as const,
                    content: this.generateGitignore("node"),
                },
                "jest.config.js": {
                    type: "file" as const,
                    content: this.generateJestConfig(),
                },
            },
            typescript: {
                src: { type: "directory" as const },
                tests: { type: "directory" as const },
                docs: { type: "directory" as const },
                "package.json": {
                    type: "file" as const,
                    content: this.generatePackageJson(project),
                },
                "tsconfig.json": {
                    type: "file" as const,
                    content: this.generateTsConfig(),
                },
                "README.md": {
                    type: "file" as const,
                    content: this.generateReadme(project),
                },
                ".gitignore": {
                    type: "file" as const,
                    content: this.generateGitignore("node"),
                },
                "jest.config.js": {
                    type: "file" as const,
                    content: this.generateJestConfig(),
                },
            },
        };

        const structure = structures[project.language as keyof typeof structures] || structures.python;
        project.structure = structure;

        // Create files and directories
        await this.createFileStructure(project.path, structure);

        // Initial commit
        const git = simpleGit(project.path);
        await git.add(".");
        await git.commit("Initial project structure");
    }

    private async createFileStructure(
        basePath: string,
        structure: FileStructure
    ) {
        for (const [name, node] of Object.entries(structure)) {
            const fullPath = path.join(basePath, name);

            if (node.type === "directory") {
                await fs.ensureDir(fullPath);
                if (node.children) {
                    await this.createFileStructure(fullPath, node.children);
                }
            } else if (node.type === "file" && node.content) {
                await fs.writeFile(fullPath, node.content);
            }
        }
    }

    private async generateCode(req: express.Request, res: express.Response) {
        try {
            const request: CodeGenerationRequest = req.body;
            const project = this.projects.get(request.sessionId);

            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            // Emit progress
            this.io.to(project.id).emit("generation:start", {
                projectId: project.id,
                stage: "analyzing",
            });

            // Generate code based on technical details
            const codeFiles = await this.generateCodeFiles(project, request);

            // Write files
            for (const file of codeFiles) {
                const filePath = path.join(project.path, file.path);
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeFile(filePath, file.content);

                this.io.to(project.id).emit("file:created", {
                    path: file.path,
                    size: file.content.length,
                });
            }

            // Generate tests
            const testFiles = await this.generateTestFiles(project, codeFiles);

            for (const file of testFiles) {
                const filePath = path.join(project.path, file.path);
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeFile(filePath, file.content);
            }

            // Update dependencies
            await this.updateDependencies(project);

            // Commit changes
            const git = simpleGit(project.path);
            await git.add(".");
            await git.commit("Implement core functionality based on research");

            this.io.to(project.id).emit("generation:complete", {
                projectId: project.id,
                filesCreated: codeFiles.length + testFiles.length,
            });

            res.json({
                success: true,
                filesCreated: codeFiles.length + testFiles.length,
                project,
            });
        } catch (error) {
            console.error("Error generating code:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    }

    private async generateCodeFiles(
        project: CodeProject,
        request: CodeGenerationRequest
    ): Promise<Array<{ path: string; content: string }>> {
        const files: Array<{ path: string; content: string }> = [];

        // Call Ollama service to generate code
        const ollamaUrl = `http://${
            process.env.OLLAMA_HOST || "ollama"
        }:11434/api/chat`;

        for (const detail of request.technicalDetails) {
            const prompt = this.createCodeGenerationPrompt(
                project.language,
                detail,
                request.architecture
            );

            try {
                const response = await axios.post(ollamaUrl, {
                    model: process.env.OLLAMA_MODEL || "mixtral:8x7b",
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are an expert software engineer. Generate clean, well-documented, production-quality code.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    stream: false,
                });

                const generatedCode = response.data.message.content;
                const parsedFiles = this.parseGeneratedCode(generatedCode);

                files.push(...parsedFiles);
            } catch (error) {
                console.error("Error calling Ollama:", error);
            }
        }

        return files;
    }

    private createCodeGenerationPrompt(
        language: string,
        technicalDetail: any,
        architecture: string
    ): string {
        return `
Language: ${language}
Architecture: ${architecture}

Technical Detail to Implement:
${JSON.stringify(technicalDetail, null, 2)}

Generate production-quality code that implements this technical detail.
Include:
1. Clean, modular code structure
2. Comprehensive error handling
3. Type annotations (if applicable)
4. Detailed documentation
5. Performance optimizations

Format your response as:
--- FILE: path/to/file.ext ---
<file content>
--- END FILE ---

You can generate multiple files if needed.
`;
    }

    private parseGeneratedCode(
        generatedCode: string
    ): Array<{ path: string; content: string }> {
        const files: Array<{ path: string; content: string }> = [];
        const fileRegex = /--- FILE: (.+?) ---\n([\s\S]+?)--- END FILE ---/g;

        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
            files.push({
                path: match[1].trim(),
                content: match[2].trim(),
            });
        }

        return files;
    }

    private async generateTestFiles(
        project: CodeProject,
        codeFiles: Array<{ path: string; content: string }>
    ): Promise<Array<{ path: string; content: string }>> {
        const testFiles: Array<{ path: string; content: string }> = [];

        for (const codeFile of codeFiles) {
            if (
                codeFile.path.includes("test") ||
                !codeFile.path.includes("src/")
            ) {
                continue;
            }

            const testContent = await this.generateTestForFile(
                project,
                codeFile
            );
            const testPath = this.getTestPath(codeFile.path, project.language);

            testFiles.push({
                path: testPath,
                content: testContent,
            });
        }

        return testFiles;
    }

    private async generateTestForFile(
        project: CodeProject,
        codeFile: { path: string; content: string }
    ): Promise<string> {
        const ollamaUrl = `http://${
            process.env.OLLAMA_HOST || "ollama"
        }:11434/api/chat`;

        const prompt = `
Generate comprehensive unit tests for the following code:

File: ${codeFile.path}
Language: ${project.language}
Test Framework: ${project.testFramework}

Code to test:
${codeFile.content}

Generate tests that:
1. Cover all functions and methods
2. Test edge cases
3. Include both positive and negative test cases
4. Aim for >80% code coverage
5. Follow testing best practices
`;

        try {
            const response = await axios.post(ollamaUrl, {
                model: process.env.OLLAMA_MODEL || "mixtral:8x7b",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are an expert in writing comprehensive unit tests.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                stream: false,
            });

            return response.data.message.content;
        } catch (error) {
            console.error("Error generating tests:", error);
            return this.getDefaultTestTemplate(project.language, codeFile.path);
        }
    }

    private async runTests(req: express.Request, res: express.Response) {
        try {
            const { projectId } = req.body;
            const project = this.projects.get(projectId);

            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            this.io
                .to(project.id)
                .emit("test:start", { projectId: project.id });

            const testCommand = this.getTestCommand(project.language);
            const { stdout, stderr } = await execAsync(testCommand, {
                cwd: project.path,
                env: { ...process.env, CI: "true" },
            });

            const testResult = this.parseTestResults(stdout, project.language);

            // If tests fail, attempt to fix them
            if (testResult.failed > 0) {
                await this.attemptTestFix(project, testResult);
            }

            this.io.to(project.id).emit("test:complete", {
                projectId: project.id,
                result: testResult,
            });

            res.json(testResult);
        } catch (error) {
            console.error("Error running tests:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    }

    private async attemptTestFix(project: CodeProject, testResult: TestResult) {
        for (const failedTest of testResult.details.filter(
            (t) => t.status === "failed"
        )) {
            // Get the failing test file
            const testFile = await this.findTestFile(project, failedTest.name);
            if (!testFile) continue;

            // Analyze the error and generate fix
            const fix = await this.generateTestFix(
                project,
                testFile,
                failedTest.error || "Unknown error"
            );

            if (fix) {
                await fs.writeFile(path.join(project.path, testFile), fix);

                // Commit the fix
                const git = simpleGit(project.path);
                await git.add(testFile);
                await git.commit(`Fix failing test: ${failedTest.name}`);
            }
        }
    }

    private async gitCommit(req: express.Request, res: express.Response) {
        try {
            const { projectId, message, files } = req.body;
            const project = this.projects.get(projectId);

            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            const git = simpleGit(project.path);

            if (files && files.length > 0) {
                await git.add(files);
            } else {
                await git.add(".");
            }

            const commit = await git.commit(message || "Update code");

            res.json({
                success: true,
                commit: commit.commit,
                summary: commit.summary,
            });
        } catch (error) {
            console.error("Error committing:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
        }
    }

    private async getProject(req: express.Request, res: express.Response) {
        const project = this.projects.get(req.params.id);

        if (!project) {
            const cached = await this.redis.get(`project:${req.params.id}`);
            if (cached) {
                return res.json(JSON.parse(cached));
            }
            return res.status(404).json({ error: "Project not found" });
        }

        res.json(project);
    }

    private async getProjectFiles(req: express.Request, res: express.Response) {
        const project = this.projects.get(req.params.id);

        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        const files = await this.readProjectFiles(project.path);
        res.json(files);
    }

    private async readProjectFiles(
        projectPath: string,
        relativePath: string = ""
    ): Promise<any[]> {
        const files = [];
        const items = await fs.readdir(path.join(projectPath, relativePath));

        for (const item of items) {
            if (
                item.startsWith(".") ||
                item === "node_modules" ||
                item === "__pycache__"
            ) {
                continue;
            }

            const itemPath = path.join(relativePath, item);
            const fullPath = path.join(projectPath, itemPath);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                const children = await this.readProjectFiles(
                    projectPath,
                    itemPath
                );
                files.push({
                    name: item,
                    path: itemPath,
                    type: "directory",
                    children,
                });
            } else {
                const content = await fs.readFile(fullPath, "utf-8");
                files.push({
                    name: item,
                    path: itemPath,
                    type: "file",
                    content,
                    size: stat.size,
                });
            }
        }

        return files;
    }

    // Helper methods
    private getTestFramework(language: string): string {
        const frameworks: Record<string, string> = {
            python: "pytest",
            javascript: "jest",
            typescript: "jest",
            java: "junit",
            csharp: "xunit",
            go: "testing",
        };
        return frameworks[language] || "generic";
    }

    private getTestCommand(language: string): string {
        const commands: Record<string, string> = {
            python: "pytest --cov=src --cov-report=json tests/",
            javascript: "jest --coverage --json",
            typescript: "jest --coverage --json",
            java: "mvn test",
            go: "go test -v ./...",
        };
        return commands[language] || 'echo "No test command configured"';
    }

    private getTestPath(codePath: string, language: string): string {
        const testDir = "tests";
        const filename = path.basename(codePath);
        const nameWithoutExt = filename.split(".")[0];

        const extensions: Record<string, string> = {
            python: "_test.py",
            javascript: ".test.js",
            typescript: ".test.ts",
            java: "Test.java",
            go: "_test.go",
        };

        const ext = extensions[language] || ".test";
        return path.join(testDir, `${nameWithoutExt}${ext}`);
    }

    private parseTestResults(output: string, language: string): TestResult {
        // Simplified parsing - in production, use proper parsers
        const result: TestResult = {
            passed: 0,
            failed: 0,
            skipped: 0,
            coverage: {
                lines: 0,
                functions: 0,
                branches: 0,
            },
            details: [],
        };

        // Parse based on language/framework
        if (language === "python") {
            // Parse pytest output
            const passMatch = output.match(/(\d+) passed/);
            const failMatch = output.match(/(\d+) failed/);
            const skipMatch = output.match(/(\d+) skipped/);

            if (passMatch) result.passed = parseInt(passMatch[1]);
            if (failMatch) result.failed = parseInt(failMatch[1]);
            if (skipMatch) result.skipped = parseInt(skipMatch[1]);
        }

        return result;
    }

    private async findTestFile(
        project: CodeProject,
        testName: string
    ): Promise<string | null> {
        // Search for test file containing the failed test
        const testFiles = await this.findFiles(
            project.path,
            /\.(test|spec)\.(js|ts|py)$/
        );

        for (const file of testFiles) {
            const content = await fs.readFile(file, "utf-8");
            if (content.includes(testName)) {
                return path.relative(project.path, file);
            }
        }

        return null;
    }

    private async findFiles(dir: string, pattern: RegExp): Promise<string[]> {
        const files: string[] = [];
        const items = await fs.readdir(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);

            if (
                stat.isDirectory() &&
                !item.startsWith(".") &&
                item !== "node_modules"
            ) {
                const subFiles = await this.findFiles(fullPath, pattern);
                files.push(...subFiles);
            } else if (stat.isFile() && pattern.test(item)) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private async generateTestFix(
        project: CodeProject,
        testFile: string,
        error: string
    ): Promise<string | null> {
        // Call Ollama to fix the test
        const ollamaUrl = `http://${
            process.env.OLLAMA_HOST || "ollama"
        }:11434/api/chat`;
        const content = await fs.readFile(
            path.join(project.path, testFile),
            "utf-8"
        );

        const prompt = `
Fix the failing test:

Test file: ${testFile}
Language: ${project.language}
Error: ${error}

Current test code:
${content}

Generate the fixed test code that resolves the error.
`;

        try {
            const response = await axios.post(ollamaUrl, {
                model: process.env.OLLAMA_MODEL || "mixtral:8x7b",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert at fixing failing tests.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                stream: false,
            });

            return response.data.message.content;
        } catch (error) {
            console.error("Error generating test fix:", error);
            return null;
        }
    }

    // Template generators
    private generateSetupPy(project: CodeProject): string {
        return `from setuptools import setup, find_packages

setup(
    name="${project.name}",
    version="0.1.0",
    author="Research Bot",
    author_email="bot@research.local",
    description="Auto-generated research project",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.8",
    install_requires=[
        # Dependencies will be added here
    ],
    extras_require={
        "dev": [
            "pytest>=6.2.0",
            "pytest-cov>=2.12.0",
            "black>=21.6b0",
            "flake8>=3.9.0",
        ]
    }
)`;
    }

    private generatePackageJson(project: CodeProject): string {
        const pkg = {
            name: project.name,
            version: "0.1.0",
            description: "Auto-generated research project",
            main:
                project.language === "typescript"
                    ? "dist/index.js"
                    : "src/index.js",
            scripts: {
                test: "jest",
                "test:coverage": "jest --coverage",
                build:
                    project.language === "typescript"
                        ? "tsc"
                        : "echo 'No build required'",
                lint: "eslint src/",
                dev: "nodemon src/index.js",
            },
            dependencies: {},
            devDependencies: {
                jest: "^27.0.0",
                eslint: "^7.32.0",
                nodemon: "^2.0.0",
            } as Record<string, string>,
        };

        if (project.language === "typescript") {
            pkg.devDependencies["typescript"] = "^4.5.0";
            pkg.devDependencies["@types/node"] = "^16.0.0";
            pkg.devDependencies["@types/jest"] = "^27.0.0";
            pkg.devDependencies["ts-jest"] = "^27.0.0";
        }

        return JSON.stringify(pkg, null, 2);
    }

    private generateTsConfig(): string {
        return JSON.stringify(
            {
                compilerOptions: {
                    target: "ES2020",
                    module: "commonjs",
                    lib: ["ES2020"],
                    outDir: "./dist",
                    rootDir: "./src",
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    forceConsistentCasingInFileNames: true,
                    resolveJsonModule: true,
                    declaration: true,
                    declarationMap: true,
                    sourceMap: true,
                },
                include: ["src/**/*"],
                exclude: ["node_modules", "dist", "tests"],
            },
            null,
            2
        );
    }

    private generateJestConfig(): string {
        return `module.exports = {
  preset: '${
      this.projects.values().next().value?.language === "typescript"
          ? "ts-jest"
          : ""
  }',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.${
      this.projects.values().next().value?.language === "typescript"
          ? "ts"
          : "js"
  }'],
  collectCoverageFrom: [
    'src/**/*.${
        this.projects.values().next().value?.language === "typescript"
            ? "ts"
            : "js"
    }',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};`;
    }

    private generateReadme(project: CodeProject): string {
        return `# ${project.name}

Auto-generated research project.

## Overview

This project was automatically generated based on research findings.

## Installation

### Python
\`\`\`bash
pip install -r requirements.txt
pip install -e .
\`\`\`

### Node.js
\`\`\`bash
npm install
\`\`\`

## Usage

[Usage instructions will be added here]

## Testing

### Python
\`\`\`bash
pytest
\`\`\`

### Node.js
\`\`\`bash
npm test
\`\`\`

## Project Structure

\`\`\`
${project.name}/
├── src/           # Source code
├── tests/         # Unit tests
├── docs/          # Documentation
└── README.md      # This file
\`\`\`

## License

This project is auto-generated for research purposes.
`;
    }

    private generateGitignore(type: string): string {
        const python = `
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.env
.venv
pip-log.txt
pip-delete-this-directory.txt
.pytest_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/
`;

        const node = `
# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
coverage/
.nyc_output/
dist/
build/
`;

        const common = `
# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
`;

        return type === "python" ? python + common : node + common;
    }

    private async updateDependencies(project: CodeProject): Promise<void> {
        try {
            if (project.language === "python") {
                // Update requirements.txt if it exists
                const requirementsPath = path.join(project.path, "requirements.txt");
                if (await fs.pathExists(requirementsPath)) {
                    // Install dependencies
                    await execAsync("pip install -r requirements.txt", {
                        cwd: project.path
                    });
                }
            } else if (project.language === "javascript" || project.language === "typescript") {
                // Update package.json dependencies
                const packageJsonPath = path.join(project.path, "package.json");
                if (await fs.pathExists(packageJsonPath)) {
                    // Install dependencies
                    await execAsync("npm install", {
                        cwd: project.path
                    });
                }
            }
        } catch (error) {
            console.error("Error updating dependencies:", error);
            // Don't throw - dependencies update failure shouldn't stop code generation
        }
    }

    private getDefaultTestTemplate(language: string, filePath: string): string {
        const templates: Record<string, string> = {
            python: `import pytest
from ${filePath.replace(".py", "").replace("src/", "")} import *

class TestGenerated:
    def test_placeholder(self):
        """Placeholder test - implement actual tests"""
        assert True
`,
            javascript: `const { } = require('${filePath.replace(".js", "")}');

describe('Generated Tests', () => {
  test('placeholder test', () => {
    expect(true).toBe(true);
  });
});
`,
            typescript: `import { } from '${filePath.replace(".ts", "")}';

describe('Generated Tests', () => {
  test('placeholder test', () => {
    expect(true).toBe(true);
  });
});
`,
        };

        return templates[language] || "// TODO: Implement tests";
    }

    public start(port: number = 8080) {
        this.server.listen(port, () => {
            console.log(`Code Developer Service running on port ${port}`);
        });
    }
}

// Start the service
const service = new CodeDeveloperService();
service.start(parseInt(process.env.PORT || "8080"));

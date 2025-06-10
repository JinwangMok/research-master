// desktop-app/src/App.tsx

import React, { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
    Box,
    Container,
    Typography,
    TextField,
    Button,
    Stepper,
    Step,
    StepLabel,
    Paper,
    LinearProgress,
    Card,
    CardContent,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Divider,
    Grid,
    Tabs,
    Tab,
    CircularProgress,
    Snackbar,
} from "@mui/material";
import {
    Send,
    PlayArrow,
    Download,
    CheckCircle,
    Error as ErrorIcon,
    Code,
    Description,
    Slideshow,
    BugReport,
    GitHub,
} from "@mui/icons-material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Theme
const darkTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#2196f3",
        },
        secondary: {
            main: "#f50057",
        },
        background: {
            default: "#121212",
            paper: "#1e1e1e",
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
});

// Types
interface ResearchSession {
    id: string;
    topic: string;
    stage: ResearchStage;
    clarifications: string[];
    createdAt: Date;
}

enum ResearchStage {
    INITIAL = "initial",
    CLARIFICATION = "clarification",
    RESEARCH = "research",
    DEVELOPMENT = "development",
    TESTING = "testing",
    DOCUMENTATION = "documentation",
    COMPLETED = "completed",
}

interface WorkflowProgress {
    stage: ResearchStage;
    status: "pending" | "in_progress" | "completed" | "failed";
    progress: number;
}

interface ClarificationQuestion {
    question: string;
    answer?: string;
}

interface ResearchResults {
    synthesis: string;
    gaps: string[];
    proposedApproach: string;
    papers?: any[];
    technicalDetails?: any[];
}

interface DevelopmentStatus {
    status: string;
    progress: number;
    filesCreated: number;
    coverage: number;
    lastCommit?: string;
}

interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    coverage: {
        lines: number;
        functions: number;
        branches: number;
    };
}

interface Document {
    type: string;
    format: string;
    filename: string;
}

// Main App Component
const App: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [session, setSession] = useState<ResearchSession | null>(null);
    const [topic, setTopic] = useState("");
    const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answer, setAnswer] = useState("");
    const [workflowProgress, setWorkflowProgress] = useState<
        WorkflowProgress[]
    >([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [researchResults, setResearchResults] =
        useState<ResearchResults | null>(null);
    const [developmentStatus, setDevelopmentStatus] =
        useState<DevelopmentStatus | null>(null);
    const [testResults, setTestResults] = useState<TestResults | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const [feedbackDialog, setFeedbackDialog] = useState(false);
    const [feedback, setFeedback] = useState("");

    // Connect to MCP server
    useEffect(() => {
        const socketInstance = io("http://localhost:3001", {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketInstance.on("connect", () => {
            setConnected(true);
            addLog("Connected to MCP server");
        });

        socketInstance.on("disconnect", () => {
            setConnected(false);
            addLog("Disconnected from MCP server");
        });

        socketInstance.on("session:created", (newSession: ResearchSession) => {
            setSession(newSession);
            addLog(`Session created: ${newSession.id}`);
        });

        socketInstance.on("research:progress", (data: any) => {
            if (data.questions) {
                setQuestions(
                    data.questions.map((q: string) => ({ question: q }))
                );
                setCurrentQuestionIndex(0);
            }
            updateWorkflowProgress(data.stage, "in_progress", 50);
        });

        socketInstance.on("research:completed", (results: ResearchResults) => {
            setResearchResults(results);
            updateWorkflowProgress(ResearchStage.RESEARCH, "completed", 100);
            addLog("Research phase completed");
        });

        socketInstance.on("workflow:progress", (data: any) => {
            updateWorkflowProgress(data.stage, data.status, data.progress);
        });

        socketInstance.on("generation:start", () => {
            addLog("Code generation started");
        });

        socketInstance.on("file:created", (data: any) => {
            addLog(`File created: ${data.path}`);
        });

        socketInstance.on("test:start", () => {
            addLog("Running tests...");
        });

        socketInstance.on("test:complete", (data: any) => {
            setTestResults(data.result);
            addLog(
                `Tests completed: ${data.result.passed}/${data.result.total} passed`
            );
        });

        socketInstance.on("mcp:error", (errorData: any) => {
            setError(errorData.error || "An error occurred");
            setLoading(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const addLog = useCallback((message: string) => {
        setLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] ${message}`,
        ]);
    }, []);

    const updateWorkflowProgress = useCallback(
        (
            stage: ResearchStage,
            status: WorkflowProgress["status"],
            progress: number
        ) => {
            setWorkflowProgress((prev) => {
                const updated = [...prev];
                const index = updated.findIndex((p) => p.stage === stage);
                if (index >= 0) {
                    updated[index] = { stage, status, progress };
                } else {
                    updated.push({ stage, status, progress });
                }
                return updated;
            });
        },
        []
    );

    const handleStartResearch = async () => {
        if (!topic.trim() || !socket) return;

        setLoading(true);
        setError(null);

        try {
            // Create session
            socket.emit("session:create", { topic });

            // Wait for session creation
            socket.once(
                "session:created",
                async (newSession: ResearchSession) => {
                    // Start research
                    socket.emit("mcp:request", {
                        id: Date.now().toString(),
                        type: "request",
                        method: "research.start",
                        params: {
                            sessionId: newSession.id,
                            topic: topic.trim(),
                        },
                    });
                }
            );
        } catch (err) {
            setError("Failed to start research");
            setLoading(false);
        }
    };

    const handleAnswerQuestion = () => {
        if (!answer.trim() || !socket || !session) return;

        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex].answer = answer;
        setQuestions(updatedQuestions);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setAnswer("");
        } else {
            // All questions answered, send clarifications
            const answers = updatedQuestions.map((q) => q.answer || "");

            socket.emit("mcp:request", {
                id: Date.now().toString(),
                type: "request",
                method: "research.clarify",
                params: {
                    sessionId: session.id,
                    answers,
                },
            });

            socket.once("mcp:response", (response: any) => {
                if (response.result?.needsMoreClarification) {
                    // More questions
                    setQuestions(
                        response.result.questions.map((q: string) => ({
                            question: q,
                        }))
                    );
                    setCurrentQuestionIndex(0);
                    setAnswer("");
                } else {
                    // Research started
                    addLog("Autonomous research started");
                    updateWorkflowProgress(
                        ResearchStage.RESEARCH,
                        "in_progress",
                        10
                    );
                }
            });
        }
    };

    const handleApproveResearch = (approved: boolean) => {
        if (!socket || !session) return;

        if (!approved) {
            setFeedbackDialog(true);
            return;
        }

        socket.emit("mcp:request", {
            id: Date.now().toString(),
            type: "request",
            method: "research.approve",
            params: {
                sessionId: session.id,
                approved: true,
            },
        });

        socket.once("mcp:response", () => {
            addLog("Research approved, starting development");
            updateWorkflowProgress(
                ResearchStage.DEVELOPMENT,
                "in_progress",
                10
            );
        });
    };

    const handleFeedbackSubmit = () => {
        if (!socket || !session || !feedback.trim()) return;

        socket.emit("mcp:request", {
            id: Date.now().toString(),
            type: "request",
            method: "research.approve",
            params: {
                sessionId: session.id,
                approved: false,
                feedback: feedback.trim(),
            },
        });

        setFeedbackDialog(false);
        setFeedback("");
        addLog("Refining research based on feedback");
    };

    const handleGenerateDocuments = async (
        format: "pdf" | "latex" | "pptx"
    ) => {
        if (!socket || !session) return;

        setLoading(true);

        socket.emit("mcp:request", {
            id: Date.now().toString(),
            type: "request",
            method: "documentation.generate",
            params: {
                sessionId: session.id,
                format,
                template: "ieee",
            },
        });

        socket.once("mcp:response", (response: any) => {
            if (response.result?.documents) {
                setDocuments(response.result.documents);
            }
            setLoading(false);
            addLog(`${format.toUpperCase()} document generated`);
        });
    };

    const getActiveStep = () => {
        const stages = Object.values(ResearchStage);
        return stages.indexOf(session?.stage || ResearchStage.INITIAL);
    };

    const getStageIcon = (stage: ResearchStage) => {
        switch (stage) {
            case ResearchStage.INITIAL:
                return <Send />;
            case ResearchStage.CLARIFICATION:
                return <Description />;
            case ResearchStage.RESEARCH:
                return <Description />;
            case ResearchStage.DEVELOPMENT:
                return <Code />;
            case ResearchStage.TESTING:
                return <BugReport />;
            case ResearchStage.DOCUMENTATION:
                return <Slideshow />;
            case ResearchStage.COMPLETED:
                return <CheckCircle />;
            default:
                return null;
        }
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Container maxWidth="xl" sx={{ py: 4 }}>
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h3" gutterBottom>
                        Autonomous Research & Development System
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Chip
                            label={connected ? "Connected" : "Disconnected"}
                            color={connected ? "success" : "error"}
                            size="small"
                        />
                        {session && (
                            <Chip
                                label={`Session: ${session.id.substring(
                                    0,
                                    8
                                )}...`}
                                size="small"
                            />
                        )}
                    </Box>
                </Box>

                {/* Workflow Stepper */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stepper activeStep={getActiveStep()} alternativeLabel>
                        {Object.values(ResearchStage).map((stage) => {
                            const progress = workflowProgress.find(
                                (p) => p.stage === stage
                            );
                            return (
                                <Step
                                    key={stage}
                                    completed={progress?.status === "completed"}
                                >
                                    <StepLabel
                                        error={progress?.status === "failed"}
                                        icon={getStageIcon(stage)}
                                    >
                                        {stage.charAt(0).toUpperCase() +
                                            stage.slice(1)}
                                        {progress?.status === "in_progress" && (
                                            <LinearProgress
                                                variant="determinate"
                                                value={progress.progress}
                                                sx={{ mt: 1 }}
                                            />
                                        )}
                                    </StepLabel>
                                </Step>
                            );
                        })}
                    </Stepper>
                </Paper>

                {/* Main Content */}
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        {/* Input Section */}
                        {!session && (
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h5" gutterBottom>
                                        Start New Research
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        label="Research Topic"
                                        value={topic}
                                        onChange={(e) =>
                                            setTopic(e.target.value)
                                        }
                                        placeholder="e.g., Quantum-resistant cryptography for IoT devices"
                                        sx={{ mb: 2 }}
                                    />
                                    <Button
                                        variant="contained"
                                        startIcon={<PlayArrow />}
                                        onClick={handleStartResearch}
                                        disabled={
                                            !topic.trim() ||
                                            loading ||
                                            !connected
                                        }
                                        fullWidth
                                    >
                                        Start Research
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Clarification Questions */}
                        {questions.length > 0 &&
                            currentQuestionIndex < questions.length && (
                                <Card sx={{ mb: 3 }}>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Clarification Question{" "}
                                            {currentQuestionIndex + 1} of{" "}
                                            {questions.length}
                                        </Typography>
                                        <Typography variant="body1" paragraph>
                                            {
                                                questions[currentQuestionIndex]
                                                    .question
                                            }
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={3}
                                            value={answer}
                                            onChange={(e) =>
                                                setAnswer(e.target.value)
                                            }
                                            placeholder="Type your answer here..."
                                            sx={{ mb: 2 }}
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={handleAnswerQuestion}
                                            disabled={!answer.trim()}
                                        >
                                            Next
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                        {/* Content Tabs */}
                        <Paper sx={{ mb: 3 }}>
                            <Tabs
                                value={tabValue}
                                onChange={(e, v) => setTabValue(v)}
                            >
                                <Tab label="Overview" />
                                <Tab
                                    label="Research Results"
                                    disabled={!researchResults}
                                />
                                <Tab
                                    label="Development"
                                    disabled={!developmentStatus}
                                />
                                <Tab label="Testing" disabled={!testResults} />
                                <Tab
                                    label="Documents"
                                    disabled={documents.length === 0}
                                />
                            </Tabs>

                            <Box sx={{ p: 3 }}>
                                {/* Overview Tab */}
                                {tabValue === 0 && (
                                    <Box>
                                        {session && (
                                            <Box>
                                                <Typography
                                                    variant="h6"
                                                    gutterBottom
                                                >
                                                    Research Topic
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    paragraph
                                                >
                                                    {session.topic}
                                                </Typography>

                                                {session.clarifications.length >
                                                    0 && (
                                                    <>
                                                        <Typography
                                                            variant="h6"
                                                            gutterBottom
                                                        >
                                                            Clarifications
                                                        </Typography>
                                                        <List>
                                                            {session.clarifications.map(
                                                                (
                                                                    clarification,
                                                                    index
                                                                ) => (
                                                                    <ListItem
                                                                        key={
                                                                            index
                                                                        }
                                                                    >
                                                                        <ListItemText
                                                                            primary={
                                                                                clarification
                                                                            }
                                                                        />
                                                                    </ListItem>
                                                                )
                                                            )}
                                                        </List>
                                                    </>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* Research Results Tab */}
                                {tabValue === 1 && researchResults && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Research Synthesis
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            {researchResults.synthesis}
                                        </Typography>

                                        <Typography
                                            variant="h6"
                                            gutterBottom
                                            sx={{ mt: 3 }}
                                        >
                                            Identified Gaps
                                        </Typography>
                                        <List>
                                            {researchResults.gaps.map(
                                                (
                                                    gap: string,
                                                    index: number
                                                ) => (
                                                    <ListItem key={index}>
                                                        <ListItemText
                                                            primary={gap}
                                                        />
                                                    </ListItem>
                                                )
                                            )}
                                        </List>

                                        <Typography
                                            variant="h6"
                                            gutterBottom
                                            sx={{ mt: 3 }}
                                        >
                                            Proposed Approach
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            {researchResults.proposedApproach}
                                        </Typography>

                                        <Box
                                            sx={{
                                                mt: 3,
                                                display: "flex",
                                                gap: 2,
                                            }}
                                        >
                                            <Button
                                                variant="contained"
                                                color="success"
                                                onClick={() =>
                                                    handleApproveResearch(true)
                                                }
                                            >
                                                Approve & Continue
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="warning"
                                                onClick={() =>
                                                    handleApproveResearch(false)
                                                }
                                            >
                                                Request Changes
                                            </Button>
                                        </Box>
                                    </Box>
                                )}

                                {/* Development Tab */}
                                {tabValue === 2 && developmentStatus && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Development Progress
                                        </Typography>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="body2">
                                                Status:{" "}
                                                {developmentStatus.status}
                                            </Typography>
                                            <LinearProgress
                                                variant="determinate"
                                                value={
                                                    developmentStatus.progress
                                                }
                                                sx={{ mt: 1 }}
                                            />
                                        </Box>

                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Typography variant="body2">
                                                    Files Created:{" "}
                                                    {
                                                        developmentStatus.filesCreated
                                                    }
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2">
                                                    Test Coverage:{" "}
                                                    {developmentStatus.coverage}
                                                    %
                                                </Typography>
                                            </Grid>
                                        </Grid>

                                        {developmentStatus.lastCommit && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="body2">
                                                    <GitHub
                                                        sx={{
                                                            fontSize: 16,
                                                            mr: 1,
                                                        }}
                                                    />
                                                    Last Commit:{" "}
                                                    {
                                                        developmentStatus.lastCommit
                                                    }
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* Testing Tab */}
                                {tabValue === 3 && testResults && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Test Results
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={3}>
                                                <Card>
                                                    <CardContent>
                                                        <Typography variant="h4">
                                                            {testResults.passed}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Passed
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Card>
                                                    <CardContent>
                                                        <Typography
                                                            variant="h4"
                                                            color="error"
                                                        >
                                                            {testResults.failed}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Failed
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Card>
                                                    <CardContent>
                                                        <Typography variant="h4">
                                                            {
                                                                testResults.skipped
                                                            }
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Skipped
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Card>
                                                    <CardContent>
                                                        <Typography variant="h4">
                                                            {
                                                                testResults
                                                                    .coverage
                                                                    .lines
                                                            }
                                                            %
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Coverage
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                )}

                                {/* Documents Tab */}
                                {tabValue === 4 && documents.length > 0 && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Generated Documents
                                        </Typography>
                                        <List>
                                            {documents.map((doc, index) => (
                                                <ListItem
                                                    key={index}
                                                    secondaryAction={
                                                        <IconButton
                                                            href={`http://localhost:5001/download/${doc.filename}`}
                                                        >
                                                            <Download />
                                                        </IconButton>
                                                    }
                                                >
                                                    <ListItemText
                                                        primary={doc.filename}
                                                        secondary={`Type: ${doc.type} | Format: ${doc.format}`}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>

                                        <Box
                                            sx={{
                                                mt: 3,
                                                display: "flex",
                                                gap: 2,
                                            }}
                                        >
                                            <Button
                                                variant="outlined"
                                                startIcon={<Description />}
                                                onClick={() =>
                                                    handleGenerateDocuments(
                                                        "pdf"
                                                    )
                                                }
                                                disabled={loading}
                                            >
                                                Generate PDF Report
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Code />}
                                                onClick={() =>
                                                    handleGenerateDocuments(
                                                        "latex"
                                                    )
                                                }
                                                disabled={loading}
                                            >
                                                Generate LaTeX Paper
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Slideshow />}
                                                onClick={() =>
                                                    handleGenerateDocuments(
                                                        "pptx"
                                                    )
                                                }
                                                disabled={loading}
                                            >
                                                Generate Presentation
                                            </Button>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Logs Section */}
                    <Grid item xs={12} md={4}>
                        <Paper
                            sx={{ p: 2, height: "600px", overflow: "hidden" }}
                        >
                            <Typography variant="h6" gutterBottom>
                                Activity Log
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Box
                                sx={{
                                    height: "calc(100% - 60px)",
                                    overflow: "auto",
                                    fontFamily: "monospace",
                                    fontSize: "0.875rem",
                                }}
                            >
                                {logs.map((log, index) => (
                                    <Box key={index} sx={{ mb: 0.5 }}>
                                        {log}
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Feedback Dialog */}
                <Dialog
                    open={feedbackDialog}
                    onClose={() => setFeedbackDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Provide Feedback</DialogTitle>
                    <DialogContent>
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="What changes would you like to see in the research?"
                            sx={{ mt: 2 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setFeedbackDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleFeedbackSubmit}
                            variant="contained"
                            disabled={!feedback.trim()}
                        >
                            Submit Feedback
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Error Snackbar */}
                <Snackbar
                    open={!!error}
                    autoHideDuration={6000}
                    onClose={() => setError(null)}
                    message={error}
                />

                {/* Loading Overlay */}
                {loading && (
                    <Box
                        sx={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: "rgba(0,0,0,0.7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 9999,
                        }}
                    >
                        <CircularProgress size={60} />
                    </Box>
                )}
            </Container>
        </ThemeProvider>
    );
};

export default App;

# 🚀 Autonomous Research & Development System

An AI-powered system that autonomously conducts research, develops code, runs experiments, and generates academic documentation based on user-provided topics.

## 🌟 Features

-   **Autonomous Research**: Automatically searches and analyzes academic papers from multiple sources
-   **Intelligent Clarification**: Asks targeted questions to better understand research requirements
-   **Code Development**: Generates production-quality code with tests and documentation
-   **Automated Testing**: Runs tests and fixes issues automatically
-   **Document Generation**: Creates PDF reports, LaTeX papers, and PowerPoint presentations
-   **GPU Optimization**: Efficiently uses 8GB GPU memory with model quantization
-   **Real-time Progress**: Monitor all stages of the research and development process

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Desktop Application                      │
│                    (Electron + React)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ MCP Protocol
┌──────────────────────┴──────────────────────────────────────┐
│                    MCP Server (Node.js)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                   Docker Services                            │
├──────────────────────────────────────────────────────────────┤
│  Ollama  │  Research  │   Code    │  Testing  │  Document   │
│   LLM    │  Crawler   │ Developer │  Runner   │ Generator   │
└──────────┴────────────┴───────────┴───────────┴─────────────┘
```

## 📋 Prerequisites

-   Docker & Docker Compose
-   Node.js 18+ & npm
-   Git
-   8GB+ GPU (NVIDIA with CUDA support recommended)
-   16GB+ RAM
-   50GB+ free disk space

### Optional

-   Google Scholar API key
-   IEEE Xplore API key

## 🛠️ Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/autonomous-research-system.git
    cd autonomous-research-system
    ```

2. **Run setup script**

    ```bash
    chmod +x scripts/*.sh
    ./scripts/setup.sh
    ```

3. **Configure environment**

    ```bash
    cp .env.example .env
    # Edit .env with your API keys
    ```

4. **Start the system**
    ```bash
    ./scripts/start.sh
    ```

## 🎯 Usage

### Starting a New Research Project

1. **Launch the desktop application**

    - The app will open automatically when you run `./scripts/start.sh`
    - Or manually run: `cd desktop-app && npm run electron-dev`

2. **Enter your research topic**

    - Be specific about your research area
    - Example: "Quantum-resistant cryptography for IoT devices"

3. **Answer clarification questions**

    - The system will ask 2-3 questions to better understand your requirements
    - Provide detailed answers for better results

4. **Review research findings**

    - The system will present synthesized research findings
    - You can approve or request changes

5. **Monitor development**

    - Watch as the system generates code
    - View real-time test results
    - Track progress through all stages

6. **Generate documentation**
    - Export as PDF report
    - Generate LaTeX paper (IEEE format)
    - Create PowerPoint presentation

### Workflow Stages

1. **Initial** - Topic submission
2. **Clarification** - Answering system questions
3. **Research** - Autonomous paper analysis
4. **Development** - Code generation
5. **Testing** - Automated testing and fixes
6. **Documentation** - Report/paper/presentation generation
7. **Completed** - All deliverables ready

## 🔧 Configuration

### Ollama Models

The system uses Mixtral 8x7B by default (quantized for 8GB GPU). You can change this in `.env`:

```bash
# For better performance on smaller GPUs:
OLLAMA_MODEL=llama2:7b-chat-q4_K_M

# For code-focused tasks:
OLLAMA_MODEL=codellama:13b-instruct-q4_K_M
```

### Service Ports

Default ports (changeable in `.env`):

-   MCP Server: 3000
-   Research Crawler: 5000
-   Code Developer: 8080
-   Document Generator: 5001
-   Redis: 6379
-   Ollama: 11434

## 📁 Project Structure

```
autonomous-research-system/
├── mcp-server/          # Main MCP server
├── research-crawler/    # Academic paper crawler
├── code-developer/      # Code generation service
├── doc-generator/       # Document generation service
├── desktop-app/         # Electron + React frontend
├── workspace/           # Generated projects
├── documents/           # Generated documents
├── logs/                # System logs
├── templates/           # Document templates
├── scripts/             # Utility scripts
└── docker-compose.yml   # Service orchestration
```

## 🚀 Advanced Usage

### Using Custom Templates

1. Add LaTeX templates to `templates/` directory
2. Name format: `{name}_template.tex`
3. Select template when generating papers

### Monitoring Services

```bash
# View all logs
./scripts/logs.sh

# View specific service logs
./scripts/logs.sh mcp-server

# Check service health
docker-compose ps
```

### Scaling Services

For larger workloads, you can scale certain services:

```bash
docker-compose up -d --scale research-crawler=3
```

## 🐛 Troubleshooting

### GPU Not Detected

```bash
# Check NVIDIA drivers
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Service Connection Issues

```bash
# Restart services
./scripts/stop.sh
./scripts/start.sh

# Check service logs
./scripts/logs.sh [service-name]
```

### Out of Memory Errors

-   Reduce Ollama model size in `.env`
-   Increase Docker memory limits
-   Use quantized models (q4_K_M)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

-   Ollama for local LLM inference
-   Docker for containerization
-   Electron for cross-platform desktop apps
-   All the open-source libraries used in this project

## 📞 Support

-   Create an issue for bug reports
-   Start a discussion for feature requests
-   Check the wiki for detailed documentation

---

**Note**: This system is designed for research and educational purposes. Always verify generated code and documentation before use in production environments.

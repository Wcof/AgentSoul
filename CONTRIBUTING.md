# Contributing to AgentSoul

Thank you for your interest in contributing to AgentSoul! We welcome contributions from everyone.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [issue tracker](https://github.com/yourusername/agentsoul/issues) to avoid duplicates.

When you create a bug report, please include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Your environment (OS, Python/Node.js versions, etc.)
- Any relevant logs or error messages

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:

- Use a clear and descriptive title
- Provide a detailed description of the proposed functionality
- Explain why this enhancement would be useful
- Optionally, include examples of how it would work

### Code Contributions

#### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher (for MCP server)

#### Setting Up Development Environment

1. Fork and clone the repository:
```bash
git clone https://github.com/yourusername/agentsoul.git
cd agentsoul
```

2. Set up Python environment:
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or
.venv\Scripts\activate  # Windows

pip install -e ".[dev]"
```

3. Set up MCP server:
```bash
cd mcp_server
npm install
npm run build
```

4. Run tests:
```bash
# Python tests
python -m pytest tests/ -v

# Python tests with coverage
python -m pytest tests/ --cov=src --cov-report=html
```

#### Code Style

We use:
- **Black** for Python code formatting
- **Ruff** for Python linting
- **TypeScript** with strict mode for MCP server
- **Prettier** (optional) for TypeScript formatting

Before submitting code:
```bash
# Format Python code
black src/ tests/ scripts/ integrations/openclaw/ common/

# Lint Python code
ruff check src/ tests/ scripts/ integrations/openclaw/ common/

# Type check Python code
mypy src/ tests/ scripts/ integrations/openclaw/ common/
```

#### Commit Messages

Please use clear and descriptive commit messages:

```
<type>(<scope>): <subject>

<description>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Refactoring code
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Example:
```
feat(memory): add topic memory archiving

- Implement archive_memory_topic MCP tool
- Add tests for archiving functionality
- Update documentation

Closes #123
```

#### Pull Request Process

1. Update the README.md or relevant documentation with details of changes.
2. Update the CHANGELOG.md with a note of your changes.
3. Ensure the test suite passes.
4. Submit your pull request with a clear description.

## Getting Help

If you have questions or need help, please:

- Check the [README](README.md)
- Check existing [issues](https://github.com/yourusername/agentsoul/issues)
- Open a new issue with the `question` label

## License

By contributing to AgentSoul, you agree that your contributions will be licensed under the MIT License.

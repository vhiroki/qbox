# Testing Instructions

applyTo: backend/tests/**

## Running Tests

```bash
cd backend
pytest                                # Run all tests (requires Docker for integration tests)
pytest tests/integration/             # Run integration tests only
pytest tests/test_specific.py         # Run specific test file
pytest -k test_name                   # Run tests matching pattern
pytest --cov=app --cov-report=term-missing  # Run with coverage
```

## Test Infrastructure

- Tests use testcontainers for PostgreSQL and LocalStack (S3)
- Docker Desktop must be running for integration tests
- All tests run in both local development and CI
- Fixtures provide isolated databases and mocked services per test

## Guidelines

- Write tests for new functionality
- Use pytest fixtures for test setup
- Integration tests should use testcontainers
- Mock external services appropriately
- Keep tests focused and isolated
- Use descriptive test names

## Test Structure

- `backend/tests/` - Test directory root
- `backend/tests/conftest.py` - Shared fixtures
- `backend/tests/integration/` - Integration tests (require Docker)

## Important Notes

- **DO NOT** run tests after making changes - the user will test independently
- Focus on making code changes, not running test commands
- Tests require Docker Desktop to be running for integration tests

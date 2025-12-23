"""Shared pytest fixtures for QBox backend tests."""

import os
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

# Set test mode before importing app modules
os.environ["QBOX_TEST_MODE"] = "true"


@pytest.fixture
def test_data_dir(tmp_path: Path) -> Path:
    """Create an isolated data directory for each test.

    This prevents tests from interfering with the user's actual ~/.qbox data
    and ensures clean state for each test.
    """
    data_dir = tmp_path / ".qbox"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


@pytest.fixture
def test_db_path(test_data_dir: Path) -> Path:
    """Get the path for the test SQLite database."""
    return test_data_dir / "connections.db"


@pytest.fixture
def test_duckdb_path(test_data_dir: Path) -> Path:
    """Get the path for the test DuckDB database."""
    return test_data_dir / "test.duckdb"


@pytest.fixture
def test_files_dir(test_data_dir: Path) -> Path:
    """Create a test files directory for uploaded files."""
    files_dir = test_data_dir / "files"
    files_dir.mkdir(parents=True, exist_ok=True)
    return files_dir


@pytest.fixture
def fresh_duckdb_manager(test_duckdb_path: Path, monkeypatch):
    """Create an isolated DuckDB manager for each test.

    This resets the global singleton and uses a temp database path,
    ensuring tests don't affect each other or the user's real database.
    """
    from app.services import duckdb_manager as duckdb_mod
    from app.services.duckdb_manager import DuckDBManager

    # Reset the global singleton
    monkeypatch.setattr(duckdb_mod, "_duckdb_manager", None)

    # Create a new manager with the test path
    manager = DuckDBManager(db_path=test_duckdb_path)

    # Patch the getter to return our test manager
    monkeypatch.setattr(duckdb_mod, "get_duckdb_manager", lambda: manager)

    yield manager

    # Cleanup
    manager.close()


@pytest.fixture
def test_connection_repository(test_db_path: Path, monkeypatch):
    """Create an isolated ConnectionRepository for tests.

    Uses a temporary SQLite database and runs migrations to set up schema.
    """
    from app.services import connection_repository as conn_repo_mod
    from app.services.connection_repository import ConnectionRepository
    from app.services.migration_service import MigrationService

    # Run migrations to create schema
    migration_service = MigrationService(db_path=test_db_path)
    migration_service.run_migrations()

    # Create repository with test database
    repo = ConnectionRepository(db_path=test_db_path)

    # Patch the global instance in the connection_repository module
    monkeypatch.setattr(conn_repo_mod, "connection_repository", repo)

    # Also patch the reference in database.py which imports it at module level
    from app.services import database as db_mod

    monkeypatch.setattr(db_mod, "connection_repository", repo)

    # Reset S3 service singleton so it uses the patched repository
    from app.services import s3_service as s3_mod

    monkeypatch.setattr(s3_mod, "_s3_service", None)

    return repo


@pytest.fixture
def test_query_repository(test_db_path: Path, monkeypatch):
    """Create an isolated QueryRepository for tests.

    Uses the same temporary SQLite database as connection_repository.
    """
    from app.services import query_repository as query_repo_mod
    from app.services.migration_service import MigrationService
    from app.services.query_repository import QueryRepository

    # Ensure migrations are run (idempotent)
    migration_service = MigrationService(db_path=test_db_path)
    migration_service.run_migrations()

    # Create repository with test database
    repo = QueryRepository(db_path=test_db_path)

    # Patch the global instance in the query_repository module
    monkeypatch.setattr(query_repo_mod, "query_repository", repo)

    # Also patch the reference in database.py which imports it at module level
    from app.services import database as db_mod

    monkeypatch.setattr(db_mod, "query_repository", repo)

    return repo


@pytest.fixture
def test_file_repository(test_db_path: Path, test_files_dir: Path, monkeypatch):
    """Create an isolated FileRepository for tests."""
    from app.services import file_repository as file_repo_mod
    from app.services.file_repository import FileRepository
    from app.services.migration_service import MigrationService

    # Ensure migrations are run (idempotent)
    migration_service = MigrationService(db_path=test_db_path)
    migration_service.run_migrations()

    # Create repository with test database and files directory
    repo = FileRepository(db_path=test_db_path, files_dir=test_files_dir)

    # Patch the global instance
    monkeypatch.setattr(file_repo_mod, "file_repository", repo)

    return repo


@pytest.fixture
def test_connection_manager(monkeypatch):
    """Create an isolated ConnectionManager for tests."""
    from app.services import database as db_mod
    from app.services.database import ConnectionManager

    # Create a fresh manager
    manager = ConnectionManager()

    # Patch the global instance
    monkeypatch.setattr(db_mod, "connection_manager", manager)

    return manager


@pytest.fixture
def mock_ai_service(monkeypatch):
    """Mock AI service to avoid expensive API calls during tests.

    Returns a mock that provides predictable SQL responses.
    """
    mock_service = AsyncMock()

    async def mock_edit_sql(*args, **kwargs):
        return {
            "sql": "SELECT * FROM test_table LIMIT 10",
            "explanation": "Generated test SQL query",
        }

    mock_service.edit_sql_from_chat = mock_edit_sql

    # Patch the getter
    from app.services import ai_service as ai_mod

    monkeypatch.setattr(ai_mod, "get_ai_service", lambda *args, **kwargs: mock_service)

    return mock_service


@pytest.fixture
async def test_client(
    test_connection_repository,
    test_query_repository,
    test_file_repository,
    test_connection_manager,
    fresh_duckdb_manager,
    mock_ai_service,
) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client for API testing.

    This fixture sets up all necessary repositories and managers
    with isolated test databases before creating the client.
    """
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# Sample test data fixtures


@pytest.fixture
def sample_postgres_config() -> dict:
    """Sample PostgreSQL connection configuration."""
    return {
        "name": "Test PostgreSQL",
        "type": "postgres",
        "config": {
            "host": "localhost",
            "port": 5432,
            "database": "testdb",
            "username": "testuser",
            "password": "testpass",
            "schema_names": ["public"],
        },
    }


@pytest.fixture
def sample_s3_config() -> dict:
    """Sample S3 connection configuration."""
    return {
        "name": "Test S3 Bucket",
        "type": "s3",
        "config": {
            "credential_type": "manual",
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "bucket": "test-bucket",
            "region": "us-east-1",
        },
    }


@pytest.fixture
def sample_csv_file(test_files_dir: Path) -> Path:
    """Create a sample CSV file for testing."""
    csv_path = test_files_dir / "sample.csv"
    csv_path.write_text("id,name,value\n1,Alice,100\n2,Bob,200\n3,Charlie,300\n")
    return csv_path


@pytest.fixture
def sample_csv_content() -> str:
    """Sample CSV content for upload testing."""
    return "id,name,value\n1,Alice,100\n2,Bob,200\n3,Charlie,300\n"


# PostgreSQL test fixtures


@pytest.fixture(scope="session")
def postgres_container():
    """Start a PostgreSQL container for integration tests.

    This fixture uses testcontainers to spin up a real PostgreSQL
    database for testing. Only runs in CI or when explicitly requested.

    Requires: testcontainers package and Docker
    """
    pytest.importorskip("testcontainers")

    from testcontainers.postgres import PostgresContainer

    container = PostgresContainer(
        image="postgres:16-alpine",
        username="testuser",
        password="testpass",
        dbname="testdb",
    )

    # Start and wait for container to be ready
    container.start()

    yield container

    container.stop()


@pytest.fixture
def postgres_connection_config(postgres_container) -> dict:
    """Get connection config for the test PostgreSQL container."""
    return {
        "name": "Test PostgreSQL Container",
        "type": "postgres",
        "config": {
            "host": postgres_container.get_container_host_ip(),
            "port": int(postgres_container.get_exposed_port(5432)),
            "database": postgres_container.dbname,
            "username": postgres_container.username,
            "password": postgres_container.password,
            "schema_names": ["public"],
        },
    }


# LocalStack S3 fixtures


@pytest.fixture(scope="session")
def localstack_container():
    """Start a LocalStack container for S3 testing.

    Requires: testcontainers package and Docker
    """
    pytest.importorskip("testcontainers")

    from testcontainers.localstack import LocalStackContainer

    container = LocalStackContainer(image="localstack/localstack:latest")
    container.with_services("s3")
    container.start()

    yield container

    container.stop()


@pytest.fixture
def s3_test_bucket(localstack_container):
    """Create a test bucket in LocalStack and return (s3_client, bucket_name, endpoint_url).

    This fixture creates the bucket and uploads sample test files for testing.
    """
    import boto3
    from botocore.client import Config

    endpoint_url = localstack_container.get_url()
    bucket_name = "test-bucket"

    # Create S3 client for LocalStack
    s3_client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id="test",
        aws_secret_access_key="test",
        region_name="us-east-1",
        config=Config(s3={"addressing_style": "path"}),
    )

    # Create the test bucket
    s3_client.create_bucket(Bucket=bucket_name)

    # Upload sample test files
    # CSV file
    csv_content = "id,name,value\n1,Alice,100\n2,Bob,200\n3,Charlie,300\n"
    s3_client.put_object(Bucket=bucket_name, Key="data/sample.csv", Body=csv_content)

    # JSON file
    json_content = '[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]'
    s3_client.put_object(Bucket=bucket_name, Key="data/sample.json", Body=json_content)

    # Create a subfolder structure
    s3_client.put_object(
        Bucket=bucket_name, Key="reports/2024/q1.csv", Body="quarter,revenue\nQ1,1000\n"
    )
    s3_client.put_object(
        Bucket=bucket_name, Key="reports/2024/q2.csv", Body="quarter,revenue\nQ2,1500\n"
    )

    yield s3_client, bucket_name, endpoint_url

    # Cleanup: delete all objects and bucket
    try:
        response = s3_client.list_objects_v2(Bucket=bucket_name)
        if "Contents" in response:
            for obj in response["Contents"]:
                s3_client.delete_object(Bucket=bucket_name, Key=obj["Key"])
        s3_client.delete_bucket(Bucket=bucket_name)
    except Exception:
        pass  # Ignore cleanup errors


@pytest.fixture
def s3_connection_config(s3_test_bucket) -> dict:
    """Get S3 connection config for LocalStack with pre-created bucket."""
    _, bucket_name, endpoint_url = s3_test_bucket

    return {
        "name": "Test LocalStack S3",
        "type": "s3",
        "config": {
            "credential_type": "manual",
            "aws_access_key_id": "test",
            "aws_secret_access_key": "test",
            "bucket": bucket_name,
            "region": "us-east-1",
            "endpoint_url": endpoint_url,
        },
    }


# Utility fixtures


@pytest.fixture
def create_test_query(test_query_repository):
    """Factory fixture to create test queries."""

    def _create(name: str = "Test Query", sql_text: str = "") -> dict:
        query = test_query_repository.create_query(name, sql_text)
        return {
            "id": query.id,
            "name": query.name,
            "sql_text": query.sql_text,
        }

    return _create

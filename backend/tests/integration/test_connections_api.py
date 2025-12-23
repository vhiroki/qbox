"""Integration tests for the connections API.

These tests verify the connection management workflow including:
- Creating, reading, updating, and deleting connections
- Connection identifier collision detection
- Cascade deletion of query selections when a connection is deleted
"""

import pytest
from httpx import AsyncClient


class TestConnectionCRUD:
    """Tests for basic connection CRUD operations."""

    async def test_list_saved_connections_empty(self, test_client: AsyncClient):
        """Should return empty list when no connections exist."""
        response = await test_client.get("/api/connections/saved")

        assert response.status_code == 200
        data = response.json()
        assert "connections" in data
        assert data["connections"] == []

    async def test_list_active_connections_empty(self, test_client: AsyncClient):
        """Should return empty list when no active connections exist."""
        response = await test_client.get("/api/connections/")

        assert response.status_code == 200
        data = response.json()
        assert "connections" in data
        assert data["connections"] == []


class TestConnectionRepository:
    """Tests for connection repository operations (via direct repository access)."""

    def test_save_and_get_connection(self, test_connection_repository, sample_postgres_config):
        """Should save and retrieve a connection configuration."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        connection_id = "test-conn-123"
        config = ConnectionConfig(
            name=sample_postgres_config["name"],
            type=DataSourceType(sample_postgres_config["type"]),
            config=sample_postgres_config["config"],
        )

        # Save
        test_connection_repository.save(connection_id, config)

        # Retrieve
        retrieved = test_connection_repository.get(connection_id)

        assert retrieved is not None
        assert retrieved.name == sample_postgres_config["name"]
        assert retrieved.type == DataSourceType.POSTGRES
        assert retrieved.config["host"] == "localhost"
        assert retrieved.config["database"] == "testdb"

    def test_get_nonexistent_connection(self, test_connection_repository):
        """Should return None for nonexistent connection."""
        result = test_connection_repository.get("nonexistent-id")
        assert result is None

    def test_get_all_connections(self, test_connection_repository, sample_postgres_config):
        """Should return all saved connections."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        # Create two connections
        for i in range(2):
            config = ConnectionConfig(
                name=f"Test Connection {i}",
                type=DataSourceType.POSTGRES,
                config=sample_postgres_config["config"],
            )
            test_connection_repository.save(f"conn-{i}", config)

        # Get all
        connections = test_connection_repository.get_all()

        assert len(connections) == 2
        # Check both connections are present (order may vary due to same timestamp)
        names = {c["name"] for c in connections}
        assert names == {"Test Connection 0", "Test Connection 1"}

    def test_delete_connection(self, test_connection_repository, sample_postgres_config):
        """Should delete a connection."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        connection_id = "to-delete"
        config = ConnectionConfig(
            name="To Delete",
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )

        test_connection_repository.save(connection_id, config)
        assert test_connection_repository.exists(connection_id)

        # Delete
        result = test_connection_repository.delete(connection_id)

        assert result is True
        assert not test_connection_repository.exists(connection_id)

    def test_delete_nonexistent_connection(self, test_connection_repository):
        """Should return False when deleting nonexistent connection."""
        result = test_connection_repository.delete("nonexistent")
        assert result is False


class TestIdentifierCollision:
    """Tests for connection identifier collision detection."""

    def test_identifier_generation(self, test_connection_repository):
        """Should generate valid SQL identifiers from connection names."""
        test_cases = [
            ("My Database", "my_database"),
            ("Production DB 2024", "production_db_2024"),
            ("test-connection", "test_connection"),
            ("123 Starts With Number", "db_123_starts_with_number"),
            ("   Spaces   ", "spaces"),
            ("Special!@#$%Characters", "special_characters"),
            ("UPPERCASE", "uppercase"),
        ]

        for name, expected in test_cases:
            result = test_connection_repository._sanitize_identifier(name)
            assert result == expected, f"Expected '{expected}' for '{name}', got '{result}'"

    def test_collision_detection_same_identifier(
        self, test_connection_repository, sample_postgres_config
    ):
        """Should detect when two connection names produce the same identifier."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        # Create first connection
        config1 = ConnectionConfig(
            name="My Database",
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )
        test_connection_repository.save("conn-1", config1)

        # Try to create second connection with name that produces same identifier
        # "my-database" -> "my_database" (same as "My Database")
        conflicting = test_connection_repository.check_identifier_collision("my-database")

        assert conflicting == "My Database"

    def test_collision_detection_no_collision(
        self, test_connection_repository, sample_postgres_config
    ):
        """Should return None when there's no identifier collision."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        # Create a connection
        config = ConnectionConfig(
            name="First Connection",
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )
        test_connection_repository.save("conn-1", config)

        # Check for collision with different name
        conflicting = test_connection_repository.check_identifier_collision("Second Connection")

        assert conflicting is None

    def test_collision_detection_excludes_self_on_update(
        self, test_connection_repository, sample_postgres_config
    ):
        """Should not detect collision with self when updating."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        connection_id = "conn-1"
        config = ConnectionConfig(
            name="My Connection",
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )
        test_connection_repository.save(connection_id, config)

        # Should not collide with itself
        conflicting = test_connection_repository.check_identifier_collision(
            "My Connection", exclude_id=connection_id
        )

        assert conflicting is None

    def test_save_raises_on_collision(self, test_connection_repository, sample_postgres_config):
        """Should raise ValueError when saving connection with colliding identifier."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        # Create first connection
        config1 = ConnectionConfig(
            name="My Database",
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )
        test_connection_repository.save("conn-1", config1)

        # Try to create collision
        config2 = ConnectionConfig(
            name="my-database",  # Same identifier as "My Database"
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )

        with pytest.raises(ValueError) as exc_info:
            test_connection_repository.save("conn-2", config2)

        assert "conflicts with existing connection" in str(exc_info.value)
        assert "My Database" in str(exc_info.value)


class TestCascadeDelete:
    """Tests for cascade deletion behavior."""

    def test_delete_connection_removes_selections(
        self,
        test_connection_repository,
        test_query_repository,
        sample_postgres_config,
    ):
        """Should delete query selections when connection is deleted."""
        from app.models.schemas import ConnectionConfig, DataSourceType

        connection_id = "conn-to-delete"

        # Create connection
        config = ConnectionConfig(
            name="Connection to Delete",
            type=DataSourceType.POSTGRES,
            config=sample_postgres_config["config"],
        )
        test_connection_repository.save(connection_id, config)

        # Create query and add selection referencing this connection
        query = test_query_repository.create_query("Test Query")
        test_query_repository.add_table_selection(
            query.id,
            connection_id,
            "public",
            "users",
            "connection",
        )

        # Verify selection exists
        selections = test_query_repository.get_query_selections(query.id)
        assert len(selections) == 1

        # Delete selections by connection (simulating what connection_manager does)
        deleted_count = test_query_repository.delete_selections_by_connection(connection_id)

        assert deleted_count == 1

        # Verify selection is gone
        selections = test_query_repository.get_query_selections(query.id)
        assert len(selections) == 0


class TestDuckDBManager:
    """Tests for DuckDB manager operations."""

    def test_generate_identifier(self, fresh_duckdb_manager):
        """Should generate valid SQL identifiers."""
        test_cases = [
            ("Production Database", "production_database"),
            ("My-Test-DB", "my_test_db"),
            ("123 Numbers First", "db_123_numbers_first"),
            ("a" * 100, "a" * 50),  # Truncation
        ]

        for name, expected in test_cases:
            result = fresh_duckdb_manager._generate_duckdb_identifier(name)
            assert result == expected, f"Expected '{expected}' for '{name}', got '{result}'"

    def test_connection_cache(self, fresh_duckdb_manager):
        """Should track attached connections in cache."""
        # Initially empty
        assert not fresh_duckdb_manager.is_attached("test-conn")

        # Manually add to cache (simulating successful attachment)
        fresh_duckdb_manager._attached_connections["test-conn"] = "test_db"

        assert fresh_duckdb_manager.is_attached("test-conn")
        assert fresh_duckdb_manager.get_attached_identifier("test-conn") == "test_db"

    def test_remove_from_cache(self, fresh_duckdb_manager):
        """Should remove connections from cache."""
        fresh_duckdb_manager._attached_connections["test-conn"] = "test_db"

        fresh_duckdb_manager.remove_connection_from_cache("test-conn")

        assert not fresh_duckdb_manager.is_attached("test-conn")


class TestPostgresConnection:
    """Tests with a real PostgreSQL database using testcontainers."""

    async def test_postgres_connection_lifecycle(
        self, test_client: AsyncClient, postgres_connection_config
    ):
        """Should create, connect to, and delete a PostgreSQL connection."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=postgres_connection_config,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        connection_id = data["connection_id"]

        # List saved connections
        response = await test_client.get("/api/connections/saved")
        assert response.status_code == 200
        connections = response.json()["connections"]
        assert len(connections) == 1
        assert connections[0]["name"] == postgres_connection_config["name"]

        # Get connection details (without sensitive data)
        response = await test_client.get(f"/api/connections/saved/{connection_id}")
        assert response.status_code == 200
        conn_data = response.json()
        assert conn_data["name"] == postgres_connection_config["name"]
        # Password should be masked (empty string)
        assert conn_data["config"].get("password") == ""

        # Delete connection
        response = await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )
        assert response.status_code == 200

        # Verify deleted
        response = await test_client.get("/api/connections/saved")
        assert response.json()["connections"] == []

    async def test_postgres_reconnect(self, test_client: AsyncClient, postgres_connection_config):
        """Should be able to reconnect to a saved PostgreSQL connection."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=postgres_connection_config,
        )
        assert response.status_code == 200
        connection_id = response.json()["connection_id"]

        # Reconnect
        response = await test_client.post(f"/api/connections/reconnect/{connection_id}")

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Cleanup
        await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )

"""Integration tests for query creation and execution.

These tests verify the query workflow including:
- Creating, reading, updating, and deleting queries
- Managing table selections
- Executing queries against CSV files
- Query pagination
- SQL history
"""

import pytest
from httpx import AsyncClient


class TestQueryCRUD:
    """Tests for basic query CRUD operations."""

    async def test_list_queries_empty(self, test_client: AsyncClient):
        """Should return empty list when no queries exist."""
        response = await test_client.get("/api/queries/")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_query(self, test_client: AsyncClient):
        """Should create a new query."""
        response = await test_client.post(
            "/api/queries/",
            json={"name": "Test Query", "sql_text": "SELECT 1"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Query"
        assert data["sql_text"] == "SELECT 1"
        assert "id" in data
        assert "created_at" in data

    async def test_get_query(self, test_client: AsyncClient):
        """Should retrieve a query by ID."""
        # Create a query
        create_response = await test_client.post(
            "/api/queries/",
            json={"name": "Get Test", "sql_text": ""},
        )
        query_id = create_response.json()["id"]

        # Get it
        response = await test_client.get(f"/api/queries/{query_id}")

        assert response.status_code == 200
        assert response.json()["name"] == "Get Test"

    async def test_get_nonexistent_query(self, test_client: AsyncClient):
        """Should return 404 for nonexistent query."""
        response = await test_client.get("/api/queries/nonexistent-id")

        assert response.status_code == 404

    async def test_update_query_sql(self, test_client: AsyncClient):
        """Should update query SQL text."""
        # Create query
        create_response = await test_client.post(
            "/api/queries/",
            json={"name": "SQL Update Test", "sql_text": "SELECT 1"},
        )
        query_id = create_response.json()["id"]

        # Update SQL
        response = await test_client.patch(
            f"/api/queries/{query_id}/sql",
            json={"sql_text": "SELECT 2"},
        )

        assert response.status_code == 200
        assert response.json()["sql_text"] == "SELECT 2"

    async def test_update_query_name(self, test_client: AsyncClient):
        """Should update query name."""
        # Create query
        create_response = await test_client.post(
            "/api/queries/",
            json={"name": "Original Name", "sql_text": ""},
        )
        query_id = create_response.json()["id"]

        # Update name
        response = await test_client.patch(
            f"/api/queries/{query_id}/name",
            json={"name": "New Name"},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    async def test_delete_query(self, test_client: AsyncClient):
        """Should delete a query."""
        # Create query
        create_response = await test_client.post(
            "/api/queries/",
            json={"name": "To Delete", "sql_text": ""},
        )
        query_id = create_response.json()["id"]

        # Delete
        response = await test_client.delete(f"/api/queries/{query_id}")

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deleted
        get_response = await test_client.get(f"/api/queries/{query_id}")
        assert get_response.status_code == 404

    async def test_duplicate_query(self, test_client: AsyncClient):
        """Should duplicate a query with its SQL text."""
        # Create query
        create_response = await test_client.post(
            "/api/queries/",
            json={"name": "Original Query", "sql_text": "SELECT * FROM users"},
        )
        query_id = create_response.json()["id"]

        # Duplicate
        response = await test_client.post(f"/api/queries/{query_id}/duplicate")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original Query (Copy)"
        assert data["sql_text"] == "SELECT * FROM users"
        assert data["id"] != query_id


class TestQueryRepository:
    """Tests for query repository operations."""

    def test_create_and_get_query(self, test_query_repository):
        """Should create and retrieve a query."""
        query = test_query_repository.create_query("Test Query", "SELECT 1")

        assert query.id is not None
        assert query.name == "Test Query"
        assert query.sql_text == "SELECT 1"

        # Retrieve
        retrieved = test_query_repository.get_query(query.id)
        assert retrieved is not None
        assert retrieved.name == "Test Query"

    def test_update_query_sql(self, test_query_repository):
        """Should update query SQL and create history entry."""
        query = test_query_repository.create_query("Test", "SELECT 1")

        # Update SQL
        test_query_repository.update_query_sql(query.id, "SELECT 2")

        # Verify update
        updated = test_query_repository.get_query(query.id)
        assert updated.sql_text == "SELECT 2"

        # Check history
        history = test_query_repository.get_sql_history(query.id)
        assert len(history) == 1
        assert history[0]["sql_text"] == "SELECT 2"

    def test_sql_history_limit(self, test_query_repository):
        """Should maintain maximum 50 SQL history versions."""
        query = test_query_repository.create_query("Test", "")

        # Create 55 history entries
        for i in range(55):
            test_query_repository.update_query_sql(query.id, f"SELECT {i}")

        # Should only keep 50
        history = test_query_repository.get_sql_history(query.id)
        assert len(history) == 50

        # Most recent should be first
        assert history[0]["sql_text"] == "SELECT 54"

    def test_duplicate_query(self, test_query_repository):
        """Should duplicate a query with selections and chat history."""
        # Create original query
        original = test_query_repository.create_query("Original", "SELECT * FROM users")

        # Add a selection
        test_query_repository.add_table_selection(
            original.id, "conn-1", "public", "users", "connection"
        )

        # Add chat message
        test_query_repository.add_chat_message(original.id, "user", "Help me")

        # Duplicate
        duplicate = test_query_repository.duplicate_query(original.id)

        assert duplicate is not None
        assert duplicate.name == "Original (Copy)"
        assert duplicate.sql_text == "SELECT * FROM users"

        # Selections should be copied
        selections = test_query_repository.get_query_selections(duplicate.id)
        assert len(selections) == 1
        assert selections[0].table_name == "users"

        # Chat history should be copied
        history = test_query_repository.get_chat_history(duplicate.id)
        assert len(history) == 1
        assert history[0].message == "Help me"


class TestTableSelections:
    """Tests for query table selection management."""

    async def test_get_selections_empty(self, test_client: AsyncClient):
        """Should return empty selections for new query."""
        # Create query
        create_response = await test_client.post(
            "/api/queries/",
            json={"name": "Test", "sql_text": ""},
        )
        query_id = create_response.json()["id"]

        # Get selections
        response = await test_client.get(f"/api/queries/{query_id}/selections")

        assert response.status_code == 200
        data = response.json()
        assert data["query_id"] == query_id
        assert data["selections"] == []

    def test_add_and_remove_selection(self, test_query_repository):
        """Should add and remove table selections."""
        query = test_query_repository.create_query("Test", "")

        # Add selection
        test_query_repository.add_table_selection(
            query.id, "conn-1", "public", "users", "connection"
        )

        selections = test_query_repository.get_query_selections(query.id)
        assert len(selections) == 1
        assert selections[0].table_name == "users"

        # Remove selection
        result = test_query_repository.remove_table_selection(
            query.id, "conn-1", "public", "users", "connection"
        )

        assert result is True
        selections = test_query_repository.get_query_selections(query.id)
        assert len(selections) == 0

    def test_clear_all_selections(self, test_query_repository):
        """Should clear all selections for a query."""
        query = test_query_repository.create_query("Test", "")

        # Add multiple selections
        test_query_repository.add_table_selection(
            query.id, "conn-1", "public", "users", "connection"
        )
        test_query_repository.add_table_selection(
            query.id, "conn-1", "public", "orders", "connection"
        )

        # Clear all
        test_query_repository.clear_query_selections(query.id)

        selections = test_query_repository.get_query_selections(query.id)
        assert len(selections) == 0


class TestDuckDBQueryExecution:
    """Tests for query execution using DuckDB."""

    def test_execute_simple_query(self, fresh_duckdb_manager):
        """Should execute a simple SQL query."""
        columns, rows = fresh_duckdb_manager.execute_query("SELECT 1 as num, 'hello' as msg")

        assert columns == ["num", "msg"]
        assert len(rows) == 1
        assert rows[0]["num"] == 1
        assert rows[0]["msg"] == "hello"

    def test_execute_query_with_error(self, fresh_duckdb_manager):
        """Should raise exception for invalid SQL."""
        with pytest.raises(Exception):
            fresh_duckdb_manager.execute_query("SELECT * FROM nonexistent_table")

    def test_register_csv_file(self, fresh_duckdb_manager, sample_csv_file):
        """Should register a CSV file as a DuckDB view."""
        view_name = fresh_duckdb_manager.register_file(
            file_id="file-123",
            file_name="sample",
            file_path=str(sample_csv_file),
            file_type="csv",
        )

        assert view_name == "file_sample"

        # Query the view
        columns, rows = fresh_duckdb_manager.execute_query(f"SELECT * FROM {view_name}")

        assert "id" in columns
        assert "name" in columns
        assert "value" in columns
        assert len(rows) == 3
        assert rows[0]["name"] == "Alice"

    def test_csv_file_idempotent_registration(self, fresh_duckdb_manager, sample_csv_file):
        """Should return same view name for repeated registration."""
        view_name1 = fresh_duckdb_manager.register_file(
            file_id="file-123",
            file_name="sample",
            file_path=str(sample_csv_file),
            file_type="csv",
        )

        view_name2 = fresh_duckdb_manager.register_file(
            file_id="file-123",
            file_name="sample",
            file_path=str(sample_csv_file),
            file_type="csv",
        )

        assert view_name1 == view_name2

    def test_unregister_file(self, fresh_duckdb_manager, sample_csv_file):
        """Should unregister a file view."""
        view_name = fresh_duckdb_manager.register_file(
            file_id="file-123",
            file_name="sample",
            file_path=str(sample_csv_file),
            file_type="csv",
        )

        # Unregister
        fresh_duckdb_manager.unregister_file("file-123", "sample")

        # Query should fail
        with pytest.raises(Exception):
            fresh_duckdb_manager.execute_query(f"SELECT * FROM {view_name}")

    def test_get_file_metadata(self, fresh_duckdb_manager, sample_csv_file):
        """Should retrieve metadata for a registered file."""
        view_name = fresh_duckdb_manager.register_file(
            file_id="file-123",
            file_name="sample",
            file_path=str(sample_csv_file),
            file_type="csv",
        )

        metadata = fresh_duckdb_manager.get_file_metadata_by_view_name(view_name)

        assert "columns" in metadata
        assert "row_count" in metadata
        assert metadata["row_count"] == 3

        column_names = [col.name for col in metadata["columns"]]
        assert "id" in column_names
        assert "name" in column_names


class TestChatHistory:
    """Tests for query chat history."""

    def test_add_and_get_chat_messages(self, test_query_repository):
        """Should add and retrieve chat messages."""
        query = test_query_repository.create_query("Test", "")

        # Add messages
        msg1 = test_query_repository.add_chat_message(query.id, "user", "Help me write SQL")
        msg2 = test_query_repository.add_chat_message(query.id, "assistant", "Here's the query...")

        assert msg1.id is not None
        assert msg1.role == "user"
        assert msg2.role == "assistant"

        # Get history
        history = test_query_repository.get_chat_history(query.id)

        assert len(history) == 2
        # Should be in chronological order
        assert history[0].message == "Help me write SQL"
        assert history[1].message == "Here's the query..."

    def test_clear_chat_history(self, test_query_repository):
        """Should clear all chat messages for a query."""
        query = test_query_repository.create_query("Test", "")

        # Add messages
        test_query_repository.add_chat_message(query.id, "user", "Message 1")
        test_query_repository.add_chat_message(query.id, "assistant", "Message 2")

        # Clear
        test_query_repository.clear_chat_history(query.id)

        history = test_query_repository.get_chat_history(query.id)
        assert len(history) == 0


class TestSQLHistory:
    """Tests for SQL version history."""

    def test_restore_sql_from_history(self, test_query_repository):
        """Should restore SQL from history entry."""
        query = test_query_repository.create_query("Test", "SELECT 1")

        # Update SQL multiple times
        test_query_repository.update_query_sql(query.id, "SELECT 2")
        test_query_repository.update_query_sql(query.id, "SELECT 3")

        # Get history
        history = test_query_repository.get_sql_history(query.id)
        assert len(history) == 2

        # Restore older version
        older_version_id = history[1]["id"]  # "SELECT 2"
        restored_sql = test_query_repository.restore_sql_from_history(query.id, older_version_id)

        assert restored_sql == "SELECT 2"

        # Verify query was updated
        updated_query = test_query_repository.get_query(query.id)
        assert updated_query.sql_text == "SELECT 2"


class TestPostgresQueryExecution:
    """Tests with a real PostgreSQL database using testcontainers."""

    async def test_execute_query_against_postgres(
        self,
        test_client: AsyncClient,
        test_connection_manager,
        fresh_duckdb_manager,
        postgres_connection_config,
    ):
        """Should execute a query against PostgreSQL via DuckDB."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=postgres_connection_config,
        )
        assert response.status_code == 200
        connection_id = response.json()["connection_id"]

        # Create query with SQL
        sql_text = "SELECT 1 as test_value"
        query_response = await test_client.post(
            "/api/queries/",
            json={"name": "Postgres Test", "sql_text": sql_text},
        )
        query_id = query_response.json()["id"]

        # Add a table selection so the query can be executed
        # We'll select from the postgres connection's information_schema
        await test_client.post(
            f"/api/queries/{query_id}/selections",
            json={
                "connection_id": connection_id,
                "schema_name": "public",
                "table_name": "pg_tables",  # System table that always exists
                "source_type": "connection",
            },
        )

        # Execute query
        execute_response = await test_client.post(
            f"/api/queries/{query_id}/execute",
            json={"page": 1, "page_size": 10, "sql_text": sql_text},
        )

        assert execute_response.status_code == 200
        data = execute_response.json()
        assert "columns" in data
        assert "rows" in data

        # Cleanup
        await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )

"""Integration tests for S3 connections and file operations.

These tests verify S3 functionality using LocalStack testcontainers:
- Creating and connecting to S3 connections
- Listing files and folders in S3 buckets
- Password/credential masking for saved connections
"""

from httpx import AsyncClient


class TestS3Connection:
    """Tests for S3 connection lifecycle using LocalStack."""

    async def test_s3_connection_lifecycle(self, test_client: AsyncClient, s3_connection_config):
        """Should create, connect to, and delete an S3 connection."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=s3_connection_config,
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
        assert connections[0]["name"] == s3_connection_config["name"]

        # Get connection details (credentials should be masked)
        response = await test_client.get(f"/api/connections/saved/{connection_id}")
        assert response.status_code == 200
        conn_data = response.json()
        assert conn_data["name"] == s3_connection_config["name"]
        # AWS credentials should be masked (empty strings)
        assert conn_data["config"].get("aws_access_key_id") == ""
        assert conn_data["config"].get("aws_secret_access_key") == ""

        # Delete connection
        response = await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )
        assert response.status_code == 200

        # Verify deleted
        response = await test_client.get("/api/connections/saved")
        assert response.json()["connections"] == []

    async def test_s3_reconnect(self, test_client: AsyncClient, s3_connection_config):
        """Should be able to reconnect to a saved S3 connection."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=s3_connection_config,
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


class TestS3FileOperations:
    """Tests for S3 file listing and metadata operations."""

    async def test_list_s3_files_root(self, test_client: AsyncClient, s3_connection_config):
        """Should list files and folders at the bucket root."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=s3_connection_config,
        )
        assert response.status_code == 200
        connection_id = response.json()["connection_id"]

        # List files at root
        response = await test_client.get(f"/api/s3/{connection_id}/list")

        assert response.status_code == 200
        data = response.json()
        assert "folders" in data
        assert "files" in data

        # Should have 'data' and 'reports' folders
        folder_names = [f["name"] for f in data["folders"]]
        assert "data" in folder_names
        assert "reports" in folder_names

        # Cleanup
        await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )

    async def test_list_s3_files_subfolder(self, test_client: AsyncClient, s3_connection_config):
        """Should list files in a subfolder."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=s3_connection_config,
        )
        assert response.status_code == 200
        connection_id = response.json()["connection_id"]

        # List files in 'data/' folder
        response = await test_client.get(
            f"/api/s3/{connection_id}/list",
            params={"prefix": "data/"},
        )

        assert response.status_code == 200
        data = response.json()

        # Should have sample.csv and sample.json files
        file_names = [f["name"] for f in data["files"]]
        assert "sample.csv" in file_names
        assert "sample.json" in file_names

        # Cleanup
        await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )

    async def test_list_s3_files_flat(self, test_client: AsyncClient, s3_connection_config):
        """Should list all files with flat=True (no folder grouping)."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=s3_connection_config,
        )
        assert response.status_code == 200
        connection_id = response.json()["connection_id"]

        # List all files flat
        response = await test_client.get(
            f"/api/s3/{connection_id}/list",
            params={"flat": True},
        )

        assert response.status_code == 200
        data = response.json()

        # Should have no folders when flat=True
        assert len(data["folders"]) == 0

        # Should have all files from all directories
        file_paths = [f["path"] for f in data["files"]]
        assert "data/sample.csv" in file_paths
        assert "data/sample.json" in file_paths
        assert "reports/2024/q1.csv" in file_paths
        assert "reports/2024/q2.csv" in file_paths

        # Cleanup
        await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )

    async def test_get_s3_file_metadata(self, test_client: AsyncClient, s3_connection_config):
        """Should get metadata for a structured file in S3."""
        # Create connection
        response = await test_client.post(
            "/api/connections/",
            json=s3_connection_config,
        )
        assert response.status_code == 200
        connection_id = response.json()["connection_id"]

        # Get metadata for the CSV file
        response = await test_client.get(
            f"/api/s3/{connection_id}/metadata",
            params={"file_path": "data/sample.csv"},
        )

        assert response.status_code == 200
        data = response.json()

        # Should have columns from the CSV
        assert "columns" in data
        column_names = [c["name"] for c in data["columns"]]
        assert "id" in column_names
        assert "name" in column_names
        assert "value" in column_names

        # Cleanup
        await test_client.delete(
            f"/api/connections/{connection_id}",
            params={"delete_saved": True},
        )

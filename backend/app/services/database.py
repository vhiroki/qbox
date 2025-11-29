import uuid
from typing import Any, Optional

from app.connections import BaseConnection, ConnectionRegistry
from app.models.schemas import ConnectionConfig, DataSourceType
from app.services.connection_repository import connection_repository
from app.services.duckdb_manager import get_duckdb_manager
from app.services.query_repository import query_repository


class ConnectionManager:
    """Manages data source connections."""

    def __init__(self):
        self.connections: dict[str, BaseConnection] = {}

    async def create_connection(
        self, config: ConnectionConfig, save: bool = True
    ) -> tuple[bool, str, str]:
        """
        Create a new connection.

        Args:
            config: Connection configuration
            save: Whether to save the connection to the repository

        Returns:
            tuple: (success, message, connection_id)
        """
        connection_id = str(uuid.uuid4())

        try:
            # Check if connection type is supported
            if not ConnectionRegistry.is_supported(config.type):
                return False, f"Unsupported data source type: {config.type}", ""

            # Get the connection class from registry
            connection_class = ConnectionRegistry.get(config.type)
            if not connection_class:
                return False, f"Connection type {config.type} not registered", ""

            # Instantiate the connection
            datasource = connection_class(
                connection_id=connection_id,
                connection_name=config.name,
                config=config.config
            )

            # Attempt to connect
            success = await datasource.connect()
            if not success:
                # Use the specific error from the datasource if available
                error_msg = datasource.connection_error or "Failed to establish connection"
                return False, error_msg, ""

            # Store the connection in memory
            self.connections[connection_id] = datasource

            # Save to repository if requested
            if save:
                try:
                    connection_repository.save(connection_id, config)
                except ValueError as e:
                    # Validation error (e.g., duplicate name or identifier collision)
                    # Disconnect the connection since we can't save it
                    await datasource.disconnect()
                    del self.connections[connection_id]
                    return False, str(e), ""

            return True, f"Successfully connected to {config.name}", connection_id

        except ValueError as e:
            # Validation errors from repository or Pydantic
            return False, str(e), ""
        except Exception as e:
            return False, f"Error creating connection: {str(e)}", ""

    async def reconnect(self, connection_id: str) -> tuple[bool, str]:
        """
        Reconnect to a saved connection.

        Returns:
            tuple: (success, message)
        """
        # Get config from repository
        config = connection_repository.get(connection_id)
        if not config:
            return False, "Connection configuration not found"

        try:
            # Check if connection type is supported
            if not ConnectionRegistry.is_supported(config.type):
                return False, f"Unsupported data source type: {config.type}"

            # Get the connection class from registry
            connection_class = ConnectionRegistry.get(config.type)
            if not connection_class:
                return False, f"Connection type {config.type} not registered"

            # Instantiate the connection
            datasource = connection_class(
                connection_id=connection_id,
                connection_name=config.name,
                config=config.config
            )

            # Attempt to connect
            success = await datasource.connect()
            if not success:
                # Use the specific error from the datasource if available
                error_msg = datasource.connection_error or "Failed to establish connection"
                return False, error_msg

            # Store the connection in memory
            self.connections[connection_id] = datasource

            return True, f"Successfully reconnected to {config.name}"

        except Exception as e:
            return False, f"Error reconnecting: {str(e)}"

    async def get_connection(self, connection_id: str) -> Optional[BaseConnection]:
        """Get an active connection by ID. Attempts to reconnect if not active."""
        datasource = self.connections.get(connection_id)

        # If not in memory, try to reconnect from saved config
        if not datasource and connection_repository.exists(connection_id):
            success, _ = await self.reconnect(connection_id)
            if success:
                datasource = self.connections.get(connection_id)

        return datasource

    async def disconnect(self, connection_id: str, delete_saved: bool = False) -> bool:
        """
        Disconnect and remove a connection.

        Args:
            connection_id: The connection ID to disconnect
            delete_saved: Whether to also delete the saved configuration
        
        Returns:
            True if the connection was found (in memory or saved) and disconnected
        """
        datasource = self.connections.get(connection_id)
        if datasource:
            await datasource.disconnect()
            del self.connections[connection_id]

        if delete_saved:
            # Check if connection exists in saved configurations
            connection_exists = connection_repository.exists(connection_id)
            
            # Cleanup connection resources
            if datasource:
                duckdb_manager = get_duckdb_manager()
                await datasource.cleanup(duckdb_manager)
            
            # Delete all query selections that reference this connection
            query_repository.delete_selections_by_connection(connection_id)
            
            # Delete the connection configuration
            connection_repository.delete(connection_id)
            
            # Return success if connection was in memory or in saved configs
            return datasource is not None or connection_exists

        return datasource is not None

    async def list_connections(self) -> list[dict[str, str]]:
        """List all active connections."""
        return [
            {"id": conn_id, "type": type(ds).__name__} for conn_id, ds in self.connections.items()
        ]

    def list_saved_connections(self) -> list[dict[str, Any]]:
        """List all saved connection configurations."""
        return connection_repository.get_all()

    def get_saved_connection(self, connection_id: str) -> Optional[dict[str, Any]]:
        """Get a saved connection configuration (without sensitive data like passwords)."""
        config = connection_repository.get(connection_id)
        if not config:
            return None

        # Mask sensitive fields using connection type-specific logic
        safe_config = config.config.copy()
        connection_class = ConnectionRegistry.get(config.type)
        if connection_class:
            # Create a temporary instance to access the mask_sensitive_fields method
            temp_instance = connection_class(
                connection_id=connection_id,
                connection_name=config.name,
                config=safe_config
            )
            safe_config = temp_instance.mask_sensitive_fields(safe_config)

        return {
            "id": connection_id,
            "name": config.name,
            "type": config.type.value,
            "config": safe_config,
        }

    async def update_saved_connection(
        self, connection_id: str, config: ConnectionConfig
    ) -> tuple[bool, str]:
        """Update a saved connection configuration."""
        existing = connection_repository.get(connection_id)
        if not existing:
            return False, "Connection not found"

        # Preserve sensitive fields using connection type-specific logic
        connection_class = ConnectionRegistry.get(config.type)
        if connection_class:
            # Create a temporary instance to access the preserve_sensitive_fields method
            temp_instance = connection_class(
                connection_id=connection_id,
                connection_name=config.name,
                config=config.config
            )
            config.config = temp_instance.preserve_sensitive_fields(config.config, existing.config)

        # Save the updated config
        try:
            connection_repository.save(connection_id, config)
        except ValueError as e:
            # Validation error (e.g., duplicate name or identifier collision)
            return False, str(e)

        # If the connection is currently active, disconnect and cleanup
        # (it will need to be reconnected with the new config)
        if connection_id in self.connections:
            datasource = self.connections[connection_id]
            await datasource.disconnect()
            # Force cleanup from persistent DuckDB so it will be re-attached with new config
            duckdb_manager = get_duckdb_manager()
            await datasource.cleanup(duckdb_manager)
            del self.connections[connection_id]

        return True, "Connection updated successfully"


# Global connection manager instance
connection_manager = ConnectionManager()

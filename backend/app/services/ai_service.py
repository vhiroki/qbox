"""AI service for SQL query generation with provider abstraction."""

from abc import ABC, abstractmethod
from typing import Any

from openai import AsyncOpenAI

from app.config.settings import get_settings


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    async def generate_sql(
        self, prompt: str, schema_context: str, additional_instructions: str | None = None
    ) -> dict[str, str]:
        """
        Generate SQL query from natural language prompt.

        Args:
            prompt: Natural language query from user
            schema_context: Database schema information (tables, columns, types)
            additional_instructions: Optional additional context or constraints

        Returns:
            Dictionary with 'sql' and 'explanation' keys
        """
        pass


class OpenAIProvider(AIProvider):
    """OpenAI implementation of AI provider."""

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        """Initialize OpenAI provider."""
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def generate_sql(
        self, prompt: str, schema_context: str, additional_instructions: str | None = None
    ) -> dict[str, str]:
        """Generate SQL query using OpenAI."""
        system_prompt = self._build_system_prompt(schema_context, additional_instructions)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,  # Lower temperature for more deterministic SQL generation
            )

            content = response.choices[0].message.content or ""
            sql, explanation = self._parse_response(content)

            return {"sql": sql, "explanation": explanation}

        except Exception as e:
            raise RuntimeError(f"Failed to generate SQL: {str(e)}")

    def _build_system_prompt(
        self, schema_context: str, additional_instructions: str | None = None
    ) -> str:
        """Build the system prompt for SQL generation."""
        base_prompt = f"""You are an expert SQL query generator specializing in DuckDB syntax.

DATABASE SCHEMA:
{schema_context}

INSTRUCTIONS:
1. Generate a valid DuckDB SQL query based on the user's natural language request
2. Use proper DuckDB syntax and functions
3. Reference tables with their full schema-qualified names
   (e.g., pg_connection_alias.schema_name.table_name)
4. Be precise with column names and data types
5. Add appropriate WHERE clauses, JOINs, GROUP BY, and ORDER BY as needed
6. Optimize for readability and performance
7. Return ONLY the SQL query and a brief explanation

RESPONSE FORMAT:
Provide your response in the following format:

SQL:
```sql
<your SQL query here>
```

EXPLANATION:
<brief explanation of what the query does>
"""

        if additional_instructions:
            base_prompt += f"\n\nADDITIONAL CONTEXT:\n{additional_instructions}"

        return base_prompt

    def _parse_response(self, content: str) -> tuple[str, str]:
        """Parse SQL and explanation from LLM response."""
        sql = ""
        explanation = ""

        # Try to extract SQL from markdown code blocks
        if "```sql" in content:
            sql_start = content.find("```sql") + 6
            sql_end = content.find("```", sql_start)
            if sql_end != -1:
                sql = content[sql_start:sql_end].strip()

        # Try to extract explanation
        if "EXPLANATION:" in content:
            exp_start = content.find("EXPLANATION:") + 12
            explanation = content[exp_start:].strip()
        elif "Explanation:" in content:
            exp_start = content.find("Explanation:") + 12
            explanation = content[exp_start:].strip()

        # Fallback: if no structured format, try to extract any SQL-like content
        if not sql:
            # Look for SELECT statements
            if "SELECT" in content.upper():
                lines = content.split("\n")
                sql_lines = []
                in_sql = False
                for line in lines:
                    if "SELECT" in line.upper() or in_sql:
                        in_sql = True
                        sql_lines.append(line)
                        if ";" in line:
                            break
                sql = "\n".join(sql_lines).strip()

        return sql, explanation


class AIService:
    """Service for AI-powered SQL generation and editing."""

    def __init__(self, provider: AIProvider):
        """Initialize AI service with a provider."""
        self.provider = provider

    async def edit_sql_from_chat(
        self,
        current_sql: str,
        user_message: str,
        chat_history: list[Any],
        query_metadata: list[dict[str, Any]],
    ) -> dict[str, str]:
        """
        Edit SQL query based on chat conversation.

        Args:
            current_sql: Current state of the SQL query
            user_message: Latest user message/instruction
            chat_history: Previous chat messages
            query_metadata: List of table metadata from query

        Returns:
            Dictionary with 'sql' and 'explanation' keys
        """
        schema_context = self._format_schema_context(query_metadata)

        # Build messages for chat-based editing
        system_prompt = self._build_chat_system_prompt(schema_context, current_sql)

        # Build conversation history
        messages = [{"role": "system", "content": system_prompt}]

        # Add previous chat messages (excluding system messages)
        for msg in chat_history[-10:]:  # Last 10 messages for context
            if hasattr(msg, "role") and hasattr(msg, "message"):
                messages.append({"role": msg.role, "content": msg.message})

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # Get AI response using the provider's client directly
        if isinstance(self.provider, OpenAIProvider):
            try:
                response = await self.provider.client.chat.completions.create(
                    model=self.provider.model,
                    messages=messages,
                    temperature=0.1,
                )

                content = response.choices[0].message.content or ""
                sql, explanation = self.provider._parse_response(content)

                return {"sql": sql or current_sql, "explanation": explanation}

            except Exception as e:
                raise RuntimeError(f"Failed to edit SQL: {str(e)}")
        else:
            raise NotImplementedError("Only OpenAI provider supported for now")

    def _build_chat_system_prompt(self, schema_context: str, current_sql: str) -> str:
        """Build system prompt for chat-based SQL editing."""
        return f"""You are an expert SQL query editor specializing in DuckDB syntax.

You are helping a user iteratively build and refine a SQL query through conversation.

DATABASE SCHEMA:
{schema_context}

CURRENT SQL QUERY:
```sql
{current_sql if current_sql.strip() else "(empty - no query yet)"}
```

INSTRUCTIONS:
1. Listen to the user's instructions and modify the SQL query accordingly
2. If the query is empty, create a new query based on the user's request
3. If the query exists, edit it to incorporate the user's new requirements
4. Use proper DuckDB syntax and functions
5. Reference tables with their full schema-qualified names (e.g., pg_connection_alias.schema_name.table_name)
6. Preserve the user's manual edits unless they ask you to change them
7. Return the COMPLETE updated SQL query, not just the changes

RESPONSE FORMAT:
Provide your response in the following format:

SQL:
```sql
<complete updated SQL query here>
```

EXPLANATION:
<brief explanation of what you changed or added>
"""

    async def generate_sql_from_prompt(
        self,
        prompt: str,
        workspace_metadata: list[dict[str, Any]],
        additional_instructions: str | None = None,
    ) -> dict[str, str]:
        """
        Generate SQL query from natural language prompt.

        Args:
            prompt: Natural language query from user
            workspace_metadata: List of table metadata from workspace
            additional_instructions: Optional additional context

        Returns:
            Dictionary with 'sql' and 'explanation' keys
        """
        schema_context = self._format_schema_context(workspace_metadata)
        return await self.provider.generate_sql(prompt, schema_context, additional_instructions)

    def _format_schema_context(self, workspace_metadata: list[dict[str, Any]]) -> str:
        """Format workspace metadata into a schema context string."""
        context_parts = []

        for table_meta in workspace_metadata:
            connection_id = table_meta.get("connection_id", "unknown")
            connection_name = table_meta.get("connection_name", "unknown")
            schema_name = table_meta.get("schema_name", "public")
            table_name = table_meta.get("table_name", "unknown")
            columns = table_meta.get("columns", [])
            row_count = table_meta.get("row_count", "unknown")

            # Format DuckDB alias (pg_connection_id with underscores)
            alias = f"pg_{connection_id.replace('-', '_')}"

            table_info = f"\nTable: {alias}.{schema_name}.{table_name}"
            table_info += f"\nConnection: {connection_name}"
            table_info += f"\nRow Count: {row_count}"
            table_info += "\nColumns:"

            for col in columns:
                col_name = col.get("name", "")
                col_type = col.get("type", "")
                nullable = "NULL" if col.get("nullable", True) else "NOT NULL"
                is_pk = " (PRIMARY KEY)" if col.get("is_primary_key", False) else ""
                table_info += f"\n  - {col_name}: {col_type} {nullable}{is_pk}"

            context_parts.append(table_info)

        return "\n".join(context_parts)


def get_ai_service() -> AIService:
    """Get AI service instance with configured provider."""
    settings = get_settings()

    if not settings.OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY not configured. Please set it in your .env file or environment."
        )

    provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY, model=settings.OPENAI_MODEL)
    return AIService(provider)

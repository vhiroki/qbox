from abc import ABC, abstractmethod
from typing import Optional

from openai import AsyncOpenAI

from app.config.settings import get_settings
from app.models.schemas import TableSchema


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    async def generate_sql(
        self, prompt: str, schema: list[TableSchema], dialect: str = "postgres"
    ) -> str:
        """Generate SQL from natural language prompt."""
        pass


class OpenAIProvider(AIProvider):
    """OpenAI provider for SQL generation."""

    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL

    def _build_system_prompt(self, schema: list[TableSchema], dialect: str) -> str:
        """Build system prompt with schema information."""
        schema_info = []
        for table in schema:
            columns = ", ".join(
                [
                    f"{col['name']} ({col['type']})"
                    for col in table.columns
                ]
            )
            schema_info.append(f"Table: {table.table_name}\nColumns: {columns}")

        schema_text = "\n\n".join(schema_info)

        return f"""You are a SQL expert. Generate {dialect} SQL queries based on user prompts.

Database Schema:
{schema_text}

Rules:
1. Return ONLY the SQL query, no explanations or markdown
2. Use proper {dialect} syntax
3. Include appropriate WHERE clauses when filtering
4. Use JOINs when querying multiple tables
5. Add LIMIT clauses for reasonable result sets
6. Ensure column and table names match the schema exactly
7. Use appropriate aggregations (COUNT, SUM, AVG, etc.) when needed
"""

    async def generate_sql(
        self, prompt: str, schema: list[TableSchema], dialect: str = "postgres"
    ) -> str:
        """Generate SQL query from natural language prompt."""
        try:
            system_prompt = self._build_system_prompt(schema, dialect)

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=500,
            )

            sql_query = response.choices[0].message.content.strip()

            # Remove markdown code blocks if present
            if sql_query.startswith("```"):
                sql_query = sql_query.split("\n", 1)[1]
                if sql_query.endswith("```"):
                    sql_query = sql_query.rsplit("\n", 1)[0]

            return sql_query

        except Exception as e:
            raise RuntimeError(f"Failed to generate SQL: {str(e)}")


class AIService:
    """Service for AI-powered query generation."""

    def __init__(self, provider: Optional[AIProvider] = None):
        self.provider = provider or OpenAIProvider()

    async def generate_query(
        self, prompt: str, schema: list[TableSchema], dialect: str = "postgres"
    ) -> str:
        """Generate SQL query from natural language."""
        return await self.provider.generate_sql(prompt, schema, dialect)


# Global AI service instance
ai_service = AIService()

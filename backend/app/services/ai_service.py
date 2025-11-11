"""AI service for SQL query generation using LiteLLM."""

import logging
import time
from typing import Any

import litellm
from litellm import acompletion

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

# Automatically drop unsupported parameters for different models
# This handles temperature, top_p, etc. for models that don't support them
litellm.drop_params = True


class AIService:
    """Service for AI-powered SQL generation and editing."""

    def __init__(self, model: str, temperature: float = 0.1):
        """
        Initialize AI service.

        Args:
            model: Model to use (e.g., "gpt-4o", "claude-3-5-sonnet-20241022", "ollama/llama2")
            temperature: Temperature for generation (0.0-2.0, lower = more deterministic)
        """
        self.model = model
        self.temperature = temperature
        
        # LiteLLM automatically reads API keys from environment variables
        # No need to set them manually - they're already set by pydantic-settings

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
        logger.debug("=" * 80)
        logger.debug("Starting edit_sql_from_chat")
        logger.debug(f"Model: {self.model}, Temperature: {self.temperature}")
        logger.debug(f"User message: {user_message}")
        logger.debug(f"Current SQL length: {len(current_sql)} chars")
        logger.debug(f"Chat history: {len(chat_history)} messages")
        logger.debug(f"Query metadata: {len(query_metadata)} tables")
        
        schema_context = self._format_schema_context(query_metadata)
        system_prompt = self._build_chat_system_prompt(schema_context, current_sql)

        logger.debug("-" * 80)
        logger.debug("System prompt:")
        logger.debug(system_prompt)
        logger.debug("-" * 80)

        # Build conversation history
        messages = [{"role": "system", "content": system_prompt}]

        # Add previous chat messages (last 10 for context)
        context_messages = 0
        for msg in chat_history[-10:]:
            if hasattr(msg, "role") and hasattr(msg, "message"):
                messages.append({"role": msg.role, "content": msg.message})
                context_messages += 1

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        logger.debug(f"Total messages to LLM: {len(messages)} (system + {context_messages} context + 1 new)")

        try:
            logger.debug(f"Calling LLM ({self.model})...")
            start_time = time.time()
            
            # LiteLLM automatically handles provider differences
            response = await acompletion(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
            )
            
            elapsed_time = time.time() - start_time
            logger.debug(f"LLM call completed in {elapsed_time:.2f} seconds")

            content = response.choices[0].message.content or ""
            logger.debug("-" * 80)
            logger.debug("LLM Response:")
            logger.debug(content)
            logger.debug("-" * 80)
            
            sql, explanation = self._parse_response(content)
            
            logger.debug(f"Parsed SQL length: {len(sql)} chars")
            logger.debug(f"Explanation: {explanation[:100]}..." if len(explanation) > 100 else f"Explanation: {explanation}")
            logger.debug("=" * 80)

            return {"sql": sql or current_sql, "explanation": explanation}

        except Exception as e:
            logger.error(f"LLM call failed after {time.time() - start_time:.2f}s: {e}")
            logger.debug("=" * 80)
            raise RuntimeError(f"Failed to edit SQL: {str(e)}")

    async def generate_sql_from_prompt(
        self,
        prompt: str,
        query_metadata: list[dict[str, Any]],
        additional_instructions: str | None = None,
    ) -> dict[str, str]:
        """
        Generate SQL query from natural language prompt.

        Args:
            prompt: Natural language query from user
            query_metadata: List of table metadata from query
            additional_instructions: Optional additional context

        Returns:
            Dictionary with 'sql' and 'explanation' keys
        """
        logger.debug("=" * 80)
        logger.debug("Starting generate_sql_from_prompt")
        logger.debug(f"Model: {self.model}, Temperature: {self.temperature}")
        logger.debug(f"Prompt: {prompt}")
        logger.debug(f"Query metadata: {len(query_metadata)} tables")
        logger.debug(f"Additional instructions: {additional_instructions}")
        
        schema_context = self._format_schema_context(query_metadata)
        system_prompt = self._build_system_prompt(schema_context, additional_instructions)

        logger.debug("-" * 80)
        logger.debug("System prompt:")
        logger.debug(system_prompt)
        logger.debug("-" * 80)

        try:
            logger.debug(f"Calling LLM ({self.model})...")
            start_time = time.time()
            
            # LiteLLM automatically handles provider differences
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=self.temperature,
            )
            
            elapsed_time = time.time() - start_time
            logger.debug(f"LLM call completed in {elapsed_time:.2f} seconds")

            content = response.choices[0].message.content or ""
            logger.debug("-" * 80)
            logger.debug("LLM Response:")
            logger.debug(content)
            logger.debug("-" * 80)
            
            sql, explanation = self._parse_response(content)
            
            logger.debug(f"Parsed SQL length: {len(sql)} chars")
            logger.debug(f"Explanation: {explanation[:100]}..." if len(explanation) > 100 else f"Explanation: {explanation}")
            logger.debug("=" * 80)

            return {"sql": sql, "explanation": explanation}

        except Exception as e:
            logger.error(f"LLM call failed after {time.time() - start_time:.2f}s: {e}")
            logger.debug("=" * 80)
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

    def _format_schema_context(self, query_metadata: list[dict[str, Any]]) -> str:
        """Format query metadata into a schema context string."""
        context_parts = []

        for table_meta in query_metadata:
            connection_id = table_meta.get("connection_id", "unknown")
            connection_name = table_meta.get("connection_name", "unknown")
            schema_name = table_meta.get("schema_name", "public")
            table_name = table_meta.get("table_name", "unknown")
            columns = table_meta.get("columns", [])
            row_count = table_meta.get("row_count", "unknown")

            # Get the DuckDB alias (now human-readable from connection name)
            alias = table_meta.get("alias", f"pg_{connection_id.replace('-', '_')}")

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
    """Get AI service instance with configured model."""
    settings = get_settings()

    model = settings.AI_MODEL
    
    # Validate that appropriate API key is set for the model
    # Models can be prefixed with provider (e.g., "openai/gpt-4o") or not (e.g., "gpt-4o")
    model_lower = model.lower()
    
    # OpenAI models
    if any(prefix in model_lower for prefix in ["openai/", "gpt-", "o1-", "o3-"]):
        if not settings.OPENAI_API_KEY:
            raise RuntimeError(
                "OPENAI_API_KEY not configured. Please set it in your .env file."
            )
    # Anthropic models
    elif any(prefix in model_lower for prefix in ["anthropic/", "claude-"]):
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not configured. Please set it in your .env file."
            )
    # Google models (Gemini or Vertex AI)
    elif any(prefix in model_lower for prefix in ["gemini/", "gemini-", "vertex_ai/"]):
        if not settings.GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY not configured. Please set it in your .env file."
            )
    # Local models (Ollama, etc.) don't need API keys

    return AIService(model=model, temperature=settings.AI_TEMPERATURE)

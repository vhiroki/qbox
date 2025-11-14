"""AI service for SQL query generation using LiteLLM."""

import logging
import os
import time
from typing import Any

import litellm
from litellm import acompletion

from app.config.settings import get_settings
from app.services.settings_repository import settings_repository

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
3. Reference data sources correctly:
   - For database tables: use full schema-qualified names (e.g., pg_connection_alias.schema_name.table_name)
   - For CSV/Excel files: use ONLY the view name listed after "File:" (e.g., file_sales or file_duplicatedstudentids)
   - For S3 files: use ONLY the view name listed after "S3 File:" (e.g., s3_filename)
   - IMPORTANT: The "Original File" line is just for reference - DO NOT use it in SQL queries
4. Be precise with column names and data types
5. Add appropriate WHERE clauses, JOINs, GROUP BY, and ORDER BY as needed
6. Optimize for readability and performance
7. Return ONLY the SQL query and a brief explanation

CRITICAL CONSTRAINTS:
- You MUST ONLY generate SELECT statements for querying data
- DO NOT generate DELETE, UPDATE, INSERT, CREATE, DROP, ALTER, TRUNCATE, or any other data modification or DDL statements
- You MUST ONLY use tables and columns that are explicitly listed in the DATABASE SCHEMA above
- DO NOT assume, guess, or hallucinate table names or column names that are not provided
- If the user requests something that requires tables or columns not in the DATABASE SCHEMA, you MUST inform them that you cannot generate the SQL because the required data is not available in the current schema context
- If you are uncertain about whether a table or column exists, assume it does NOT exist unless explicitly shown above
- If the user asks for data modification operations (DELETE, UPDATE, INSERT, etc.), inform them that you can only generate read-only SELECT queries

RESPONSE FORMAT:
If you CAN generate the SQL with the available schema:
SQL:
```sql
<your SQL query here>
```

EXPLANATION:
<brief explanation of what the query does>

If you CANNOT generate the SQL due to missing tables/columns or unsupported operations:
EXPLANATION:
I cannot generate the SQL you requested because [explain what tables/columns are missing or why the operation is not supported]. Please add the necessary tables to your query first, or rephrase your request as a SELECT query.
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
5. Reference data sources correctly:
   - For database tables: use full schema-qualified names (e.g., pg_connection_alias.schema_name.table_name)
   - For CSV/Excel files: use ONLY the view name listed after "File:" (e.g., file_sales or file_duplicatedstudentids)
   - For S3 files: use ONLY the view name listed after "S3 File:" (e.g., s3_filename)
   - IMPORTANT: The "Original File" line is just for reference - DO NOT use it in SQL queries
6. Preserve the user's manual edits unless they ask you to change them
7. Return the COMPLETE updated SQL query, not just the changes

CRITICAL CONSTRAINTS:
- You MUST ONLY generate SELECT statements for querying data
- DO NOT generate DELETE, UPDATE, INSERT, CREATE, DROP, ALTER, TRUNCATE, or any other data modification or DDL statements
- You MUST ONLY use tables and columns that are explicitly listed in the DATABASE SCHEMA above
- DO NOT assume, guess, or hallucinate table names or column names that are not provided
- If the user requests something that requires tables or columns not in the DATABASE SCHEMA, you MUST inform them that you cannot generate the SQL because the required data is not available in the current schema context
- If you are uncertain about whether a table or column exists, assume it does NOT exist unless explicitly shown above
- If the user asks for data modification operations (DELETE, UPDATE, INSERT, etc.), inform them that you can only generate read-only SELECT queries

RESPONSE FORMAT:
If you CAN generate the SQL with the available schema:
SQL:
```sql
<complete updated SQL query here>
```

EXPLANATION:
<brief explanation of what you changed or added>

If you CANNOT generate the SQL due to missing tables/columns or unsupported operations:
EXPLANATION:
I cannot generate the SQL you requested because [explain what tables/columns are missing or why the operation is not supported]. Please add the necessary tables to your query first, or rephrase your request as a SELECT query.
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
        # But only if there's no EXPLANATION block (which means it's a refusal/error response)
        if not sql and "EXPLANATION:" not in content and "Explanation:" not in content:
            # Look for SELECT statements at the beginning of lines (not in prose)
            if "SELECT" in content.upper():
                lines = content.split("\n")
                sql_lines = []
                in_sql = False
                for line in lines:
                    stripped = line.strip()
                    # Only start SQL extraction if SELECT is at the beginning of the line
                    if stripped.upper().startswith("SELECT") or (in_sql and stripped):
                        in_sql = True
                        sql_lines.append(line)
                        if ";" in line:
                            break
                    elif in_sql:
                        # Stop if we hit an empty line after starting SQL
                        break
                sql = "\n".join(sql_lines).strip()

        return sql, explanation

    def _format_schema_context(self, query_metadata: list[dict[str, Any]]) -> str:
        """Format query metadata into a schema context string."""
        context_parts = []

        for table_meta in query_metadata:
            source_type = table_meta.get("source_type", "connection")
            columns = table_meta.get("columns", [])
            row_count = table_meta.get("row_count", "unknown")
            
            if source_type == "file":
                # Format file metadata
                view_name = table_meta.get("view_name", "unknown")
                file_name = table_meta.get("file_name", "unknown")
                file_type = table_meta.get("file_type", "unknown")
                
                table_info = f"\nFile: {view_name}"
                table_info += f"\nOriginal File: {file_name}.{file_type}"
                table_info += f"\nRow Count: {row_count}"
                table_info += "\nColumns:"
                
                for col in columns:
                    col_name = col.get("name", "")
                    col_type = col.get("type", "")
                    nullable = "NULL" if col.get("nullable", True) else "NOT NULL"
                    table_info += f"\n  - {col_name}: {col_type} {nullable}"
                
                context_parts.append(table_info)
            elif source_type == "s3":
                # Format S3 file metadata
                view_name = table_meta.get("view_name", "unknown")
                file_name = table_meta.get("file_name", "unknown")
                file_path = table_meta.get("file_path", "unknown")
                connection_name = table_meta.get("connection_name", "unknown")
                
                table_info = f"\nS3 File: {view_name}"
                table_info += f"\nOriginal File: {file_name}"
                table_info += f"\nS3 Path: {file_path}"
                table_info += f"\nS3 Connection: {connection_name}"
                table_info += f"\nRow Count: {row_count}"
                table_info += "\nColumns:"
                
                for col in columns:
                    col_name = col.get("name", "")
                    col_type = col.get("type", "")
                    nullable = "NULL" if col.get("nullable", True) else "NOT NULL"
                    table_info += f"\n  - {col_name}: {col_type} {nullable}"
                
                context_parts.append(table_info)
            else:
                # Format database table metadata
                connection_id = table_meta.get("connection_id", "unknown")
                connection_name = table_meta.get("connection_name", "unknown")
                schema_name = table_meta.get("schema_name", "public")
                table_name = table_meta.get("table_name", "unknown")
                
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
    # Get settings from database first, then fall back to config/env
    db_settings = settings_repository.get_ai_settings()
    config_settings = get_settings()
    
    # Use database settings if available, otherwise fall back to config/env
    openai_key = db_settings.get("openai_api_key") or config_settings.OPENAI_API_KEY
    anthropic_key = db_settings.get("anthropic_api_key") or config_settings.ANTHROPIC_API_KEY
    gemini_key = db_settings.get("gemini_api_key") or config_settings.GEMINI_API_KEY
    model = db_settings.get("ai_model") or config_settings.AI_MODEL
    temperature_str = db_settings.get("ai_temperature")
    temperature = float(temperature_str) if temperature_str else config_settings.AI_TEMPERATURE
    
    # Set API keys in environment for LiteLLM to use
    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key
    if anthropic_key:
        os.environ["ANTHROPIC_API_KEY"] = anthropic_key
    if gemini_key:
        os.environ["GEMINI_API_KEY"] = gemini_key
    
    # Validate that appropriate API key is set for the model
    # Models can be prefixed with provider (e.g., "openai/gpt-4o") or not (e.g., "gpt-4o")
    model_lower = model.lower()
    
    # OpenAI models
    if any(prefix in model_lower for prefix in ["openai/", "gpt-", "o1-", "o3-"]):
        if not openai_key:
            raise RuntimeError(
                "OPENAI_API_KEY not configured. Please set it in Settings."
            )
    # Anthropic models
    elif any(prefix in model_lower for prefix in ["anthropic/", "claude-"]):
        if not anthropic_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not configured. Please set it in Settings."
            )
    # Google models (Gemini or Vertex AI)
    elif any(prefix in model_lower for prefix in ["gemini/", "gemini-", "vertex_ai/"]):
        if not gemini_key:
            raise RuntimeError(
                "GEMINI_API_KEY not configured. Please set it in Settings."
            )
    # Local models (Ollama, etc.) don't need API keys

    return AIService(model=model, temperature=temperature)

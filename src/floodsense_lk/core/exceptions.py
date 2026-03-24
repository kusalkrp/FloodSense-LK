"""Typed exception hierarchy for FloodSense LK."""


class AppBaseError(Exception):
    """Base for all FloodSense exceptions."""


class MCPConnectionError(AppBaseError):
    """MCP server unreachable or returned an error."""


class MCPToolError(AppBaseError):
    """MCP tool call failed or returned unexpected data."""


class DatabaseError(AppBaseError):
    """Database operation failed."""


class RedisError(AppBaseError):
    """Redis operation failed."""


class AnomalyServiceError(AppBaseError):
    """Anomaly detection logic error."""


class BaselineNotFoundError(AppBaseError):
    """No baseline exists for this station + week combination."""


class AlertDeliveryError(AppBaseError):
    """Alert could not be delivered via any channel."""


class SubscriberNotFoundError(AppBaseError):
    """Subscriber lookup returned no results."""


class PipelineAlreadyRunningError(AppBaseError):
    """Pipeline lock is held — another run is in progress."""


class AdminAuthError(AppBaseError):
    """Admin API key missing or invalid."""


class LLMError(AppBaseError):
    """Gemini API call failed or returned unparseable output."""


class LLMOutputParseError(LLMError):
    """LLM returned non-JSON or schema-invalid output."""

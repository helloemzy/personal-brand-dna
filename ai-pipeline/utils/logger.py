import logging
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

from .config import settings

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        # Create base log data
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add extra fields if present
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "processing_time"):
            log_data["processing_time"] = record.processing_time
        if hasattr(record, "model_used"):
            log_data["model_used"] = record.model_used
        if hasattr(record, "error_code"):
            log_data["error_code"] = record.error_code
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add stack trace for errors
        if record.levelno >= logging.ERROR and record.stack_info:
            log_data["stack_trace"] = record.stack_info
        
        return json.dumps(log_data, default=str)

class SimpleFormatter(logging.Formatter):
    """Simple formatter for development"""
    
    def __init__(self):
        super().__init__(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

def setup_logger(name: str) -> logging.Logger:
    """Setup logger with appropriate configuration"""
    
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    # Set log level
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logger.setLevel(log_level)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    
    # Set formatter based on environment
    if settings.environment == "production" or settings.log_format == "structured":
        formatter = StructuredFormatter()
    else:
        formatter = SimpleFormatter()
    
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    return logger

class LoggerMixin:
    """Mixin class to add logging capabilities to other classes"""
    
    @property
    def logger(self) -> logging.Logger:
        if not hasattr(self, "_logger"):
            self._logger = setup_logger(self.__class__.__name__)
        return self._logger
    
    def log_operation_start(self, operation: str, **kwargs):
        """Log the start of an operation"""
        self.logger.info(
            f"Starting {operation}",
            extra={
                "operation": operation,
                "operation_stage": "start",
                **kwargs
            }
        )
    
    def log_operation_end(self, operation: str, processing_time: float, **kwargs):
        """Log the end of an operation"""
        self.logger.info(
            f"Completed {operation} in {processing_time:.2f}s",
            extra={
                "operation": operation,
                "operation_stage": "end",
                "processing_time": processing_time,
                **kwargs
            }
        )
    
    def log_operation_error(self, operation: str, error: Exception, **kwargs):
        """Log an operation error"""
        self.logger.error(
            f"Failed {operation}: {str(error)}",
            extra={
                "operation": operation,
                "operation_stage": "error",
                "error_type": type(error).__name__,
                "error_message": str(error),
                **kwargs
            },
            exc_info=True
        )
    
    def log_model_usage(self, model_name: str, input_tokens: int, output_tokens: int, cost: float = None):
        """Log AI model usage for billing/monitoring"""
        self.logger.info(
            f"Model usage: {model_name}",
            extra={
                "model_name": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "estimated_cost": cost,
                "event_type": "model_usage"
            }
        )
    
    def log_performance_metric(self, metric_name: str, value: float, unit: str = None, **kwargs):
        """Log performance metrics"""
        self.logger.info(
            f"Performance metric: {metric_name} = {value}{unit or ''}",
            extra={
                "metric_name": metric_name,
                "metric_value": value,
                "metric_unit": unit,
                "event_type": "performance_metric",
                **kwargs
            }
        )
    
    def log_user_action(self, user_id: str, action: str, **kwargs):
        """Log user actions for analytics"""
        self.logger.info(
            f"User action: {action}",
            extra={
                "user_id": user_id,
                "action": action,
                "event_type": "user_action",
                **kwargs
            }
        )

class AIProcessingLogger(LoggerMixin):
    """Specialized logger for AI processing operations"""
    
    def log_transcription_start(self, user_id: str, audio_url: str, duration: float = None):
        """Log transcription start"""
        self.log_operation_start(
            "transcription",
            user_id=user_id,
            audio_url=audio_url,
            audio_duration=duration
        )
    
    def log_transcription_complete(self, user_id: str, processing_time: float, 
                                 confidence: float, transcription_length: int):
        """Log transcription completion"""
        self.log_operation_end(
            "transcription",
            processing_time,
            user_id=user_id,
            confidence=confidence,
            transcription_length=transcription_length
        )
    
    def log_voice_analysis_start(self, user_id: str, conversation_id: str, 
                               total_transcriptions: int):
        """Log voice analysis start"""
        self.log_operation_start(
            "voice_analysis",
            user_id=user_id,
            conversation_id=conversation_id,
            total_transcriptions=total_transcriptions
        )
    
    def log_voice_analysis_complete(self, user_id: str, processing_time: float,
                                  confidence_score: float, voice_dimensions: int):
        """Log voice analysis completion"""
        self.log_operation_end(
            "voice_analysis",
            processing_time,
            user_id=user_id,
            confidence_score=confidence_score,
            voice_dimensions=voice_dimensions
        )
    
    def log_content_generation_start(self, user_id: str, topic: str, content_type: str):
        """Log content generation start"""
        self.log_operation_start(
            "content_generation",
            user_id=user_id,
            topic=topic,
            content_type=content_type
        )
    
    def log_content_generation_complete(self, user_id: str, processing_time: float,
                                      content_length: int, voice_match_score: float):
        """Log content generation completion"""
        self.log_operation_end(
            "content_generation", 
            processing_time,
            user_id=user_id,
            content_length=content_length,
            voice_match_score=voice_match_score
        )

# Global logger instances
main_logger = setup_logger("ai_pipeline")
ai_logger = AIProcessingLogger()

# Configure third-party loggers
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("asyncpg").setLevel(logging.WARNING)
logging.getLogger("redis").setLevel(logging.WARNING)

# Export commonly used loggers
__all__ = [
    "setup_logger",
    "LoggerMixin", 
    "AIProcessingLogger",
    "main_logger",
    "ai_logger"
]
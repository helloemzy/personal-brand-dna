import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application configuration settings"""
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://pbdna_user:pbdna_password@localhost:5432/pbdna_dev")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # OpenAI
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4")
    openai_max_tokens: int = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
    openai_temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))
    
    # Google Cloud Speech
    google_speech_credentials: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    google_speech_language: str = os.getenv("GOOGLE_SPEECH_LANGUAGE", "en-US")
    
    # AWS
    aws_access_key_id: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    s3_bucket_name: Optional[str] = os.getenv("S3_BUCKET_NAME")
    
    # Audio processing
    max_audio_file_size: int = int(os.getenv("MAX_AUDIO_FILE_SIZE", "50")) * 1024 * 1024  # 50MB
    supported_audio_formats: list = ["mp3", "wav", "m4a", "ogg", "webm"]
    audio_sample_rate: int = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
    
    # Voice analysis
    min_transcription_length: int = int(os.getenv("MIN_TRANSCRIPTION_LENGTH", "50"))
    voice_analysis_timeout: int = int(os.getenv("VOICE_ANALYSIS_TIMEOUT", "120"))
    
    # Content generation
    content_generation_timeout: int = int(os.getenv("CONTENT_GENERATION_TIMEOUT", "60"))
    max_content_variations: int = int(os.getenv("MAX_CONTENT_VARIATIONS", "3"))
    
    # Caching
    cache_ttl_transcriptions: int = int(os.getenv("CACHE_TTL_TRANSCRIPTIONS", "86400"))  # 24 hours
    cache_ttl_content: int = int(os.getenv("CACHE_TTL_CONTENT", "3600"))  # 1 hour
    cache_ttl_voice_profiles: int = int(os.getenv("CACHE_TTL_VOICE_PROFILES", "604800"))  # 1 week
    
    # Rate limiting
    rate_limit_transcriptions: int = int(os.getenv("RATE_LIMIT_TRANSCRIPTIONS", "100"))  # per hour
    rate_limit_content_generation: int = int(os.getenv("RATE_LIMIT_CONTENT_GENERATION", "500"))  # per hour
    
    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_format: str = os.getenv("LOG_FORMAT", "detailed")
    
    # Model paths
    spacy_model: str = os.getenv("SPACY_MODEL", "en_core_web_sm")
    custom_models_path: str = os.getenv("CUSTOM_MODELS_PATH", "/app/models")
    
    # Voice analysis parameters
    voice_dimensions: list = [
        "formality_level",
        "emotional_expressiveness", 
        "technical_depth",
        "storytelling_style",
        "authority_tone",
        "empathy_level",
        "humor_usage",
        "vulnerability_comfort",
        "industry_jargon",
        "communication_pace",
        "explanation_style",
        "question_asking_tendency",
        "call_to_action_style",
        "personal_experience_sharing"
    ]
    
    # Content generation parameters
    content_types: list = [
        "post",
        "article", 
        "story",
        "poll",
        "carousel",
        "video_script",
        "podcast_outline"
    ]
    
    # Template categories
    template_use_cases: list = [
        "thought_leadership",
        "personal_story",
        "industry_commentary",
        "how_to_guide",
        "behind_the_scenes",
        "career_advice",
        "team_appreciation",
        "product_announcement",
        "event_promotion",
        "networking"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create global settings instance
settings = Settings()

# Voice analysis scoring weights
VOICE_ANALYSIS_WEIGHTS = {
    "formality_level": 0.15,
    "emotional_expressiveness": 0.12,
    "technical_depth": 0.10,
    "storytelling_style": 0.08,
    "authority_tone": 0.10,
    "empathy_level": 0.08,
    "humor_usage": 0.05,
    "vulnerability_comfort": 0.06,
    "industry_jargon": 0.08,
    "communication_pace": 0.05,
    "explanation_style": 0.08,
    "question_asking_tendency": 0.03,
    "call_to_action_style": 0.02,
    "personal_experience_sharing": 0.00
}

# Content quality scoring weights
CONTENT_QUALITY_WEIGHTS = {
    "voice_match": 0.40,
    "engagement_potential": 0.25,
    "clarity": 0.15,
    "authenticity": 0.10,
    "actionability": 0.10
}

# Industry-specific adjustments
INDUSTRY_VOICE_ADJUSTMENTS = {
    "technology": {
        "technical_depth": 1.2,
        "formality_level": 0.9,
        "industry_jargon": 1.3
    },
    "finance": {
        "formality_level": 1.3,
        "authority_tone": 1.2,
        "technical_depth": 1.1
    },
    "healthcare": {
        "empathy_level": 1.4,
        "technical_depth": 1.2,
        "authority_tone": 1.1
    },
    "marketing": {
        "emotional_expressiveness": 1.3,
        "storytelling_style": 1.2,
        "call_to_action_style": 1.4
    },
    "consulting": {
        "authority_tone": 1.2,
        "explanation_style": 1.3,
        "question_asking_tendency": 1.2
    }
}

# LinkedIn optimization parameters
LINKEDIN_OPTIMIZATION = {
    "optimal_length": {
        "post": (150, 300),
        "article": (1000, 2000),
        "story": (200, 400)
    },
    "engagement_triggers": [
        "Ask a question",
        "Share a personal experience", 
        "Provide actionable advice",
        "Include industry insights",
        "End with a call-to-action"
    ],
    "hashtag_recommendations": {
        "min": 3,
        "max": 5,
        "industry_specific": True
    }
}
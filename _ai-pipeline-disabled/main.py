import os
import asyncio
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
import asyncpg
from redis import asyncio as aioredis

from voice_analysis.transcription import TranscriptionService
from voice_analysis.analyzer import VoiceAnalyzer
from content_generation.generator import ContentGenerator
from content_generation.templates import TemplateManager
from models.voice_profile import VoiceProfile
from models.content_request import ContentRequest
from utils.config import settings
from utils.logger import setup_logger

# Setup logging
logger = setup_logger(__name__)

# Global variables for services
db_pool = None
redis_client = None
transcription_service = None
voice_analyzer = None
content_generator = None
template_manager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    global db_pool, redis_client, transcription_service, voice_analyzer, content_generator, template_manager
    
    try:
        # Initialize database connection
        db_pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=5,
            max_size=20,
            command_timeout=30
        )
        logger.info("✅ Database pool created")

        # Initialize Redis connection
        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        logger.info("✅ Redis connected")

        # Initialize AI services
        transcription_service = TranscriptionService()
        voice_analyzer = VoiceAnalyzer()
        content_generator = ContentGenerator()
        template_manager = TemplateManager()
        
        logger.info("✅ AI services initialized")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    finally:
        # Cleanup
        if db_pool:
            await db_pool.close()
        if redis_client:
            await redis_client.close()
        logger.info("🛑 Services cleaned up")

# Create FastAPI app
app = FastAPI(
    title="Personal Brand DNA AI Pipeline",
    description="AI/ML services for voice analysis and content generation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class TranscriptionRequest(BaseModel):
    audio_url: str
    user_id: str
    conversation_id: str
    question_id: str

class TranscriptionResponse(BaseModel):
    transcription: str
    confidence: float
    processing_time: float
    metadata: Dict[str, Any]

class VoiceAnalysisRequest(BaseModel):
    user_id: str
    conversation_id: str

class VoiceAnalysisResponse(BaseModel):
    voice_signature: Dict[str, Any]
    confidence_score: float
    metadata: Dict[str, Any]

class ContentGenerationRequest(BaseModel):
    user_id: str
    topic: str
    content_type: str = "post"
    template: Optional[Dict[str, Any]] = None
    voice_signature: Dict[str, Any]
    user_profile: Dict[str, Any]
    preferences: Dict[str, Any] = {}

class ContentGenerationResponse(BaseModel):
    content: str
    variations: List[str] = []
    metadata: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]

# Dependency to get database connection
async def get_db():
    async with db_pool.acquire() as connection:
        yield connection

# Dependency to get Redis connection
async def get_redis():
    return redis_client

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    services_status = {}
    
    # Check database
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        services_status["database"] = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        services_status["database"] = "unhealthy"
    
    # Check Redis
    try:
        await redis_client.ping()
        services_status["redis"] = "healthy"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        services_status["redis"] = "unhealthy"
    
    # Check AI services
    try:
        services_status["openai"] = "healthy" if settings.openai_api_key else "not_configured"
        services_status["google_speech"] = "healthy" if settings.google_speech_credentials else "not_configured"
    except Exception as e:
        logger.error(f"AI services health check failed: {e}")
        services_status["ai_services"] = "unhealthy"
    
    overall_status = "healthy" if all(
        status == "healthy" for status in services_status.values()
    ) else "degraded"
    
    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        services=services_status
    )

# Audio transcription endpoint
@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: TranscriptionRequest,
    db: asyncpg.Connection = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis)
):
    """Transcribe audio file to text"""
    try:
        start_time = datetime.utcnow()
        
        # Check cache first
        cache_key = f"transcription:{request.audio_url}"
        cached_result = await redis.get(cache_key)
        
        if cached_result:
            logger.info(f"Cache hit for transcription: {request.audio_url}")
            import json
            return TranscriptionResponse(**json.loads(cached_result))
        
        # Transcribe audio
        result = await transcription_service.transcribe(
            audio_url=request.audio_url,
            user_id=request.user_id
        )
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        response = TranscriptionResponse(
            transcription=result["transcription"],
            confidence=result["confidence"],
            processing_time=processing_time,
            metadata={
                "conversation_id": request.conversation_id,
                "question_id": request.question_id,
                "audio_duration": result.get("audio_duration", 0),
                "language": result.get("language", "en-US")
            }
        )
        
        # Cache result for 24 hours
        await redis.setex(
            cache_key, 
            86400, 
            response.model_dump_json()
        )
        
        # Store transcription in database
        await db.execute(
            """INSERT INTO voice_transcriptions 
               (user_id, conversation_id, question_id, audio_url, transcription, confidence, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            request.user_id,
            request.conversation_id,
            request.question_id,
            request.audio_url,
            result["transcription"],
            result["confidence"],
            response.metadata
        )
        
        logger.info(f"Transcription completed for user {request.user_id}, duration: {processing_time:.2f}s")
        
        return response
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# Voice analysis endpoint
@app.post("/analyze-voice", response_model=VoiceAnalysisResponse)
async def analyze_voice(
    request: VoiceAnalysisRequest,
    db: asyncpg.Connection = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis)
):
    """Analyze user's voice from conversation transcriptions"""
    try:
        start_time = datetime.utcnow()
        
        # Get all transcriptions for this conversation
        transcriptions = await db.fetch(
            """SELECT transcription, question_id, metadata 
               FROM voice_transcriptions 
               WHERE user_id = $1 AND conversation_id = $2
               ORDER BY created_at""",
            request.user_id,
            request.conversation_id
        )
        
        if not transcriptions:
            raise HTTPException(
                status_code=404, 
                detail="No transcriptions found for this conversation"
            )
        
        # Combine all transcriptions
        conversation_data = []
        for trans in transcriptions:
            conversation_data.append({
                "question_id": trans["question_id"],
                "transcription": trans["transcription"],
                "metadata": trans["metadata"]
            })
        
        # Analyze voice
        analysis_result = await voice_analyzer.analyze_voice(
            conversation_data=conversation_data,
            user_id=request.user_id
        )
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        response = VoiceAnalysisResponse(
            voice_signature=analysis_result["voice_signature"],
            confidence_score=analysis_result["confidence_score"],
            metadata={
                "conversation_id": request.conversation_id,
                "total_questions": len(conversation_data),
                "analysis_time": processing_time,
                "voice_dimensions": len(analysis_result["voice_signature"]),
                "processing_details": analysis_result.get("processing_details", {})
            }
        )
        
        logger.info(f"Voice analysis completed for user {request.user_id}, confidence: {analysis_result['confidence_score']:.2f}")
        
        return response
        
    except Exception as e:
        logger.error(f"Voice analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice analysis failed: {str(e)}")

# Content generation endpoint
@app.post("/generate-content", response_model=ContentGenerationResponse)
async def generate_content(
    request: ContentGenerationRequest,
    db: asyncpg.Connection = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis)
):
    """Generate personalized content based on voice signature"""
    try:
        start_time = datetime.utcnow()
        
        # Generate cache key based on request parameters
        import hashlib
        import json
        
        cache_data = {
            "topic": request.topic,
            "content_type": request.content_type,
            "voice_signature": request.voice_signature,
            "preferences": request.preferences
        }
        cache_key = f"content:{hashlib.md5(json.dumps(cache_data, sort_keys=True).encode()).hexdigest()}"
        
        # Check cache (shorter TTL for content)
        cached_result = await redis.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for content generation: {request.topic}")
            return ContentGenerationResponse(**json.loads(cached_result))
        
        # Generate content
        generation_result = await content_generator.generate_content(
            topic=request.topic,
            content_type=request.content_type,
            voice_signature=request.voice_signature,
            user_profile=request.user_profile,
            template=request.template,
            preferences=request.preferences
        )
        
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        response = ContentGenerationResponse(
            content=generation_result["content"],
            variations=generation_result.get("variations", []),
            metadata={
                "generation_time": processing_time,
                "template_used": generation_result.get("template_id"),
                "voice_match_score": generation_result.get("voice_match_score", 0),
                "content_length": len(generation_result["content"]),
                "generation_model": generation_result.get("model_used", "gpt-4"),
                "processing_details": generation_result.get("processing_details", {})
            }
        )
        
        # Cache result for 1 hour
        await redis.setex(
            cache_key, 
            3600, 
            response.model_dump_json()
        )
        
        logger.info(f"Content generated for user {request.user_id}, topic: {request.topic}, time: {processing_time:.2f}s")
        
        return response
        
    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Content generation failed: {str(e)}")

# Batch content generation endpoint
@app.post("/generate-content-batch")
async def generate_content_batch(
    requests: List[ContentGenerationRequest],
    db: asyncpg.Connection = Depends(get_db)
):
    """Generate multiple content pieces in batch"""
    try:
        if len(requests) > 10:
            raise HTTPException(
                status_code=400, 
                detail="Maximum 10 content requests per batch"
            )
        
        results = []
        for request in requests:
            try:
                result = await generate_content(request, db, redis_client)
                results.append({"success": True, "data": result})
            except Exception as e:
                results.append({"success": False, "error": str(e)})
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Batch content generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch generation failed: {str(e)}")

# Template management endpoints
@app.get("/templates")
async def get_templates(
    content_type: Optional[str] = None,
    industry: Optional[str] = None,
    use_case: Optional[str] = None
):
    """Get available content templates"""
    try:
        templates = await template_manager.get_templates(
            content_type=content_type,
            industry=industry,
            use_case=use_case
        )
        
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Failed to get templates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get templates: {str(e)}")

# Voice profile management
@app.get("/voice-profiles/{user_id}")
async def get_voice_profiles(
    user_id: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """Get voice profiles for a user"""
    try:
        profiles = await db.fetch(
            """SELECT id, voice_signature, confidence_score, created_at, analysis_metadata
               FROM voice_profiles 
               WHERE user_id = $1 
               ORDER BY created_at DESC""",
            user_id
        )
        
        return {"profiles": [dict(profile) for profile in profiles]}
        
    except Exception as e:
        logger.error(f"Failed to get voice profiles: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get voice profiles: {str(e)}")

# Analytics and monitoring
@app.get("/analytics/usage/{user_id}")
async def get_usage_analytics(
    user_id: str,
    days: int = 30,
    db: asyncpg.Connection = Depends(get_db)
):
    """Get usage analytics for a user"""
    try:
        # Get transcription usage
        transcription_stats = await db.fetchrow(
            """SELECT 
                COUNT(*) as total_transcriptions,
                SUM(CASE WHEN created_at >= NOW() - INTERVAL '%s days' THEN 1 ELSE 0 END) as recent_transcriptions,
                AVG(confidence) as avg_confidence
               FROM voice_transcriptions 
               WHERE user_id = $1""",
            user_id
        )
        
        # Get content generation usage
        content_stats = await db.fetchrow(
            """SELECT 
                COUNT(*) as total_content,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '%s days' THEN 1 END) as recent_content
               FROM generated_content 
               WHERE user_id = $1""",
            user_id
        )
        
        return {
            "transcription_stats": dict(transcription_stats) if transcription_stats else {},
            "content_stats": dict(content_stats) if content_stats else {},
            "period_days": days
        }
        
    except Exception as e:
        logger.error(f"Failed to get usage analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get usage analytics: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True if os.getenv("ENV") == "development" else False,
        log_level="info"
    )
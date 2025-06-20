from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
from uuid import UUID
from enum import Enum


class ContentType(str, Enum):
    """Supported content types for generation"""
    POST = "post"
    ARTICLE = "article" 
    STORY = "story"
    POLL = "poll"
    CAROUSEL = "carousel"
    THOUGHT_LEADERSHIP = "thought_leadership"
    PERSONAL_UPDATE = "personal_update"
    INDUSTRY_INSIGHT = "industry_insight"


class UrgencyLevel(str, Enum):
    """Content urgency levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ContentRequest(BaseModel):
    """Content generation request model"""
    
    user_id: UUID = Field(..., description="User requesting the content")
    topic: str = Field(..., min_length=3, max_length=500, description="Content topic or subject")
    content_type: ContentType = Field(ContentType.POST, description="Type of content to generate")
    voice_signature: Dict[str, float] = Field(..., description="User's voice profile for matching")
    user_profile: Dict[str, Any] = Field(..., description="User profile information")
    
    # Optional template and customization
    template_id: Optional[UUID] = Field(None, description="Specific template to use")
    template: Optional[Dict[str, Any]] = Field(None, description="Custom template structure")
    
    # Generation preferences
    preferences: Dict[str, Any] = Field(default_factory=dict, description="Generation preferences")
    target_audience: Optional[str] = Field(None, description="Specific target audience")
    call_to_action: Optional[str] = Field(None, description="Specific CTA to include")
    urgency: UrgencyLevel = Field(UrgencyLevel.MEDIUM, description="Content urgency level")
    
    # Content specifications
    max_length: Optional[int] = Field(None, ge=50, le=5000, description="Maximum content length")
    include_hashtags: bool = Field(True, description="Whether to include hashtags")
    include_personal_experience: bool = Field(False, description="Include personal story elements")
    generate_variations: bool = Field(False, description="Generate content variations")
    max_variations: int = Field(2, ge=0, le=5, description="Maximum number of variations")
    
    # Metadata
    request_id: Optional[UUID] = Field(None, description="Unique request identifier")
    created_at: Optional[datetime] = Field(None, description="Request creation time")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: str
        }
    
    @validator('voice_signature')
    def validate_voice_signature(cls, v):
        """Validate voice signature has required dimensions"""
        required_dimensions = [
            "formality_level", "emotional_expressiveness", "technical_depth",
            "storytelling_style", "authority_tone", "empathy_level"
        ]
        
        for dimension in required_dimensions:
            if dimension not in v:
                raise ValueError(f"Missing required voice dimension: {dimension}")
            
            score = v[dimension]
            if not isinstance(score, (int, float)) or not 0.0 <= score <= 1.0:
                raise ValueError(f"Invalid score for {dimension}: must be between 0.0 and 1.0")
        
        return v
    
    @validator('user_profile')
    def validate_user_profile(cls, v):
        """Validate user profile has minimum required fields"""
        required_fields = ["userId", "industry", "role"]
        
        for field in required_fields:
            if field not in v:
                raise ValueError(f"Missing required user profile field: {field}")
        
        return v
    
    @validator('preferences')
    def validate_preferences(cls, v):
        """Validate and normalize preferences"""
        # Set default preferences if not provided
        defaults = {
            "tone": "professional",
            "style": "balanced", 
            "include_emoji": False,
            "include_statistics": False,
            "include_questions": True
        }
        
        # Merge with defaults
        for key, default_value in defaults.items():
            if key not in v:
                v[key] = default_value
        
        return v
    
    def get_content_length_target(self) -> int:
        """Get target content length based on content type"""
        length_targets = {
            ContentType.POST: 250,
            ContentType.ARTICLE: 1500,
            ContentType.STORY: 350,
            ContentType.POLL: 150,
            ContentType.CAROUSEL: 200,
            ContentType.THOUGHT_LEADERSHIP: 800,
            ContentType.PERSONAL_UPDATE: 200,
            ContentType.INDUSTRY_INSIGHT: 600
        }
        
        target = length_targets.get(self.content_type, 250)
        
        # Respect max_length if specified
        if self.max_length:
            return min(target, self.max_length)
        
        return target
    
    def get_generation_parameters(self) -> Dict[str, Any]:
        """Get parameters for content generation"""
        return {
            "topic": self.topic,
            "content_type": self.content_type.value,
            "voice_signature": self.voice_signature,
            "user_profile": self.user_profile,
            "template": self.template,
            "preferences": self.preferences,
            "target_length": self.get_content_length_target(),
            "urgency": self.urgency.value,
            "target_audience": self.target_audience,
            "call_to_action": self.call_to_action,
            "include_personal_experience": self.include_personal_experience,
            "generate_variations": self.generate_variations,
            "max_variations": self.max_variations if self.generate_variations else 0
        }
    
    def is_suitable_for_voice_profile(self) -> bool:
        """Check if content request is suitable for the provided voice profile"""
        content_requirements = {
            ContentType.STORY: {
                "storytelling_style": 0.4,
                "personal_experience_sharing": 0.3
            },
            ContentType.THOUGHT_LEADERSHIP: {
                "authority_tone": 0.5,
                "technical_depth": 0.3
            },
            ContentType.PERSONAL_UPDATE: {
                "personal_experience_sharing": 0.4,
                "emotional_expressiveness": 0.2
            },
            ContentType.INDUSTRY_INSIGHT: {
                "technical_depth": 0.4,
                "industry_jargon": 0.3
            }
        }
        
        requirements = content_requirements.get(self.content_type, {})
        
        for dimension, min_score in requirements.items():
            if self.voice_signature.get(dimension, 0.0) < min_score:
                return False
        
        return True
    
    def get_recommended_template_type(self) -> str:
        """Get recommended template type based on content request"""
        # Analyze voice signature and content type to recommend template
        storytelling_score = self.voice_signature.get("storytelling_style", 0.3)
        authority_score = self.voice_signature.get("authority_tone", 0.4)
        personal_score = self.voice_signature.get("personal_experience_sharing", 0.4)
        
        if storytelling_score > 0.6 and personal_score > 0.5:
            return "personal_story"
        elif authority_score > 0.6:
            return "thought_leadership"
        elif self.content_type == ContentType.INDUSTRY_INSIGHT:
            return "industry_commentary"
        elif personal_score > 0.5:
            return "professional_update"
        else:
            return "general_insight"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for processing"""
        return {
            "user_id": str(self.user_id),
            "topic": self.topic,
            "content_type": self.content_type.value,
            "voice_signature": self.voice_signature,
            "user_profile": self.user_profile,
            "template_id": str(self.template_id) if self.template_id else None,
            "template": self.template,
            "preferences": self.preferences,
            "target_audience": self.target_audience,
            "call_to_action": self.call_to_action,
            "urgency": self.urgency.value,
            "max_length": self.max_length,
            "include_hashtags": self.include_hashtags,
            "include_personal_experience": self.include_personal_experience,
            "generate_variations": self.generate_variations,
            "max_variations": self.max_variations,
            "request_id": str(self.request_id) if self.request_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ContentResponse(BaseModel):
    """Content generation response model"""
    
    request_id: UUID
    content: str = Field(..., description="Generated content")
    variations: List[str] = Field(default_factory=list, description="Content variations")
    voice_match_score: float = Field(..., ge=0.0, le=1.0, description="How well content matches voice")
    template_used: Optional[str] = Field(None, description="Template that was used")
    model_used: str = Field(..., description="AI model used for generation")
    
    # Metadata
    generation_time: float = Field(..., description="Time taken to generate content")
    content_length: int = Field(..., description="Length of generated content")
    optimizations_applied: List[str] = Field(default_factory=list, description="Applied optimizations")
    
    # Quality metrics
    estimated_engagement_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    readability_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    seo_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: str
        }
    
    def get_content_preview(self, max_length: int = 100) -> str:
        """Get truncated preview of content"""
        if len(self.content) <= max_length:
            return self.content
        
        return self.content[:max_length].rsplit(' ', 1)[0] + "..."
    
    def get_quality_summary(self) -> Dict[str, Any]:
        """Get summary of content quality metrics"""
        return {
            "voice_match": self.voice_match_score,
            "estimated_engagement": self.estimated_engagement_score,
            "readability": self.readability_score,
            "seo_optimization": self.seo_score,
            "content_length": self.content_length,
            "variations_count": len(self.variations),
            "optimizations_count": len(self.optimizations_applied)
        }
    
    def is_ready_for_publishing(self, min_voice_match: float = 0.7) -> bool:
        """Check if content meets quality standards for publishing"""
        return (
            self.voice_match_score >= min_voice_match and
            self.content_length >= 50 and
            len(self.content.strip()) > 0
        )
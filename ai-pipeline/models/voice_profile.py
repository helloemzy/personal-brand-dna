from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID


class VoiceProfile(BaseModel):
    """Voice profile data model for storing and manipulating voice analysis results"""
    
    id: Optional[UUID] = Field(None, description="Unique identifier for the voice profile")
    user_id: UUID = Field(..., description="User ID this profile belongs to")
    voice_signature: Dict[str, float] = Field(..., description="14-dimensional voice analysis scores")
    context_mappings: Optional[Dict[str, Any]] = Field(None, description="Different voice contexts")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score for the analysis")
    analysis_metadata: Optional[Dict[str, Any]] = Field(None, description="Additional analysis metadata")
    recording_file_url: Optional[str] = Field(None, description="URL to the original recording")
    transcription: Optional[str] = Field(None, description="Full conversation transcription")
    created_at: Optional[datetime] = Field(None, description="Profile creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: str
        }
    
    @classmethod
    def from_analysis_result(cls, user_id: UUID, analysis_result: Dict[str, Any], 
                           transcription: str, recording_url: Optional[str] = None) -> "VoiceProfile":
        """Create VoiceProfile from voice analysis result"""
        return cls(
            user_id=user_id,
            voice_signature=analysis_result["voice_signature"],
            confidence_score=analysis_result["confidence_score"],
            analysis_metadata=analysis_result.get("processing_details", {}),
            recording_file_url=recording_url,
            transcription=transcription,
            created_at=datetime.utcnow()
        )
    
    def get_voice_dimension(self, dimension: str) -> float:
        """Get a specific voice dimension score"""
        return self.voice_signature.get(dimension, 0.0)
    
    def update_voice_signature(self, new_signature: Dict[str, float]) -> None:
        """Update the voice signature with new analysis"""
        self.voice_signature.update(new_signature)
        self.updated_at = datetime.utcnow()
    
    def get_formality_level(self) -> str:
        """Get human-readable formality level"""
        formality = self.get_voice_dimension("formality_level")
        if formality > 0.7:
            return "Very Formal"
        elif formality > 0.3:
            return "Professional"
        else:
            return "Casual"
    
    def get_communication_style_summary(self) -> Dict[str, str]:
        """Get a summary of key communication style characteristics"""
        return {
            "formality": self.get_formality_level(),
            "storytelling": "High" if self.get_voice_dimension("storytelling_style") > 0.6 else 
                          "Medium" if self.get_voice_dimension("storytelling_style") > 0.3 else "Low",
            "technical_depth": "High" if self.get_voice_dimension("technical_depth") > 0.6 else
                             "Medium" if self.get_voice_dimension("technical_depth") > 0.3 else "Low",
            "emotional_expression": "High" if self.get_voice_dimension("emotional_expressiveness") > 0.6 else
                                  "Medium" if self.get_voice_dimension("emotional_expressiveness") > 0.3 else "Low",
            "authority_tone": "Strong" if self.get_voice_dimension("authority_tone") > 0.6 else
                            "Balanced" if self.get_voice_dimension("authority_tone") > 0.3 else "Humble"
        }
    
    def is_suitable_for_content_type(self, content_type: str) -> bool:
        """Check if this voice profile is suitable for a specific content type"""
        content_requirements = {
            "story": {"storytelling_style": 0.4, "personal_experience_sharing": 0.3},
            "technical_article": {"technical_depth": 0.5, "formality_level": 0.4},
            "thought_leadership": {"authority_tone": 0.5, "industry_jargon": 0.3},
            "personal_update": {"personal_experience_sharing": 0.4, "emotional_expressiveness": 0.3}
        }
        
        requirements = content_requirements.get(content_type, {})
        
        for dimension, min_score in requirements.items():
            if self.get_voice_dimension(dimension) < min_score:
                return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        return {
            "id": str(self.id) if self.id else None,
            "user_id": str(self.user_id),
            "voice_signature": self.voice_signature,
            "context_mappings": self.context_mappings,
            "confidence_score": self.confidence_score,
            "analysis_metadata": self.analysis_metadata,
            "recording_file_url": self.recording_file_url,
            "transcription": self.transcription,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class VoiceProfileComparison(BaseModel):
    """Model for comparing two voice profiles"""
    
    profile1_id: UUID
    profile2_id: UUID
    overall_similarity: float = Field(..., ge=0.0, le=1.0)
    dimension_similarities: Dict[str, float]
    differences: Dict[str, float]
    recommendation: Optional[str] = None
    
    @classmethod
    def compare_profiles(cls, profile1: VoiceProfile, profile2: VoiceProfile) -> "VoiceProfileComparison":
        """Compare two voice profiles and return similarity analysis"""
        dimension_similarities = {}
        differences = {}
        
        # Compare each dimension
        all_dimensions = set(profile1.voice_signature.keys()) | set(profile2.voice_signature.keys())
        
        similarities = []
        for dimension in all_dimensions:
            score1 = profile1.get_voice_dimension(dimension)
            score2 = profile2.get_voice_dimension(dimension)
            
            diff = abs(score1 - score2)
            similarity = 1.0 - diff
            
            dimension_similarities[dimension] = similarity
            differences[dimension] = diff
            similarities.append(similarity)
        
        overall_similarity = sum(similarities) / len(similarities) if similarities else 0.0
        
        # Generate recommendation
        recommendation = None
        if overall_similarity > 0.8:
            recommendation = "Very similar communication styles - content can be highly consistent"
        elif overall_similarity > 0.6:
            recommendation = "Similar styles with some variation - good for content diversity"
        elif overall_similarity > 0.4:
            recommendation = "Moderate differences - consider adapting content approach"
        else:
            recommendation = "Significant style differences - may need separate content strategies"
        
        return cls(
            profile1_id=profile1.user_id,
            profile2_id=profile2.user_id,
            overall_similarity=overall_similarity,
            dimension_similarities=dimension_similarities,
            differences=differences,
            recommendation=recommendation
        )
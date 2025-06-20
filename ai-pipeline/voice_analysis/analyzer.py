import asyncio
import re
import statistics
from typing import Dict, List, Any, Tuple
from datetime import datetime
from collections import Counter

import spacy
import openai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

from utils.config import settings, VOICE_ANALYSIS_WEIGHTS, INDUSTRY_VOICE_ADJUSTMENTS
from utils.logger import AIProcessingLogger

class VoiceAnalyzer(AIProcessingLogger):
    """Service for analyzing communication style from transcriptions"""
    
    def __init__(self):
        super().__init__()
        self.nlp = None
        self.openai_client = None
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize NLP models and clients"""
        try:
            # Load spaCy model
            self.nlp = spacy.load(settings.spacy_model)
            self.logger.info("spaCy model loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load spaCy model: {e}")
        
        try:
            # Initialize OpenAI client
            if settings.openai_api_key:
                self.openai_client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
                self.logger.info("OpenAI client initialized")
            else:
                self.logger.warning("OpenAI API key not configured")
        except Exception as e:
            self.logger.error(f"Failed to initialize OpenAI client: {e}")
    
    async def analyze_voice(self, conversation_data: List[Dict], user_id: str) -> Dict[str, Any]:
        """
        Analyze voice from conversation transcriptions
        
        Args:
            conversation_data: List of transcription data with questions and responses
            user_id: User ID for logging
            
        Returns:
            Dictionary containing voice signature and analysis metadata
        """
        start_time = datetime.utcnow()
        
        self.log_voice_analysis_start(
            user_id, 
            conversation_data[0].get("metadata", {}).get("conversation_id", "unknown"),
            len(conversation_data)
        )
        
        try:
            # Combine all transcriptions
            full_text = self._combine_transcriptions(conversation_data)
            
            if len(full_text) < settings.min_transcription_length:
                raise Exception(f"Insufficient text for analysis: {len(full_text)} characters")
            
            # Perform multiple analysis dimensions
            linguistic_analysis = await self._analyze_linguistic_patterns(full_text)
            style_analysis = await self._analyze_communication_style(full_text, conversation_data)
            emotional_analysis = await self._analyze_emotional_patterns(full_text)
            ai_enhanced_analysis = await self._ai_enhanced_analysis(full_text, conversation_data)
            
            # Combine analyses into voice signature
            voice_signature = self._create_voice_signature(
                linguistic_analysis,
                style_analysis, 
                emotional_analysis,
                ai_enhanced_analysis
            )
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence_score(
                voice_signature, 
                len(full_text),
                len(conversation_data)
            )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            self.log_voice_analysis_complete(
                user_id,
                processing_time,
                confidence_score,
                len(voice_signature)
            )
            
            return {
                "voice_signature": voice_signature,
                "confidence_score": confidence_score,
                "processing_details": {
                    "text_length": len(full_text),
                    "conversation_turns": len(conversation_data),
                    "analysis_dimensions": len(voice_signature),
                    "processing_time": processing_time
                }
            }
            
        except Exception as e:
            self.log_operation_error("voice_analysis", e, user_id=user_id)
            raise
    
    def _combine_transcriptions(self, conversation_data: List[Dict]) -> str:
        """Combine all transcriptions into single text"""
        combined = []
        for item in conversation_data:
            transcription = item.get("transcription", "").strip()
            if transcription:
                combined.append(transcription)
        return " ".join(combined)
    
    async def _analyze_linguistic_patterns(self, text: str) -> Dict[str, float]:
        """Analyze linguistic patterns using spaCy"""
        if not self.nlp:
            return {}
        
        try:
            doc = self.nlp(text)
            
            # Calculate various linguistic metrics
            total_tokens = len(doc)
            
            # Sentence complexity
            sentences = list(doc.sents)
            avg_sentence_length = statistics.mean([len(sent) for sent in sentences]) if sentences else 0
            
            # Part of speech distribution
            pos_counts = Counter([token.pos_ for token in doc if not token.is_space])
            
            # Calculate ratios
            adj_ratio = pos_counts.get('ADJ', 0) / total_tokens if total_tokens > 0 else 0
            adv_ratio = pos_counts.get('ADV', 0) / total_tokens if total_tokens > 0 else 0
            verb_ratio = pos_counts.get('VERB', 0) / total_tokens if total_tokens > 0 else 0
            noun_ratio = pos_counts.get('NOUN', 0) / total_tokens if total_tokens > 0 else 0
            
            # Named entities (industry jargon indicator)
            entities = [ent.label_ for ent in doc.ents]
            entity_density = len(entities) / total_tokens if total_tokens > 0 else 0
            
            # Technical terms (approximation using long words and specific patterns)
            technical_words = [
                token.text for token in doc 
                if len(token.text) > 8 and token.pos_ in ['NOUN', 'ADJ'] and not token.is_stop
            ]
            technical_density = len(technical_words) / total_tokens if total_tokens > 0 else 0
            
            return {
                "avg_sentence_length": avg_sentence_length,
                "adjective_ratio": adj_ratio,
                "adverb_ratio": adv_ratio,
                "verb_ratio": verb_ratio,
                "noun_ratio": noun_ratio,
                "entity_density": entity_density,
                "technical_density": technical_density
            }
            
        except Exception as e:
            self.logger.error(f"Linguistic analysis failed: {e}")
            return {}
    
    async def _analyze_communication_style(self, text: str, conversation_data: List[Dict]) -> Dict[str, float]:
        """Analyze communication style patterns"""
        try:
            # Question asking tendency
            question_count = len(re.findall(r'\?', text))
            question_ratio = question_count / len(text.split('.')) if text.split('.') else 0
            
            # Personal experience sharing (first person indicators)
            first_person_pronouns = len(re.findall(r'\b(I|my|me|myself|we|us|our)\b', text, re.IGNORECASE))
            personal_experience_ratio = first_person_pronouns / len(text.split()) if text.split() else 0
            
            # Storytelling indicators
            story_indicators = [
                r'\b(when|then|after|before|during|while)\b',
                r'\b(happened|experience|remember|time)\b',
                r'\b(first|last|next|finally)\b'
            ]
            story_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE)) 
                for pattern in story_indicators
            ) / len(text.split()) if text.split() else 0
            
            # Authority tone indicators
            authority_indicators = [
                r'\b(should|must|need to|important|critical|essential)\b',
                r'\b(recommend|suggest|advise|propose)\b',
                r'\b(believe|think|know|understand)\b'
            ]
            authority_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in authority_indicators
            ) / len(text.split()) if text.split() else 0
            
            # Empathy indicators
            empathy_indicators = [
                r'\b(understand|feel|empathize|relate|appreciate)\b',
                r'\b(challenge|difficult|struggle|help|support)\b'
            ]
            empathy_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in empathy_indicators
            ) / len(text.split()) if text.split() else 0
            
            # Humor indicators (basic approximation)
            humor_indicators = [
                r'\b(funny|humor|joke|lol|haha)\b',
                r'[!]{2,}',  # Multiple exclamation marks
                r'😄|😂|🤣|😊|😃'  # Emojis (if present)
            ]
            humor_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in humor_indicators
            ) / len(text.split()) if text.split() else 0
            
            # Call to action patterns
            cta_indicators = [
                r'\b(let|try|start|join|share|comment|thoughts)\b',
                r'\b(what do you|how do you|have you)\b'
            ]
            cta_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in cta_indicators
            ) / len(text.split()) if text.split() else 0
            
            return {
                "question_asking_tendency": min(question_ratio * 5, 1.0),  # Normalize to 0-1
                "personal_experience_sharing": min(personal_experience_ratio * 3, 1.0),
                "storytelling_style": min(story_score * 10, 1.0),
                "authority_tone": min(authority_score * 5, 1.0),
                "empathy_level": min(empathy_score * 8, 1.0),
                "humor_usage": min(humor_score * 20, 1.0),
                "call_to_action_style": min(cta_score * 5, 1.0)
            }
            
        except Exception as e:
            self.logger.error(f"Communication style analysis failed: {e}")
            return {}
    
    async def _analyze_emotional_patterns(self, text: str) -> Dict[str, float]:
        """Analyze emotional expressiveness patterns"""
        try:
            # Emotional words detection
            positive_emotions = [
                r'\b(excited|thrilled|amazing|fantastic|love|passionate|incredible)\b',
                r'\b(happy|joy|delighted|pleased|wonderful|excellent)\b'
            ]
            
            negative_emotions = [
                r'\b(frustrated|disappointed|angry|sad|terrible|awful)\b',
                r'\b(worried|concerned|anxious|stressed|overwhelmed)\b'
            ]
            
            vulnerability_indicators = [
                r'\b(mistake|failed|wrong|difficult|challenge|admit)\b',
                r'\b(learned|growth|improve|better|change)\b'
            ]
            
            positive_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in positive_emotions
            )
            
            negative_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in negative_emotions
            )
            
            vulnerability_score = sum(
                len(re.findall(pattern, text, re.IGNORECASE))
                for pattern in vulnerability_indicators
            )
            
            total_words = len(text.split())
            
            return {
                "emotional_expressiveness": min((positive_score + negative_score) / total_words * 20, 1.0) if total_words > 0 else 0,
                "vulnerability_comfort": min(vulnerability_score / total_words * 15, 1.0) if total_words > 0 else 0
            }
            
        except Exception as e:
            self.logger.error(f"Emotional analysis failed: {e}")
            return {}
    
    async def _ai_enhanced_analysis(self, text: str, conversation_data: List[Dict]) -> Dict[str, float]:
        """Use AI to enhance analysis with deeper insights"""
        if not self.openai_client:
            return {}
        
        try:
            # Create analysis prompt
            prompt = f"""
            Analyze the following professional communication sample and rate each dimension on a scale of 0.0 to 1.0:
            
            Text: "{text[:2000]}..."  # Limit text length for API
            
            Please analyze and provide scores for:
            1. formality_level (0.0 = very casual, 1.0 = very formal)
            2. technical_depth (0.0 = basic language, 1.0 = highly technical)
            3. communication_pace (0.0 = slow/methodical, 1.0 = fast/energetic)
            4. explanation_style (0.0 = brief/direct, 1.0 = detailed/thorough)
            5. industry_jargon (0.0 = general language, 1.0 = heavy jargon use)
            
            Respond with only a JSON object containing the scores:
            {{"formality_level": 0.0, "technical_depth": 0.0, "communication_pace": 0.0, "explanation_style": 0.0, "industry_jargon": 0.0}}
            """
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert in communication style analysis. Provide accurate numerical assessments."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.1  # Low temperature for consistent analysis
            )
            
            # Parse response
            response_text = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            import json
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                ai_scores = json.loads(json_str)
                
                # Validate and clamp scores
                validated_scores = {}
                for key, value in ai_scores.items():
                    if isinstance(value, (int, float)):
                        validated_scores[key] = max(0.0, min(1.0, float(value)))
                
                self.log_model_usage(
                    "gpt-4",
                    len(prompt.split()),
                    len(response_text.split()),
                    None  # Cost calculation would go here
                )
                
                return validated_scores
            
            return {}
            
        except Exception as e:
            self.logger.error(f"AI enhanced analysis failed: {e}")
            return {}
    
    def _create_voice_signature(self, *analyses) -> Dict[str, float]:
        """Combine all analyses into comprehensive voice signature"""
        voice_signature = {}
        
        # Combine all analysis results
        combined_data = {}
        for analysis in analyses:
            combined_data.update(analysis)
        
        # Map to standardized voice dimensions
        dimension_mappings = {
            "formality_level": combined_data.get("formality_level", 0.5),
            "emotional_expressiveness": combined_data.get("emotional_expressiveness", 0.3),
            "technical_depth": combined_data.get("technical_depth", combined_data.get("technical_density", 0) * 2),
            "storytelling_style": combined_data.get("storytelling_style", 0.3),
            "authority_tone": combined_data.get("authority_tone", 0.4),
            "empathy_level": combined_data.get("empathy_level", 0.4),
            "humor_usage": combined_data.get("humor_usage", 0.1),
            "vulnerability_comfort": combined_data.get("vulnerability_comfort", 0.3),
            "industry_jargon": combined_data.get("industry_jargon", combined_data.get("entity_density", 0) * 3),
            "communication_pace": combined_data.get("communication_pace", 0.5),
            "explanation_style": combined_data.get("explanation_style", combined_data.get("avg_sentence_length", 15) / 30),
            "question_asking_tendency": combined_data.get("question_asking_tendency", 0.2),
            "call_to_action_style": combined_data.get("call_to_action_style", 0.3),
            "personal_experience_sharing": combined_data.get("personal_experience_sharing", 0.4)
        }
        
        # Ensure all scores are between 0 and 1
        for dimension, score in dimension_mappings.items():
            voice_signature[dimension] = max(0.0, min(1.0, float(score)))
        
        return voice_signature
    
    def _calculate_confidence_score(self, voice_signature: Dict[str, float], 
                                  text_length: int, conversation_turns: int) -> float:
        """Calculate confidence score for voice analysis"""
        try:
            # Base confidence factors
            length_factor = min(text_length / 1000, 1.0)  # Full confidence at 1000+ characters
            turns_factor = min(conversation_turns / 5, 1.0)  # Full confidence at 5+ turns
            
            # Dimension completeness factor
            expected_dimensions = len(settings.voice_dimensions)
            actual_dimensions = len([v for v in voice_signature.values() if v > 0])
            completeness_factor = actual_dimensions / expected_dimensions
            
            # Consistency factor (check for extreme outliers)
            scores = list(voice_signature.values())
            score_variance = statistics.variance(scores) if len(scores) > 1 else 0
            consistency_factor = max(0.5, 1.0 - score_variance)  # Lower variance = higher consistency
            
            # Calculate weighted confidence
            confidence = (
                length_factor * 0.3 +
                turns_factor * 0.2 +
                completeness_factor * 0.3 +
                consistency_factor * 0.2
            )
            
            return max(0.0, min(1.0, confidence))
            
        except Exception as e:
            self.logger.error(f"Confidence calculation failed: {e}")
            return 0.5  # Default moderate confidence
    
    def apply_industry_adjustments(self, voice_signature: Dict[str, float], 
                                 industry: str) -> Dict[str, float]:
        """Apply industry-specific adjustments to voice signature"""
        if industry not in INDUSTRY_VOICE_ADJUSTMENTS:
            return voice_signature
        
        adjustments = INDUSTRY_VOICE_ADJUSTMENTS[industry]
        adjusted_signature = voice_signature.copy()
        
        for dimension, multiplier in adjustments.items():
            if dimension in adjusted_signature:
                adjusted_value = adjusted_signature[dimension] * multiplier
                adjusted_signature[dimension] = max(0.0, min(1.0, adjusted_value))
        
        return adjusted_signature
    
    async def compare_voice_profiles(self, profile1: Dict[str, float], 
                                   profile2: Dict[str, float]) -> Dict[str, Any]:
        """Compare two voice profiles and calculate similarity"""
        try:
            # Calculate cosine similarity
            common_dimensions = set(profile1.keys()) & set(profile2.keys())
            
            if not common_dimensions:
                return {"similarity": 0.0, "comparison": {}}
            
            vector1 = np.array([profile1[dim] for dim in common_dimensions])
            vector2 = np.array([profile2[dim] for dim in common_dimensions])
            
            similarity = cosine_similarity([vector1], [vector2])[0][0]
            
            # Detailed dimension comparison
            dimension_comparison = {}
            for dim in common_dimensions:
                diff = abs(profile1[dim] - profile2[dim])
                dimension_comparison[dim] = {
                    "profile1": profile1[dim],
                    "profile2": profile2[dim],
                    "difference": diff,
                    "similarity": 1.0 - diff
                }
            
            return {
                "overall_similarity": float(similarity),
                "dimension_comparison": dimension_comparison,
                "common_dimensions": len(common_dimensions)
            }
            
        except Exception as e:
            self.logger.error(f"Voice profile comparison failed: {e}")
            return {"similarity": 0.0, "comparison": {}}
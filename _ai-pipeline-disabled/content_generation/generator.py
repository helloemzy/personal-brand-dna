import asyncio
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import random

import openai
from utils.config import settings, CONTENT_QUALITY_WEIGHTS, LINKEDIN_OPTIMIZATION
from utils.logger import AIProcessingLogger

class ContentGenerator(AIProcessingLogger):
    """Service for generating personalized content based on voice signatures"""
    
    def __init__(self):
        super().__init__()
        self.openai_client = None
        self._initialize_client()
        
    def _initialize_client(self):
        """Initialize OpenAI client"""
        try:
            if settings.openai_api_key:
                self.openai_client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
                self.logger.info("OpenAI client initialized for content generation")
            else:
                self.logger.warning("OpenAI API key not configured")
        except Exception as e:
            self.logger.error(f"Failed to initialize OpenAI client: {e}")
    
    async def generate_content(self, topic: str, content_type: str, voice_signature: Dict[str, float],
                             user_profile: Dict[str, Any], template: Optional[Dict] = None,
                             preferences: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Generate personalized content based on voice signature
        
        Args:
            topic: Content topic or subject
            content_type: Type of content (post, article, story, etc.)
            voice_signature: User's voice profile
            user_profile: User information (industry, role, etc.)
            template: Optional content template
            preferences: User preferences for generation
            
        Returns:
            Dictionary containing generated content and metadata
        """
        start_time = datetime.utcnow()
        preferences = preferences or {}
        
        self.log_content_generation_start(
            user_profile.get("userId", "unknown"),
            topic,
            content_type
        )
        
        try:
            # Build comprehensive prompt
            generation_prompt = await self._build_generation_prompt(
                topic, content_type, voice_signature, user_profile, template, preferences
            )
            
            # Generate primary content
            primary_content = await self._generate_with_openai(
                generation_prompt,
                voice_signature,
                content_type
            )
            
            # Generate variations if requested
            variations = []
            if preferences.get("generate_variations", False):
                variations = await self._generate_variations(
                    primary_content,
                    generation_prompt,
                    voice_signature,
                    max_variations=preferences.get("max_variations", 2)
                )
            
            # Post-process and optimize content
            optimized_content = self._optimize_content(
                primary_content,
                content_type,
                user_profile
            )
            
            # Calculate voice match score
            voice_match_score = self._calculate_voice_match_score(
                optimized_content,
                voice_signature
            )
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            self.log_content_generation_complete(
                user_profile.get("userId", "unknown"),
                processing_time,
                len(optimized_content),
                voice_match_score
            )
            
            return {
                "content": optimized_content,
                "variations": variations,
                "voice_match_score": voice_match_score,
                "template_id": template.get("id") if template else None,
                "model_used": settings.openai_model,
                "processing_details": {
                    "generation_time": processing_time,
                    "voice_dimensions_used": len(voice_signature),
                    "content_optimizations_applied": self._get_applied_optimizations(content_type)
                }
            }
            
        except Exception as e:
            self.log_operation_error("content_generation", e, user_id=user_profile.get("userId"))
            raise
    
    async def _build_generation_prompt(self, topic: str, content_type: str, 
                                     voice_signature: Dict[str, float],
                                     user_profile: Dict[str, Any],
                                     template: Optional[Dict] = None,
                                     preferences: Dict[str, Any] = None) -> str:
        """Build comprehensive prompt for content generation"""
        
        # Start with base prompt
        prompt_parts = [
            f"Generate a professional LinkedIn {content_type} about: {topic}",
            "",
            "VOICE PROFILE TO MATCH:"
        ]
        
        # Add voice signature details
        voice_description = self._voice_signature_to_description(voice_signature)
        prompt_parts.append(voice_description)
        
        # Add user context
        if user_profile:
            prompt_parts.extend([
                "",
                "USER CONTEXT:",
                f"Industry: {user_profile.get('industry', 'Business')}",
                f"Role: {user_profile.get('role', 'Professional')}",
                f"Company: {user_profile.get('company', '')}" if user_profile.get('company') else ""
            ])
        
        # Add template structure if provided
        if template and template.get("structure"):
            prompt_parts.extend([
                "",
                "CONTENT STRUCTURE TO FOLLOW:",
                template["structure"]
            ])
        
        # Add preferences and constraints
        if preferences:
            constraints = []
            
            if preferences.get("urgency") == "high":
                constraints.append("Create with urgent, timely relevance")
            
            if preferences.get("includePersonalExperience"):
                constraints.append("Include personal experience or story elements")
            
            if preferences.get("targetAudience"):
                constraints.append(f"Target audience: {preferences['targetAudience']}")
            
            if preferences.get("callToAction"):
                constraints.append(f"Include this call to action: {preferences['callToAction']}")
            
            if constraints:
                prompt_parts.extend(["", "SPECIFIC REQUIREMENTS:"] + constraints)
        
        # Add LinkedIn optimization guidelines
        linkedin_guidelines = self._get_linkedin_guidelines(content_type)
        prompt_parts.extend(["", "LINKEDIN OPTIMIZATION:"] + linkedin_guidelines)
        
        # Add final instructions
        prompt_parts.extend([
            "",
            "IMPORTANT INSTRUCTIONS:",
            "- Match the voice profile characteristics precisely",
            "- Keep the content authentic and genuine",
            "- Focus on providing value to the audience",
            "- Use the specified tone and communication style",
            "- Ensure the content drives engagement and business outcomes",
            "",
            "Generate the content now:"
        ])
        
        return "\n".join(filter(None, prompt_parts))
    
    def _voice_signature_to_description(self, voice_signature: Dict[str, float]) -> str:
        """Convert voice signature scores to descriptive text"""
        descriptions = []
        
        # Formality level
        formality = voice_signature.get("formality_level", 0.5)
        if formality > 0.7:
            descriptions.append("Very formal and professional tone")
        elif formality > 0.3:
            descriptions.append("Balanced professional tone")
        else:
            descriptions.append("Casual and approachable tone")
        
        # Emotional expressiveness
        emotion = voice_signature.get("emotional_expressiveness", 0.3)
        if emotion > 0.6:
            descriptions.append("Highly expressive and emotionally engaging")
        elif emotion > 0.3:
            descriptions.append("Moderately expressive with emotional connection")
        else:
            descriptions.append("Reserved and measured emotional expression")
        
        # Technical depth
        technical = voice_signature.get("technical_depth", 0.3)
        if technical > 0.6:
            descriptions.append("Uses technical language and industry expertise")
        elif technical > 0.3:
            descriptions.append("Balances technical concepts with accessibility")
        else:
            descriptions.append("Uses simple, accessible language")
        
        # Storytelling style
        storytelling = voice_signature.get("storytelling_style", 0.3)
        if storytelling > 0.6:
            descriptions.append("Strong storytelling with narrative elements")
        elif storytelling > 0.3:
            descriptions.append("Incorporates some story elements")
        else:
            descriptions.append("Direct and factual communication")
        
        # Authority tone
        authority = voice_signature.get("authority_tone", 0.4)
        if authority > 0.6:
            descriptions.append("Confident and authoritative voice")
        elif authority > 0.3:
            descriptions.append("Balanced confidence and humility")
        else:
            descriptions.append("Humble and questioning approach")
        
        # Personal experience sharing
        personal = voice_signature.get("personal_experience_sharing", 0.4)
        if personal > 0.6:
            descriptions.append("Frequently shares personal experiences and insights")
        elif personal > 0.3:
            descriptions.append("Occasionally includes personal anecdotes")
        else:
            descriptions.append("Focuses on general insights rather than personal stories")
        
        return "- " + "\n- ".join(descriptions)
    
    def _get_linkedin_guidelines(self, content_type: str) -> List[str]:
        """Get LinkedIn-specific optimization guidelines"""
        guidelines = [
            "Start with an engaging hook in the first line",
            "Use line breaks for better readability",
            "Include relevant hashtags (3-5 recommended)",
            "End with a call-to-action or question"
        ]
        
        # Content type specific guidelines
        if content_type == "post":
            guidelines.extend([
                "Keep length between 150-300 words for optimal engagement",
                "Use emojis sparingly and professionally",
                "Consider using bullets or numbered lists"
            ])
        elif content_type == "article":
            guidelines.extend([
                "Aim for 1000-2000 words for comprehensive coverage",
                "Include subheadings for structure",
                "Add a compelling conclusion"
            ])
        elif content_type == "story":
            guidelines.extend([
                "Focus on narrative structure with clear beginning, middle, end",
                "Include emotional elements and lessons learned",
                "Keep between 200-400 words"
            ])
        
        return guidelines
    
    async def _generate_with_openai(self, prompt: str, voice_signature: Dict[str, float],
                                  content_type: str) -> str:
        """Generate content using OpenAI API"""
        if not self.openai_client:
            raise Exception("OpenAI client not initialized")
        
        try:
            # Adjust parameters based on voice signature
            temperature = self._calculate_temperature(voice_signature)
            max_tokens = self._calculate_max_tokens(content_type)
            
            response = await self.openai_client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert LinkedIn content creator who specializes in matching individual communication styles. Create authentic, engaging content that drives business outcomes."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                frequency_penalty=0.3,  # Reduce repetition
                presence_penalty=0.1    # Encourage topic exploration
            )
            
            content = response.choices[0].message.content.strip()
            
            # Log model usage
            self.log_model_usage(
                settings.openai_model,
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
                None  # Cost calculation would go here
            )
            
            return content
            
        except Exception as e:
            self.logger.error(f"OpenAI content generation failed: {e}")
            raise
    
    def _calculate_temperature(self, voice_signature: Dict[str, float]) -> float:
        """Calculate temperature based on voice signature"""
        # Higher creativity for more expressive voices
        expressiveness = voice_signature.get("emotional_expressiveness", 0.3)
        humor = voice_signature.get("humor_usage", 0.1)
        storytelling = voice_signature.get("storytelling_style", 0.3)
        
        creativity_score = (expressiveness + humor + storytelling) / 3
        
        # Map to temperature range (0.3 to 0.9)
        temperature = 0.3 + (creativity_score * 0.6)
        return min(0.9, max(0.3, temperature))
    
    def _calculate_max_tokens(self, content_type: str) -> int:
        """Calculate max tokens based on content type"""
        token_limits = {
            "post": 500,
            "article": 2000,
            "story": 600,
            "poll": 300,
            "carousel": 400
        }
        return token_limits.get(content_type, 500)
    
    async def _generate_variations(self, primary_content: str, original_prompt: str,
                                 voice_signature: Dict[str, float], max_variations: int = 2) -> List[str]:
        """Generate variations of the primary content"""
        if not self.openai_client or max_variations <= 0:
            return []
        
        variations = []
        
        for i in range(max_variations):
            try:
                # Create variation prompt
                variation_prompt = f"""
                Based on this original content:
                "{primary_content}"
                
                Create a variation that:
                - Maintains the same voice and tone
                - Covers the same topic with a different angle or approach
                - Keeps the same approximate length
                - Remains authentic to the communication style
                
                Variation #{i+1}:
                """
                
                # Slightly adjust temperature for variation
                temperature = self._calculate_temperature(voice_signature) + 0.1
                
                response = await self.openai_client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[
                        {
                            "role": "system",
                            "content": "Create content variations that maintain voice consistency while offering different perspectives."
                        },
                        {
                            "role": "user",
                            "content": variation_prompt
                        }
                    ],
                    max_tokens=len(primary_content.split()) * 2,  # Proportional to original
                    temperature=min(0.9, temperature)
                )
                
                variation = response.choices[0].message.content.strip()
                variations.append(variation)
                
                # Small delay to avoid rate limits
                await asyncio.sleep(0.5)
                
            except Exception as e:
                self.logger.error(f"Failed to generate variation {i+1}: {e}")
                continue
        
        return variations
    
    def _optimize_content(self, content: str, content_type: str, user_profile: Dict[str, Any]) -> str:
        """Apply content optimizations for LinkedIn"""
        optimized = content
        
        # Ensure proper line breaks for readability
        optimized = self._add_line_breaks(optimized)
        
        # Optimize hashtags
        optimized = self._optimize_hashtags(optimized, user_profile.get("industry", "business"))
        
        # Ensure call-to-action
        optimized = self._ensure_call_to_action(optimized, content_type)
        
        # Format for LinkedIn
        optimized = self._format_for_linkedin(optimized, content_type)
        
        return optimized
    
    def _add_line_breaks(self, content: str) -> str:
        """Add appropriate line breaks for LinkedIn readability"""
        # Split into sentences
        sentences = re.split(r'[.!?]+', content)
        
        # Group sentences into paragraphs (2-3 sentences each)
        paragraphs = []
        current_paragraph = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                current_paragraph.append(sentence)
                
                # Create paragraph break after 2-3 sentences
                if len(current_paragraph) >= 2:
                    paragraphs.append('. '.join(current_paragraph) + '.')
                    current_paragraph = []
        
        # Add remaining sentences
        if current_paragraph:
            paragraphs.append('. '.join(current_paragraph) + '.')
        
        return '\n\n'.join(paragraphs)
    
    def _optimize_hashtags(self, content: str, industry: str) -> str:
        """Optimize hashtags for the content and industry"""
        # Industry-specific hashtag suggestions
        industry_hashtags = {
            "technology": ["#TechLeadership", "#Innovation", "#DigitalTransformation", "#TechTrends"],
            "finance": ["#FinTech", "#FinancialServices", "#InvestmentStrategy", "#EconomicInsights"],
            "healthcare": ["#HealthcareInnovation", "#MedicalLeadership", "#PatientCare", "#HealthTech"],
            "marketing": ["#MarketingStrategy", "#DigitalMarketing", "#BrandBuilding", "#MarketingInsights"],
            "consulting": ["#BusinessStrategy", "#Consulting", "#Leadership", "#BusinessTransformation"]
        }
        
        # Check if hashtags already exist
        existing_hashtags = re.findall(r'#\w+', content)
        
        if len(existing_hashtags) < 3:
            # Add relevant hashtags
            suggested_hashtags = industry_hashtags.get(industry.lower(), ["#Leadership", "#ProfessionalGrowth", "#BusinessInsights"])
            
            # Select hashtags not already present
            new_hashtags = []
            for hashtag in suggested_hashtags:
                if hashtag not in existing_hashtags and len(new_hashtags) < (5 - len(existing_hashtags)):
                    new_hashtags.append(hashtag)
            
            if new_hashtags:
                content += "\n\n" + " ".join(new_hashtags)
        
        return content
    
    def _ensure_call_to_action(self, content: str, content_type: str) -> str:
        """Ensure content has an appropriate call-to-action"""
        # Check if CTA already exists
        cta_patterns = [
            r'\b(what do you think|thoughts|share your|comment|let me know)\b',
            r'\?[^?]*$',  # Ends with a question
            r'\b(agree|disagree|experience)\b[^.]*\?'
        ]
        
        has_cta = any(re.search(pattern, content, re.IGNORECASE) for pattern in cta_patterns)
        
        if not has_cta:
            # Add appropriate CTA based on content type
            cta_options = {
                "post": [
                    "What's your experience with this?",
                    "Thoughts?",
                    "How do you handle this in your organization?",
                    "What would you add to this list?"
                ],
                "story": [
                    "Have you had a similar experience?",
                    "What lessons have you learned in similar situations?",
                    "How would you have handled this differently?"
                ],
                "article": [
                    "What strategies have worked best for you?",
                    "I'd love to hear your perspective on this.",
                    "What other factors would you consider important?"
                ]
            }
            
            options = cta_options.get(content_type, cta_options["post"])
            selected_cta = random.choice(options)
            
            content += f"\n\n{selected_cta}"
        
        return content
    
    def _format_for_linkedin(self, content: str, content_type: str) -> str:
        """Apply LinkedIn-specific formatting"""
        # Ensure hook is prominent (first line should be engaging)
        lines = content.split('\n')
        if lines and len(lines[0]) > 100:
            # If first line is too long, consider it for hook optimization
            first_sentence = lines[0].split('.')[0]
            if len(first_sentence) < 80:
                lines[0] = first_sentence + '.\n\n' + '.'.join(lines[0].split('.')[1:])
        
        formatted = '\n'.join(lines)
        
        # Ensure proper spacing around hashtags
        formatted = re.sub(r'(\w)#', r'\1 #', formatted)
        
        return formatted.strip()
    
    def _calculate_voice_match_score(self, content: str, voice_signature: Dict[str, float]) -> float:
        """Calculate how well the content matches the voice signature"""
        try:
            score_components = []
            
            # Check formality level
            formal_indicators = len(re.findall(r'\b(furthermore|therefore|consequently|moreover)\b', content, re.IGNORECASE))
            casual_indicators = len(re.findall(r'\b(btw|really|pretty|super|totally)\b', content, re.IGNORECASE))
            
            expected_formality = voice_signature.get("formality_level", 0.5)
            actual_formality = min(formal_indicators / 5, 1.0) if formal_indicators > casual_indicators else max(0, 1.0 - casual_indicators / 5)
            formality_match = 1.0 - abs(expected_formality - actual_formality)
            score_components.append(formality_match)
            
            # Check storytelling style
            story_indicators = len(re.findall(r'\b(when|then|after|experience|remember|time)\b', content, re.IGNORECASE))
            expected_storytelling = voice_signature.get("storytelling_style", 0.3)
            actual_storytelling = min(story_indicators / 10, 1.0)
            storytelling_match = 1.0 - abs(expected_storytelling - actual_storytelling)
            score_components.append(storytelling_match)
            
            # Check personal experience sharing
            personal_indicators = len(re.findall(r'\b(I|my|me|we|our)\b', content, re.IGNORECASE))
            expected_personal = voice_signature.get("personal_experience_sharing", 0.4)
            actual_personal = min(personal_indicators / 20, 1.0)
            personal_match = 1.0 - abs(expected_personal - actual_personal)
            score_components.append(personal_match)
            
            # Average the components
            return sum(score_components) / len(score_components) if score_components else 0.5
            
        except Exception as e:
            self.logger.error(f"Voice match calculation failed: {e}")
            return 0.5
    
    def _get_applied_optimizations(self, content_type: str) -> List[str]:
        """Get list of optimizations applied to content"""
        return [
            "LinkedIn formatting",
            "Hashtag optimization", 
            "Call-to-action enhancement",
            "Readability improvements",
            f"{content_type.title()}-specific structure"
        ]
    
    async def batch_generate_content(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate multiple content pieces in batch"""
        if len(requests) > 10:
            raise Exception("Maximum 10 content requests per batch")
        
        self.log_operation_start("batch_content_generation", batch_size=len(requests))
        
        start_time = datetime.utcnow()
        
        # Create generation tasks
        tasks = []
        for request in requests:
            task = self.generate_content(
                topic=request["topic"],
                content_type=request.get("content_type", "post"),
                voice_signature=request["voice_signature"],
                user_profile=request["user_profile"],
                template=request.get("template"),
                preferences=request.get("preferences", {})
            )
            tasks.append(task)
        
        try:
            # Execute in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            successful = []
            failed = []
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    failed.append({
                        "request_index": i,
                        "error": str(result)
                    })
                else:
                    successful.append({
                        "request_index": i,
                        "result": result
                    })
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            self.log_operation_end(
                "batch_content_generation",
                processing_time,
                successful_count=len(successful),
                failed_count=len(failed)
            )
            
            return {
                "successful": successful,
                "failed": failed,
                "total_processed": len(results),
                "processing_time": processing_time
            }
            
        except Exception as e:
            self.log_operation_error("batch_content_generation", e)
            raise
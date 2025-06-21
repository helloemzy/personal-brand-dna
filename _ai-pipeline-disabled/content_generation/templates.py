import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import asyncpg

from utils.config import settings
from utils.logger import AIProcessingLogger


class TemplateManager(AIProcessingLogger):
    """Manager for content templates and template-based generation"""
    
    def __init__(self):
        super().__init__()
        self.template_cache = {}
        self.cache_expiry = {}
        self.cache_ttl = 3600  # 1 hour cache TTL
    
    async def get_templates(self, content_type: Optional[str] = None,
                          industry: Optional[str] = None, 
                          use_case: Optional[str] = None,
                          db_connection: Optional[asyncpg.Connection] = None) -> List[Dict[str, Any]]:
        """
        Get available content templates with optional filtering
        
        Args:
            content_type: Filter by content type (post, article, story, etc.)
            industry: Filter by industry tags
            use_case: Filter by use case (thought_leadership, personal_story, etc.)
            db_connection: Database connection for fetching templates
            
        Returns:
            List of matching templates
        """
        try:
            cache_key = f"templates_{content_type}_{industry}_{use_case}"
            
            # Check cache first
            if self._is_cache_valid(cache_key):
                self.logger.info(f"Cache hit for templates: {cache_key}")
                return self.template_cache[cache_key]
            
            # Build query filters
            query_filters = []
            query_params = []
            param_count = 1
            
            base_query = """
                SELECT id, name, description, content_type, template_structure, 
                       variables, industry_tags, use_case, created_at
                FROM content_templates
            """
            
            if content_type:
                query_filters.append(f"content_type = ${param_count}")
                query_params.append(content_type)
                param_count += 1
            
            if industry:
                query_filters.append(f"${param_count} = ANY(industry_tags)")
                query_params.append(industry)
                param_count += 1
            
            if use_case:
                query_filters.append(f"use_case = ${param_count}")
                query_params.append(use_case)
                param_count += 1
            
            # Construct final query
            if query_filters:
                final_query = base_query + " WHERE " + " AND ".join(query_filters)
            else:
                final_query = base_query
            
            final_query += " ORDER BY created_at DESC"
            
            # Execute query if database connection available
            templates = []
            if db_connection:
                try:
                    rows = await db_connection.fetch(final_query, *query_params)
                    templates = [dict(row) for row in rows]
                except Exception as e:
                    self.logger.error(f"Database query failed: {e}")
                    # Fall back to default templates
                    templates = self._get_default_templates()
            else:
                # Use default templates when no DB connection
                templates = self._get_default_templates()
                
                # Apply filters to default templates
                if content_type:
                    templates = [t for t in templates if t.get("content_type") == content_type]
                if industry:
                    templates = [t for t in templates if industry in t.get("industry_tags", [])]
                if use_case:
                    templates = [t for t in templates if t.get("use_case") == use_case]
            
            # Cache results
            self.template_cache[cache_key] = templates
            self.cache_expiry[cache_key] = datetime.utcnow().timestamp() + self.cache_ttl
            
            self.logger.info(f"Retrieved {len(templates)} templates for filters: {cache_key}")
            return templates
            
        except Exception as e:
            self.logger.error(f"Failed to get templates: {e}")
            return self._get_default_templates()
    
    def _get_default_templates(self) -> List[Dict[str, Any]]:
        """Get default template set when database is unavailable"""
        return [
            {
                "id": "professional_insight",
                "name": "Professional Insight",
                "description": "Share a professional insight or lesson learned",
                "content_type": "post",
                "template_structure": """{{hook_question}}

Here's what I've learned: {{main_insight}}

{{supporting_details}}

{{call_to_action}}

What's your experience with this? 👇""",
                "variables": {
                    "hook_question": {"type": "string", "description": "Engaging question to start"},
                    "main_insight": {"type": "string", "description": "Core lesson or insight"},
                    "supporting_details": {"type": "string", "description": "Details and examples"},
                    "call_to_action": {"type": "string", "description": "Engagement prompt"}
                },
                "industry_tags": ["technology", "business", "marketing", "finance"],
                "use_case": "thought_leadership"
            },
            {
                "id": "personal_story",
                "name": "Personal Story",
                "description": "Share a personal experience with professional relevance",
                "content_type": "post",
                "template_structure": """{{time_context}} ago, {{situation_setup}}

{{challenge_faced}}

Here's what happened: {{story_development}}

The lesson? {{key_takeaway}}

{{broader_application}}""",
                "variables": {
                    "time_context": {"type": "string", "description": "When this happened"},
                    "situation_setup": {"type": "string", "description": "Context of the situation"},
                    "challenge_faced": {"type": "string", "description": "What challenge you faced"},
                    "story_development": {"type": "string", "description": "How the situation unfolded"},
                    "key_takeaway": {"type": "string", "description": "Main lesson learned"},
                    "broader_application": {"type": "string", "description": "How others can apply this"}
                },
                "industry_tags": ["leadership", "career", "entrepreneurship"],
                "use_case": "personal_story"
            },
            {
                "id": "industry_commentary",
                "name": "Industry Commentary",
                "description": "Comment on industry trends or news",
                "content_type": "post",
                "template_structure": """{{trend_observation}}

Why this matters: {{significance}}

{{personal_perspective}}

My prediction: {{future_outlook}}

Thoughts? What are you seeing in your experience?""",
                "variables": {
                    "trend_observation": {"type": "string", "description": "What trend you're commenting on"},
                    "significance": {"type": "string", "description": "Why this trend is important"},
                    "personal_perspective": {"type": "string", "description": "Your unique take on it"},
                    "future_outlook": {"type": "string", "description": "Where you see this heading"}
                },
                "industry_tags": ["technology", "business", "marketing", "finance"],
                "use_case": "thought_leadership"
            },
            {
                "id": "career_milestone",
                "name": "Career Milestone Achievement",
                "description": "Celebrate a career achievement or milestone",
                "content_type": "post",
                "template_structure": """🎉 {{achievement_announcement}}

{{journey_reflection}}

Key takeaways from this experience:
{{key_learnings}}

{{gratitude_section}}

{{future_focus}}

#CareerGrowth #Achievement""",
                "variables": {
                    "achievement_announcement": {"type": "string", "description": "The achievement being celebrated"},
                    "journey_reflection": {"type": "string", "description": "Brief reflection on the journey"},
                    "key_learnings": {"type": "string", "description": "What was learned along the way"},
                    "gratitude_section": {"type": "string", "description": "Thanking people who helped"},
                    "future_focus": {"type": "string", "description": "What comes next"}
                },
                "industry_tags": ["career", "leadership", "business"],
                "use_case": "personal_update"
            },
            {
                "id": "problem_solution",
                "name": "Problem-Solution Case Study",
                "description": "Present a business problem and solution approach",
                "content_type": "post",
                "template_structure": """The Challenge: {{problem_description}}

The stakes were high: {{impact_explanation}}

Our approach: {{solution_strategy}}

Results: {{outcomes_achieved}}

The key insight? {{main_lesson}}

How do you tackle similar challenges in your industry?""",
                "variables": {
                    "problem_description": {"type": "string", "description": "The business problem faced"},
                    "impact_explanation": {"type": "string", "description": "Why this problem mattered"},
                    "solution_strategy": {"type": "string", "description": "How the problem was approached"},
                    "outcomes_achieved": {"type": "string", "description": "What results were achieved"},
                    "main_lesson": {"type": "string", "description": "Key insight from the experience"}
                },
                "industry_tags": ["business", "consulting", "strategy"],
                "use_case": "thought_leadership"
            },
            {
                "id": "learning_development",
                "name": "Learning & Development Update",
                "description": "Share learning experiences and professional development",
                "content_type": "post",
                "template_structure": """📚 {{learning_context}}

{{new_knowledge}}

How I'm applying this: {{practical_application}}

{{results_or_insights}}

{{encouragement_to_others}}

What's the most valuable thing you've learned recently?""",
                "variables": {
                    "learning_context": {"type": "string", "description": "What you've been learning"},
                    "new_knowledge": {"type": "string", "description": "Key concepts or skills gained"},
                    "practical_application": {"type": "string", "description": "How you're using this knowledge"},
                    "results_or_insights": {"type": "string", "description": "Outcomes or insights from application"},
                    "encouragement_to_others": {"type": "string", "description": "Motivating others to learn"}
                },
                "industry_tags": ["education", "career", "development"],
                "use_case": "personal_update"
            },
            {
                "id": "quick_tip",
                "name": "Quick Professional Tips",
                "description": "Share actionable professional advice",
                "content_type": "post",
                "template_structure": """💡 Quick tip: {{main_tip}}

Why this works:
{{explanation}}

How to implement:
{{implementation_steps}}

{{additional_context}}

Try this and let me know how it goes! 

#ProfessionalTips #ProductivityHack""",
                "variables": {
                    "main_tip": {"type": "string", "description": "The core tip being shared"},
                    "explanation": {"type": "string", "description": "Why this tip is effective"},
                    "implementation_steps": {"type": "string", "description": "How to put it into practice"},
                    "additional_context": {"type": "string", "description": "Extra context or examples"}
                },
                "industry_tags": ["productivity", "business", "career"],
                "use_case": "professional_advice"
            },
            {
                "id": "networking_connection",
                "name": "Networking Connection Request",
                "description": "Professional networking and connection posts",
                "content_type": "post",
                "template_structure": """{{connection_context}}

{{value_proposition}}

{{mutual_benefit}}

{{call_to_connect}}

Looking forward to building meaningful professional relationships!

#Networking #ProfessionalConnections""",
                "variables": {
                    "connection_context": {"type": "string", "description": "Context for wanting to connect"},
                    "value_proposition": {"type": "string", "description": "What value you can provide"},
                    "mutual_benefit": {"type": "string", "description": "How connection benefits both parties"},
                    "call_to_connect": {"type": "string", "description": "Invitation to connect"}
                },
                "industry_tags": ["networking", "business", "career"],
                "use_case": "networking"
            },
            {
                "id": "thought_leadership_long",
                "name": "Thought Leadership Article",
                "description": "In-depth thought leadership content",
                "content_type": "article",
                "template_structure": """# {{article_title}}

{{hook_introduction}}

## The Current Landscape
{{current_state_analysis}}

## The Challenge
{{problem_identification}}

## A Different Perspective
{{unique_viewpoint}}

## Practical Implications
{{actionable_insights}}

## Looking Forward
{{future_predictions}}

## Conclusion
{{key_takeaways}}

What's your take on this? I'd love to hear different perspectives in the comments.""",
                "variables": {
                    "article_title": {"type": "string", "description": "Compelling article title"},
                    "hook_introduction": {"type": "string", "description": "Engaging opening that hooks readers"},
                    "current_state_analysis": {"type": "string", "description": "Analysis of current situation"},
                    "problem_identification": {"type": "string", "description": "Key challenges identified"},
                    "unique_viewpoint": {"type": "string", "description": "Your unique perspective"},
                    "actionable_insights": {"type": "string", "description": "Practical advice readers can use"},
                    "future_predictions": {"type": "string", "description": "Predictions about future trends"},
                    "key_takeaways": {"type": "string", "description": "Main points to remember"}
                },
                "industry_tags": ["leadership", "strategy", "innovation"],
                "use_case": "thought_leadership"
            },
            {
                "id": "company_update",
                "name": "Company News Announcement",
                "description": "Share company news and updates professionally",
                "content_type": "post",
                "template_structure": """🚀 {{announcement_headline}}

{{news_details}}

What this means: {{significance_explanation}}

{{personal_reflection}}

{{future_implications}}

Excited to see what comes next! {{closing_sentiment}}

#CompanyNews #ProfessionalUpdate""",
                "variables": {
                    "announcement_headline": {"type": "string", "description": "Main announcement"},
                    "news_details": {"type": "string", "description": "Details about the news"},
                    "significance_explanation": {"type": "string", "description": "Why this news matters"},
                    "personal_reflection": {"type": "string", "description": "Your thoughts on the news"},
                    "future_implications": {"type": "string", "description": "What this means going forward"},
                    "closing_sentiment": {"type": "string", "description": "Positive closing thought"}
                },
                "industry_tags": ["business", "company", "updates"],
                "use_case": "company_news"
            }
        ]
    
    async def get_template_by_id(self, template_id: str, 
                               db_connection: Optional[asyncpg.Connection] = None) -> Optional[Dict[str, Any]]:
        """Get a specific template by ID"""
        try:
            # Try database first
            if db_connection:
                row = await db_connection.fetchrow(
                    "SELECT * FROM content_templates WHERE id = $1", template_id
                )
                if row:
                    return dict(row)
            
            # Fall back to default templates
            default_templates = self._get_default_templates()
            for template in default_templates:
                if template["id"] == template_id:
                    return template
            
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to get template {template_id}: {e}")
            return None
    
    def get_template_for_voice_profile(self, voice_signature: Dict[str, float], 
                                     content_type: str = "post") -> Dict[str, Any]:
        """Recommend template based on voice profile characteristics"""
        templates = self._get_default_templates()
        
        # Filter by content type
        matching_templates = [t for t in templates if t["content_type"] == content_type]
        
        if not matching_templates:
            return templates[0]  # Return first template as fallback
        
        # Score templates based on voice profile
        storytelling_score = voice_signature.get("storytelling_style", 0.3)
        authority_score = voice_signature.get("authority_tone", 0.4)
        personal_score = voice_signature.get("personal_experience_sharing", 0.4)
        technical_score = voice_signature.get("technical_depth", 0.3)
        
        template_scores = []
        
        for template in matching_templates:
            score = 0.0
            use_case = template.get("use_case", "")
            
            # Score based on use case alignment
            if use_case == "personal_story" and storytelling_score > 0.5:
                score += 3.0
            elif use_case == "thought_leadership" and authority_score > 0.5:
                score += 3.0
            elif use_case == "personal_update" and personal_score > 0.5:
                score += 2.0
            elif use_case == "professional_advice" and technical_score > 0.4:
                score += 2.0
            else:
                score += 1.0  # Base score for any template
            
            # Boost score for templates that match voice characteristics
            if "story" in template["name"].lower() and storytelling_score > 0.4:
                score += 1.5
            if "insight" in template["name"].lower() and authority_score > 0.4:
                score += 1.5
            if "personal" in template["name"].lower() and personal_score > 0.4:
                score += 1.5
            
            template_scores.append((template, score))
        
        # Return template with highest score
        best_template = max(template_scores, key=lambda x: x[1])[0]
        return best_template
    
    def populate_template(self, template: Dict[str, Any], variables: Dict[str, str]) -> str:
        """Populate template with provided variables"""
        try:
            template_structure = template.get("template_structure", "")
            
            # Replace variables in template
            populated = template_structure
            for var_name, value in variables.items():
                placeholder = f"{{{{{var_name}}}}}"
                populated = populated.replace(placeholder, value)
            
            return populated
            
        except Exception as e:
            self.logger.error(f"Failed to populate template: {e}")
            return template.get("template_structure", "")
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.template_cache:
            return False
        
        if cache_key not in self.cache_expiry:
            return False
        
        return datetime.utcnow().timestamp() < self.cache_expiry[cache_key]
    
    def clear_cache(self):
        """Clear the template cache"""
        self.template_cache.clear()
        self.cache_expiry.clear()
        self.logger.info("Template cache cleared")
    
    async def create_custom_template(self, template_data: Dict[str, Any],
                                   db_connection: Optional[asyncpg.Connection] = None) -> Optional[Dict[str, Any]]:
        """Create a new custom template"""
        try:
            if not db_connection:
                self.logger.warning("Cannot create custom template without database connection")
                return None
            
            # Insert new template
            query = """
                INSERT INTO content_templates 
                (name, description, content_type, template_structure, variables, industry_tags, use_case)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            """
            
            row = await db_connection.fetchrow(
                query,
                template_data["name"],
                template_data.get("description", ""),
                template_data["content_type"],
                template_data["template_structure"],
                template_data.get("variables", {}),
                template_data.get("industry_tags", []),
                template_data.get("use_case", "general")
            )
            
            # Clear cache to ensure fresh data
            self.clear_cache()
            
            self.logger.info(f"Created custom template: {template_data['name']}")
            return dict(row)
            
        except Exception as e:
            self.logger.error(f"Failed to create custom template: {e}")
            return None
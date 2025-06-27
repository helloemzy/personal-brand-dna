import json
import os
import traceback
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import spacy
import openai
from google.cloud import speech
import io
import base64

# Initialize OpenAI
openai.api_key = os.environ.get('OPENAI_API_KEY')

# Initialize Google Speech client
speech_client = speech.SpeechClient()

# Load spaCy model (you may need to adjust this based on available models)
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Fallback if the model isn't available
    nlp = None

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        os.environ.get('DATABASE_URL'),
        cursor_factory=RealDictCursor
    )

def transcribe_audio(audio_data):
    """Transcribe audio using Google Speech-to-Text"""
    try:
        # Decode base64 audio data
        audio_bytes = base64.b64decode(audio_data)
        
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000,
            language_code="en-US",
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,
        )

        response = speech_client.recognize(config=config, audio=audio)
        
        if not response.results:
            return ""
            
        # Combine all transcription results
        transcript = ""
        for result in response.results:
            transcript += result.alternatives[0].transcript + " "
            
        return transcript.strip()
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        return ""

def analyze_voice_characteristics(text):
    """Analyze voice characteristics from text"""
    if not text or not nlp:
        return {
            'formality': 0.5, 'enthusiasm': 0.5, 'directness': 0.5,
            'storytelling': 0.5, 'humor': 0.5, 'technical': 0.5,
            'empathy': 0.5, 'confidence': 0.5, 'curiosity': 0.5,
            'collaboration': 0.5, 'innovation': 0.5, 'leadership': 0.5,
            'analytical': 0.5, 'practical': 0.5
        }
    
    doc = nlp(text)
    
    # Simple heuristic analysis (this would be much more sophisticated in production)
    analysis = {
        'formality': min(1.0, len([token for token in doc if token.pos_ in ['NOUN', 'ADJ']]) / max(1, len(doc)) * 2),
        'enthusiasm': min(1.0, len([token for token in doc if token.text.upper() == token.text and len(token.text) > 1]) / max(1, len(doc)) * 10),
        'directness': min(1.0, len([sent for sent in doc.sents if len(sent) < 15]) / max(1, len(list(doc.sents)))),
        'storytelling': min(1.0, len([token for token in doc if token.lemma_ in ['tell', 'story', 'experience', 'remember']]) / max(1, len(doc)) * 5),
        'humor': min(1.0, len([token for token in doc if token.lemma_ in ['funny', 'laugh', 'joke', 'haha']]) / max(1, len(doc)) * 5),
        'technical': min(1.0, len([token for token in doc if token.pos_ == 'NOUN' and len(token.text) > 6]) / max(1, len(doc)) * 3),
        'empathy': min(1.0, len([token for token in doc if token.lemma_ in ['feel', 'understand', 'relate', 'empathy']]) / max(1, len(doc)) * 5),
        'confidence': min(1.0, len([token for token in doc if token.lemma_ in ['know', 'sure', 'confident', 'certain']]) / max(1, len(doc)) * 5),
        'curiosity': min(1.0, len([sent for sent in doc.sents if sent.text.strip().endswith('?')]) / max(1, len(list(doc.sents)))),
        'collaboration': min(1.0, len([token for token in doc if token.lemma_ in ['we', 'us', 'together', 'team']]) / max(1, len(doc)) * 5),
        'innovation': min(1.0, len([token for token in doc if token.lemma_ in ['new', 'innovative', 'creative', 'idea']]) / max(1, len(doc)) * 5),
        'leadership': min(1.0, len([token for token in doc if token.lemma_ in ['lead', 'manage', 'direct', 'guide']]) / max(1, len(doc)) * 5),
        'analytical': min(1.0, len([token for token in doc if token.lemma_ in ['analyze', 'data', 'metrics', 'research']]) / max(1, len(doc)) * 5),
        'practical': min(1.0, len([token for token in doc if token.lemma_ in ['practical', 'useful', 'implement', 'execute']]) / max(1, len(doc)) * 5)
    }
    
    return analysis

def generate_voice_signature(characteristics, user_info):
    """Generate a voice signature using OpenAI"""
    try:
        prompt = f"""Based on the following voice characteristics and user information, create a professional voice signature that captures their authentic communication style:

Voice Characteristics:
- Formality: {characteristics['formality']:.2f}
- Enthusiasm: {characteristics['enthusiasm']:.2f}  
- Directness: {characteristics['directness']:.2f}
- Storytelling: {characteristics['storytelling']:.2f}
- Humor: {characteristics['humor']:.2f}
- Technical: {characteristics['technical']:.2f}
- Empathy: {characteristics['empathy']:.2f}
- Confidence: {characteristics['confidence']:.2f}
- Curiosity: {characteristics['curiosity']:.2f}
- Collaboration: {characteristics['collaboration']:.2f}
- Innovation: {characteristics['innovation']:.2f}
- Leadership: {characteristics['leadership']:.2f}
- Analytical: {characteristics['analytical']:.2f}
- Practical: {characteristics['practical']:.2f}

User Info:
- Role: {user_info.get('role', 'Professional')}
- Industry: {user_info.get('industry', 'Business')}
- Company: {user_info.get('company', 'Various')}

Create a voice signature that includes:
1. Communication style summary (2-3 sentences)
2. Key voice traits (3-4 bullet points)
3. Content themes that resonate (3-4 topics)
4. Tone and approach preferences

Format as JSON with keys: summary, traits, themes, tone"""

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional voice analysis expert. Create authentic, professional voice signatures."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )

        signature_text = response.choices[0].message.content
        
        # Try to parse as JSON, fallback to text if needed
        try:
            signature = json.loads(signature_text)
        except:
            signature = {
                "summary": signature_text[:200] + "...",
                "traits": ["Professional communicator", "Authentic voice", "Clear messaging"],
                "themes": ["Industry insights", "Professional growth", "Team collaboration"],
                "tone": "Professional and approachable"
            }
            
        return signature
    except Exception as e:
        print(f"Voice signature generation error: {str(e)}")
        return {
            "summary": "Professional communicator with authentic voice and clear messaging style.",
            "traits": ["Clear and direct communication", "Professional tone", "Authentic personality"],
            "themes": ["Industry insights", "Professional development", "Team collaboration"],
            "tone": "Professional and approachable"
        }

def handler(event, context):
    """Vercel serverless function handler"""
    try:
        # Parse request
        if event.get('httpMethod') != 'POST':
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': False,
                    'message': 'Method not allowed',
                    'code': 'METHOD_NOT_ALLOWED'
                })
            }

        # Get request body
        body = json.loads(event.get('body', '{}'))
        
        # Validate required fields
        if 'audio_data' not in body or 'user_id' not in body:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': False,
                    'message': 'Missing required fields: audio_data, user_id',
                    'code': 'VALIDATION_ERROR'
                })
            }

        user_id = body['user_id']
        audio_data = body['audio_data']
        
        # Get user info from database
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT u.email, u.first_name, u.last_name, u.industry, u.role, u.company
            FROM users u
            WHERE u.id = %s AND u.status = 'active'
        """, (user_id,))
        
        user = cur.fetchone()
        if not user:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': False,
                    'message': 'User not found',
                    'code': 'USER_NOT_FOUND'
                })
            }

        # Transcribe audio
        transcript = transcribe_audio(audio_data)
        if not transcript:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': False,
                    'message': 'Could not transcribe audio',
                    'code': 'TRANSCRIPTION_FAILED'
                })
            }

        # Analyze voice characteristics
        characteristics = analyze_voice_characteristics(transcript)
        
        # Generate voice signature
        voice_signature = generate_voice_signature(characteristics, dict(user))
        
        # Store results in database
        cur.execute("""
            INSERT INTO voice_transcriptions (
                user_id, transcript, audio_duration, characteristics, 
                voice_signature, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id, transcript, body.get('duration', 0),
            json.dumps(characteristics), json.dumps(voice_signature),
            datetime.now()
        ))
        
        transcription_id = cur.fetchone()['id']
        
        # Update user profile
        cur.execute("""
            UPDATE user_profiles 
            SET last_voice_analysis = %s 
            WHERE user_id = %s
        """, (datetime.now(), user_id))
        
        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'message': 'Voice analysis completed successfully',
                'data': {
                    'transcription_id': transcription_id,
                    'transcript': transcript,
                    'characteristics': characteristics,
                    'voice_signature': voice_signature
                },
                'code': 'ANALYSIS_SUCCESS'
            })
        }

    except Exception as e:
        print(f"Voice analysis error: {str(e)}")
        print(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': 'Voice analysis failed',
                'code': 'ANALYSIS_ERROR'
            })
        }
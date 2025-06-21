import os
import asyncio
import aiohttp
import tempfile
from typing import Dict, Any, Optional
from datetime import datetime

try:
    from google.cloud import speech
    GOOGLE_SPEECH_AVAILABLE = True
except ImportError:
    GOOGLE_SPEECH_AVAILABLE = False

import librosa
import soundfile as sf
from pydub import AudioSegment

from utils.config import settings
from utils.logger import AIProcessingLogger

class TranscriptionService(AIProcessingLogger):
    """Service for converting audio to text using Google Cloud Speech API"""
    
    def __init__(self):
        super().__init__()
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Google Cloud Speech client"""
        if not GOOGLE_SPEECH_AVAILABLE:
            self.logger.warning("Google Cloud Speech library not available")
            return
        
        if not settings.google_speech_credentials:
            self.logger.warning("Google Speech credentials not configured")
            return
        
        try:
            self.client = speech.SpeechClient()
            self.logger.info("Google Cloud Speech client initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize Google Speech client: {e}")
    
    async def transcribe(self, audio_url: str, user_id: str) -> Dict[str, Any]:
        """
        Transcribe audio file to text
        
        Args:
            audio_url: URL or path to audio file
            user_id: User ID for logging
            
        Returns:
            Dictionary containing transcription results
        """
        start_time = datetime.utcnow()
        
        self.log_transcription_start(user_id, audio_url)
        
        try:
            # Download and preprocess audio
            audio_data, sample_rate, duration = await self._download_and_preprocess_audio(audio_url)
            
            # Perform transcription
            if self.client:
                result = await self._transcribe_with_google(audio_data, sample_rate)
            else:
                # Fallback to OpenAI Whisper API
                result = await self._transcribe_with_whisper(audio_data, sample_rate)
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Add metadata
            result.update({
                "audio_duration": duration,
                "processing_time": processing_time,
                "sample_rate": sample_rate,
                "transcription_length": len(result.get("transcription", ""))
            })
            
            self.log_transcription_complete(
                user_id, 
                processing_time, 
                result.get("confidence", 0),
                result.get("transcription_length", 0)
            )
            
            return result
            
        except Exception as e:
            self.log_operation_error("transcription", e, user_id=user_id)
            raise
    
    async def _download_and_preprocess_audio(self, audio_url: str) -> tuple:
        """Download and preprocess audio file"""
        try:
            # Download audio file
            if audio_url.startswith(("http://", "https://")):
                audio_data = await self._download_from_url(audio_url)
            else:
                # Local file path
                with open(audio_url, 'rb') as f:
                    audio_data = f.read()
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_data)
            
            try:
                # Convert to appropriate format and sample rate
                audio, sample_rate = librosa.load(
                    temp_path, 
                    sr=settings.audio_sample_rate,
                    mono=True
                )
                
                # Calculate duration
                duration = len(audio) / sample_rate
                
                # Convert to bytes for API
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as processed_file:
                    processed_path = processed_file.name
                    sf.write(processed_path, audio, sample_rate, format='WAV')
                    
                    with open(processed_path, 'rb') as f:
                        processed_audio_data = f.read()
                
                # Clean up temporary files
                os.unlink(temp_path)
                os.unlink(processed_path)
                
                return processed_audio_data, sample_rate, duration
                
            except Exception as e:
                # Clean up on error
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise e
                
        except Exception as e:
            self.logger.error(f"Audio preprocessing failed: {e}")
            raise
    
    async def _download_from_url(self, url: str) -> bytes:
        """Download audio file from URL"""
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"Failed to download audio: HTTP {response.status}")
                
                content_length = response.headers.get('Content-Length')
                if content_length and int(content_length) > settings.max_audio_file_size:
                    raise Exception(f"Audio file too large: {content_length} bytes")
                
                return await response.read()
    
    async def _transcribe_with_google(self, audio_data: bytes, sample_rate: int) -> Dict[str, Any]:
        """Transcribe using Google Cloud Speech API"""
        try:
            # Configure recognition
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=sample_rate,
                language_code=settings.google_speech_language,
                enable_automatic_punctuation=True,
                enable_word_confidence=True,
                enable_spoken_punctuation=True,
                enable_speaker_diarization=False,  # Single speaker expected
                model='latest_long',  # Best for longer audio
                use_enhanced=True
            )
            
            audio = speech.RecognitionAudio(content=audio_data)
            
            # Perform transcription
            if len(audio_data) > 1024 * 1024:  # 1MB threshold for long running
                operation = self.client.long_running_recognize(
                    config=config, 
                    audio=audio
                )
                response = operation.result(timeout=settings.voice_analysis_timeout)
            else:
                response = self.client.recognize(config=config, audio=audio)
            
            # Process results
            transcription = ""
            confidence_scores = []
            word_details = []
            
            for result in response.results:
                alternative = result.alternatives[0]
                transcription += alternative.transcript + " "
                confidence_scores.append(alternative.confidence)
                
                # Extract word-level details if available
                if hasattr(alternative, 'words'):
                    for word in alternative.words:
                        word_details.append({
                            "word": word.word,
                            "confidence": word.confidence,
                            "start_time": word.start_time.total_seconds(),
                            "end_time": word.end_time.total_seconds()
                        })
            
            overall_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
            
            return {
                "transcription": transcription.strip(),
                "confidence": overall_confidence,
                "language": settings.google_speech_language,
                "word_details": word_details,
                "provider": "google_speech"
            }
            
        except Exception as e:
            self.logger.error(f"Google Speech transcription failed: {e}")
            raise
    
    async def _transcribe_with_whisper(self, audio_data: bytes, sample_rate: int) -> Dict[str, Any]:
        """Transcribe using OpenAI Whisper API (fallback)"""
        try:
            import openai
            
            if not settings.openai_api_key:
                raise Exception("OpenAI API key not configured")
            
            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            
            # Create temporary file for Whisper
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name
            
            try:
                with open(temp_path, 'rb') as audio_file:
                    response = await client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="verbose_json",
                        language="en"
                    )
                
                # Clean up
                os.unlink(temp_path)
                
                return {
                    "transcription": response.text,
                    "confidence": 0.85,  # Whisper doesn't provide confidence scores
                    "language": response.language,
                    "duration": response.duration,
                    "provider": "openai_whisper"
                }
                
            except Exception as e:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise e
                
        except Exception as e:
            self.logger.error(f"Whisper transcription failed: {e}")
            raise
    
    async def validate_audio_file(self, file_path: str) -> Dict[str, Any]:
        """Validate audio file format and properties"""
        try:
            # Get file info using pydub
            audio = AudioSegment.from_file(file_path)
            
            duration = len(audio) / 1000.0  # Convert to seconds
            file_size = os.path.getsize(file_path)
            
            # Check file size
            if file_size > settings.max_audio_file_size:
                raise Exception(f"File too large: {file_size} bytes (max: {settings.max_audio_file_size})")
            
            # Check duration (reasonable limits)
            if duration < 1:
                raise Exception("Audio too short (minimum 1 second)")
            if duration > 600:  # 10 minutes
                raise Exception("Audio too long (maximum 10 minutes)")
            
            # Check format
            file_extension = os.path.splitext(file_path)[1].lower().lstrip('.')
            if file_extension not in settings.supported_audio_formats:
                raise Exception(f"Unsupported format: {file_extension}")
            
            return {
                "valid": True,
                "duration": duration,
                "file_size": file_size,
                "format": file_extension,
                "channels": audio.channels,
                "frame_rate": audio.frame_rate
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }
    
    async def batch_transcribe(self, audio_urls: list, user_id: str) -> Dict[str, Any]:
        """Transcribe multiple audio files in parallel"""
        if len(audio_urls) > 10:
            raise Exception("Maximum 10 audio files per batch")
        
        self.log_operation_start("batch_transcription", user_id=user_id, batch_size=len(audio_urls))
        
        start_time = datetime.utcnow()
        
        # Create transcription tasks
        tasks = [
            self.transcribe(url, user_id) 
            for url in audio_urls
        ]
        
        try:
            # Execute in parallel with timeout
            results = await asyncio.gather(
                *tasks,
                return_exceptions=True
            )
            
            # Process results
            successful = []
            failed = []
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    failed.append({
                        "audio_url": audio_urls[i],
                        "error": str(result)
                    })
                else:
                    successful.append({
                        "audio_url": audio_urls[i],
                        "result": result
                    })
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            self.log_operation_end(
                "batch_transcription",
                processing_time,
                user_id=user_id,
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
            self.log_operation_error("batch_transcription", e, user_id=user_id)
            raise
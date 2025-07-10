import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTypingIndicator } from '../../hooks/useWebSocket';
import TypingIndicator from '../realtime/TypingIndicator';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface CollaborativeTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  maxRows?: number;
  context: string; // Unique context for this editor (e.g., 'workshop-writing-sample')
  disabled?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
  enableCollaboration?: boolean;
}

interface TextOperation {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  userId: string;
  userName: string;
}

const CollaborativeTextEditor: React.FC<CollaborativeTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  minRows = 3,
  maxRows = 10,
  context,
  disabled = false,
  maxLength,
  showCharCount = true,
  enableCollaboration = false
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSyncRef = useRef<number>(Date.now());
  const operationQueueRef = useRef<TextOperation[]>([]);
  const user = useSelector((state: RootState) => state.auth.user);

  const { isConnected, emit, on, off } = useWebSocket({ autoConnect: enableCollaboration });
  const { handleTyping, handleStopTyping } = useTypingIndicator(context);

  // Sync local value with prop value
  useEffect(() => {
    if (value !== localValue && Date.now() - lastSyncRef.current > 1000) {
      setLocalValue(value);
    }
  }, [value, localValue]);

  // Handle incoming text operations from other users
  useEffect(() => {
    if (!enableCollaboration || !isConnected) return;

    const handleTextOperation = (operation: TextOperation) => {
      // Don't apply our own operations
      if (operation.userId === user?.id) return;

      // Apply operation to local text
      setLocalValue(current => {
        let newValue = current;
        
        switch (operation.type) {
          case 'insert':
            newValue = 
              current.slice(0, operation.position) + 
              (operation.content || '') + 
              current.slice(operation.position);
            break;
          case 'delete':
            newValue = 
              current.slice(0, operation.position) + 
              current.slice(operation.position + (operation.length || 0));
            break;
          case 'replace':
            newValue = 
              current.slice(0, operation.position) + 
              (operation.content || '') + 
              current.slice(operation.position + (operation.length || 0));
            break;
        }

        // Update parent component
        lastSyncRef.current = Date.now();
        onChange(newValue);
        
        return newValue;
      });
    };

    const eventName = `text_operation:${context}`;
    on(eventName, handleTextOperation);

    return () => {
      off(eventName, handleTextOperation);
    };
  }, [enableCollaboration, isConnected, context, user?.id, onChange, on, off]);

  // Create and send text operation
  const createOperation = useCallback((
    type: TextOperation['type'],
    position: number,
    content?: string,
    length?: number
  ) => {
    if (!enableCollaboration || !isConnected || !user) return;

    const operation: TextOperation = {
      type,
      position,
      content,
      length,
      timestamp: Date.now(),
      userId: user.id,
      userName: user.name || user.email
    };

    // Send to other users
    emit(`text_operation:${context}`, operation);
  }, [enableCollaboration, isConnected, context, user, emit]);

  // Handle text changes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const start = e.target.selectionStart || 0;
    const end = e.target.selectionEnd || 0;

    // Respect max length
    if (maxLength && newValue.length > maxLength) {
      return;
    }

    // Calculate what changed
    const oldValue = localValue;
    const oldLength = oldValue.length;
    const newLength = newValue.length;

    if (newLength > oldLength) {
      // Text was inserted
      const insertPosition = start - (newLength - oldLength);
      const insertedText = newValue.slice(insertPosition, start);
      createOperation('insert', insertPosition, insertedText);
    } else if (newLength < oldLength) {
      // Text was deleted
      const deletePosition = start;
      const deletedLength = oldLength - newLength;
      createOperation('delete', deletePosition, undefined, deletedLength);
    } else if (newValue !== oldValue) {
      // Text was replaced (e.g., paste operation)
      // Find the first difference
      let replaceStart = 0;
      while (replaceStart < Math.min(oldLength, newLength) && 
             oldValue[replaceStart] === newValue[replaceStart]) {
        replaceStart++;
      }
      
      // Find the end of the difference
      let replaceEnd = oldLength;
      let newEnd = newLength;
      while (replaceEnd > replaceStart && newEnd > replaceStart && 
             oldValue[replaceEnd - 1] === newValue[newEnd - 1]) {
        replaceEnd--;
        newEnd--;
      }

      const replacedLength = replaceEnd - replaceStart;
      const replacementText = newValue.slice(replaceStart, newEnd);
      
      createOperation('replace', replaceStart, replacementText, replacedLength);
    }

    setLocalValue(newValue);
    setSelectionStart(start);
    setSelectionEnd(end);
    onChange(newValue);
    
    // Handle typing indicators
    if (enableCollaboration) {
      if (!isTyping) {
        setIsTyping(true);
        handleTyping();
      }
    }
  };

  // Handle typing stop
  const handleKeyUp = useCallback(() => {
    if (enableCollaboration && isTyping) {
      const stopTypingTimer = setTimeout(() => {
        setIsTyping(false);
        handleStopTyping();
      }, 1000);

      return () => clearTimeout(stopTypingTimer);
    }
  }, [enableCollaboration, isTyping, handleStopTyping]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [minRows, maxRows]);

  useEffect(() => {
    adjustHeight();
  }, [localValue, adjustHeight]);

  const characterCount = localValue.length;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={handleTextChange}
        onKeyUp={handleKeyUp}
        onSelect={(e) => {
          const target = e.target as HTMLTextAreaElement;
          setSelectionStart(target.selectionStart || 0);
          setSelectionEnd(target.selectionEnd || 0);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-lg resize-none transition-colors
          ${disabled 
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' 
            : 'bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
          }
          ${isOverLimit ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
          dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:focus:ring-indigo-400 dark:focus:border-indigo-400
        `}
        style={{ minHeight: `${minRows * 1.5}rem` }}
      />

      {/* Collaboration indicators */}
      {enableCollaboration && (
        <div className="mt-2">
          <TypingIndicator context={context} variant="compact" />
        </div>
      )}

      {/* Character count and status */}
      <div className="flex items-center justify-between mt-2 text-sm">
        <div className="flex items-center space-x-2">
          {enableCollaboration && (
            <div className="flex items-center space-x-1">
              <div 
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-gray-400'
                }`} 
              />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live editing' : 'Offline'}
              </span>
            </div>
          )}
        </div>

        {showCharCount && (
          <div className={`text-xs ${
            isOverLimit 
              ? 'text-red-600 font-medium' 
              : characterCount > (maxLength || 1000) * 0.8 
                ? 'text-yellow-600' 
                : 'text-gray-500'
          }`}>
            {characterCount}{maxLength && ` / ${maxLength}`}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollaborativeTextEditor;
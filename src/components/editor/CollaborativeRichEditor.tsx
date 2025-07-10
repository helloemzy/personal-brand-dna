import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import TypingIndicator from '../realtime/TypingIndicator';
import ActiveUsersDisplay from '../realtime/ActiveUsersDisplay';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface CollaborativeRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  context: string;
  disabled?: boolean;
  enableCollaboration?: boolean;
  showToolbar?: boolean;
  maxLength?: number;
}

interface EditorSelection {
  start: number;
  end: number;
  userId: string;
  userName: string;
  timestamp: number;
}

interface EditorCursor {
  position: number;
  userId: string;
  userName: string;
  color: string;
}

const CollaborativeRichEditor: React.FC<CollaborativeRichEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start writing...',
  className = '',
  context,
  disabled = false,
  enableCollaboration = false,
  showToolbar = true,
  maxLength
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [selections, setSelections] = useState<EditorSelection[]>([]);
  const [cursors, setCursors] = useState<EditorCursor[]>([]);
  const [currentSelection, setCurrentSelection] = useState({ start: 0, end: 0 });
  
  const editorRef = useRef<HTMLDivElement>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  const { isConnected, emit, on, off } = useWebSocket({ 
    autoConnect: enableCollaboration 
  });

  // Colors for different users
  const userColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  const getUserColor = useCallback((userId: string) => {
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return userColors[Math.abs(hash) % userColors.length];
  }, []);

  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (!editorRef.current) return;
    
    const newContent = editorRef.current.innerHTML;
    const textContent = editorRef.current.textContent || '';
    
    if (maxLength && textContent.length > maxLength) {
      return;
    }

    setLocalValue(newContent);
    onChange(newContent);

    // Broadcast change to other users
    if (enableCollaboration && isConnected && user) {
      emit(`content_change:${context}`, {
        content: newContent,
        userId: user.id,
        userName: user.name || user.email,
        timestamp: Date.now()
      });
    }
  }, [enableCollaboration, isConnected, context, user, onChange, maxLength, emit]);

  // Handle cursor/selection changes
  const handleSelectionChange = useCallback(() => {
    if (!enableCollaboration || !isConnected || !user) return;

    const selection = window.getSelection();
    if (!selection || !editorRef.current?.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const start = range.startOffset;
    const end = range.endOffset;

    setCurrentSelection({ start, end });

    // Broadcast cursor position
    emit(`cursor_position:${context}`, {
      position: start,
      userId: user.id,
      userName: user.name || user.email,
      color: getUserColor(user.id),
      timestamp: Date.now()
    });

    // Broadcast selection if text is selected
    if (start !== end) {
      emit(`text_selection:${context}`, {
        start,
        end,
        userId: user.id,
        userName: user.name || user.email,
        timestamp: Date.now()
      });
    }
  }, [enableCollaboration, isConnected, context, user, getUserColor, emit]);

  // Set up real-time event listeners
  useEffect(() => {
    if (!enableCollaboration || !isConnected) return;

    const handleContentChange = (data: any) => {
      if (data.userId === user?.id) return; // Don't apply our own changes
      
      if (editorRef.current) {
        editorRef.current.innerHTML = data.content;
        setLocalValue(data.content);
      }
    };

    const handleCursorPosition = (data: EditorCursor) => {
      if (data.userId === user?.id) return;
      
      setCursors(prev => {
        const filtered = prev.filter(c => c.userId !== data.userId);
        return [...filtered, data];
      });

      // Remove cursor after 3 seconds of inactivity
      setTimeout(() => {
        setCursors(prev => prev.filter(c => 
          c.userId !== data.userId || Date.now() - data.timestamp < 3000
        ));
      }, 3000);
    };

    const handleTextSelection = (data: EditorSelection) => {
      if (data.userId === user?.id) return;
      
      setSelections(prev => {
        const filtered = prev.filter(s => s.userId !== data.userId);
        return [...filtered, data];
      });

      // Remove selection after 5 seconds
      setTimeout(() => {
        setSelections(prev => prev.filter(s => 
          s.userId !== data.userId || Date.now() - data.timestamp < 5000
        ));
      }, 5000);
    };

    on(`content_change:${context}`, handleContentChange);
    on(`cursor_position:${context}`, handleCursorPosition);
    on(`text_selection:${context}`, handleTextSelection);

    return () => {
      off(`content_change:${context}`, handleContentChange);
      off(`cursor_position:${context}`, handleCursorPosition);
      off(`text_selection:${context}`, handleTextSelection);
    };
  }, [enableCollaboration, isConnected, context, user?.id, on, off]);

  // Formatting functions
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleContentChange();
    editorRef.current?.focus();
  };

  const isFormatActive = (command: string) => {
    return document.queryCommandState(command);
  };

  // Sync with external value changes
  useEffect(() => {
    if (value !== localValue && !isEditing) {
      setLocalValue(value);
      if (editorRef.current) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value, localValue, isEditing]);

  const textContent = editorRef.current?.textContent || '';
  const characterCount = textContent.length;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={`border rounded-lg overflow-hidden ${className} ${
      disabled ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
    }`}>
      {/* Collaboration header */}
      {enableCollaboration && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {isConnected ? 'Live editing' : 'Offline'}
              </span>
            </div>
            <ActiveUsersDisplay variant="avatars" maxDisplay={3} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      {showToolbar && !disabled && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => formatText('bold')}
              className={`p-2 rounded text-sm font-bold transition-colors ${
                isFormatActive('bold')
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              title="Bold"
            >
              B
            </button>
            <button
              onClick={() => formatText('italic')}
              className={`p-2 rounded text-sm italic transition-colors ${
                isFormatActive('italic')
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              title="Italic"
            >
              I
            </button>
            <button
              onClick={() => formatText('underline')}
              className={`p-2 rounded text-sm underline transition-colors ${
                isFormatActive('underline')
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              title="Underline"
            >
              U
            </button>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
            <button
              onClick={() => formatText('insertUnorderedList')}
              className={`p-2 rounded text-sm transition-colors ${
                isFormatActive('insertUnorderedList')
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              title="Bullet List"
            >
              •
            </button>
            <button
              onClick={() => formatText('insertOrderedList')}
              className={`p-2 rounded text-sm transition-colors ${
                isFormatActive('insertOrderedList')
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              title="Numbered List"
            >
              1.
            </button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleContentChange}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          className={`
            min-h-[120px] p-3 outline-none
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text'}
            text-gray-900 dark:text-white
          `}
          style={{ 
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: localValue || (placeholder ? `<p class="text-gray-500">${placeholder}</p>` : '') }}
        />

        {/* Render other users' cursors */}
        {enableCollaboration && cursors.map(cursor => (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none"
            style={{
              // This is a simplified cursor position - in a real implementation,
              // you'd need to calculate the actual DOM position
              top: '20px',
              left: `${Math.min(cursor.position * 8, 300)}px`,
              borderLeft: `2px solid ${cursor.color}`,
              height: '20px'
            }}
          >
            <div
              className="absolute -top-6 -left-1 px-1 py-0.5 text-xs text-white rounded text-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div>
            {enableCollaboration && (
              <TypingIndicator context={context} variant="compact" />
            )}
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            {maxLength && (
              <span className={isOverLimit ? 'text-red-500 font-medium' : ''}>
                {characterCount} / {maxLength}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeRichEditor;
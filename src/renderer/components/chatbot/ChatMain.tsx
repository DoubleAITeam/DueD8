import React, { useState, useRef, useEffect } from 'react';
import { useChatbotStore, type ChatSession, type AIModel, type ChatAttachment } from '../../state/chatbot';
import { SendIcon, PaperclipIcon, YoutubeIcon, FileIcon, XIcon } from '../icons';
import MessageList from './MessageList';
import FileUpload from './FileUpload';
import YoutubeInput from './YoutubeInput';

type ChatMainProps = {
  session: ChatSession | null;
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  courses: any[];
};

export default function ChatMain({ session, selectedModel, onModelChange, courses }: ChatMainProps) {
  const { addMessage, setTyping, setError } = useChatbotStore();
  const [message, setMessage] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sample courses as fallback
  const sampleCourses = [
    { id: 1, name: 'IT 106 - Introduction to Programming', course_code: 'IT 106' },
    { id: 2, name: 'RELI 100 - Introduction to Religion', course_code: 'RELI 100' },
    { id: 3, name: 'MATH 101 - Calculus I', course_code: 'MATH 101' },
    { id: 4, name: 'ENG 101 - English Composition', course_code: 'ENG 101' },
    { id: 5, name: 'HIST 201 - World History', course_code: 'HIST 201' }
  ];

  const coursesToUse = courses && courses.length > 0 ? courses : sampleCourses;

  // Debug logging
  useEffect(() => {
    console.log('ChatMain - courses:', courses);
    console.log('ChatMain - coursesToUse:', coursesToUse);
  }, [courses, coursesToUse]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;

    const userMessage = {
      content: message.trim(),
      role: 'user' as const,
      model: selectedModel,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      courseContext: selectedCourse || undefined,
    };

    // Add user message
    addMessage(userMessage);
    
    // Clear input
    setMessage('');
    setAttachments([]);
    setYoutubeUrl('');

    // Simulate AI response
    setIsLoading(true);
    setTyping(true);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Generate a more sophisticated response based on the message
      const response = generateAIResponse(message, selectedModel, selectedCourse, attachments);
      
      addMessage({
        content: response,
        role: 'assistant',
        model: selectedModel,
        courseContext: selectedCourse || undefined,
      });
    } catch (error) {
      setError('Failed to get AI response. Please try again.');
    } finally {
      setIsLoading(false);
      setTyping(false);
    }
  };

  const generateAIResponse = (userMessage: string, model: AIModel, course: string, attachments: ChatAttachment[]): string => {
    const courseContext = course ? ` (in the context of ${course})` : '';
    const attachmentContext = attachments.length > 0 ? ` I can see you've shared ${attachments.length} file(s)${attachments.some(a => a.type === 'youtube') ? ' and video(s)' : ''} that I can reference.` : '';
    
    if (model === 'basic') {
      return `I understand you're asking about "${userMessage}"${courseContext}.${attachmentContext} This is a basic response that provides general information and guidance. For more detailed academic help, consider switching to Advanced mode.`;
    } else {
      return `Thank you for your question about "${userMessage}"${courseContext}.${attachmentContext} This is an advanced response that would include detailed analysis, step-by-step explanations, and comprehensive academic support. The advanced model can handle complex topics, provide in-depth research assistance, and offer sophisticated problem-solving approaches.`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (files: File[]) => {
    const newAttachments: ChatAttachment[] = files.map(file => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'file',
      name: file.name,
      size: file.size,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleYoutubeSubmit = () => {
    if (!youtubeUrl.trim()) return;

    const attachment: ChatAttachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'youtube',
      name: 'YouTube Video',
      url: youtubeUrl.trim(),
    };
    setAttachments(prev => [...prev, attachment]);
    setYoutubeUrl('');
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!session) {
    return (
      <div 
        className="chat-main"
        style={{
          background: 'var(--surface-card)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div 
          className="chat-main__header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2 
            className="chat-main__title"
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: '0'
            }}
          >
            AI Study Assistant
          </h2>
        </div>
        <div 
          className="empty-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            padding: '40px 20px'
          }}
        >
          <div 
            className="empty-state__icon"
            style={{
              width: '64px',
              height: '64px',
              background: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <SendIcon size={32} />
          </div>
          <h3 
            className="empty-state__title"
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: '0 0 8px 0'
            }}
          >
            Start a New Conversation
          </h3>
          <p 
            className="empty-state__description"
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: '0 0 24px 0',
              maxWidth: '300px'
            }}
          >
            Choose your AI model and begin chatting with your study assistant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="chat-main"
      style={{
        background: 'var(--surface-card)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div 
        className="chat-main__header"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <h2 
          className="chat-main__title"
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: '0'
          }}
        >
          {session.title || 'New Chat'}
          {session.courseContext && ` • ${session.courseContext}`}
        </h2>
        <div 
          className="chat-main__actions"
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <button 
            className="toggle-panel-btn"
            onClick={() => {/* Toggle right panel */}}
            style={{
              background: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Tips & Prompts
          </button>
        </div>
      </div>

      <div className="messages-area">
        <MessageList 
          messages={session.messages} 
          isLoading={isLoading}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          <div className="input-controls">
            <div className="class-selector">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    background: 'var(--surface-background)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select Course (Optional)</option>
                  {coursesToUse.map(course => (
                    <option key={course.id} value={course.name}>
                      {course.name}
                    </option>
                  ))}
                </select>
            </div>

            <FileUpload onFileUpload={handleFileUpload} />

            <YoutubeInput
              value={youtubeUrl}
              onChange={setYoutubeUrl}
              onSubmit={handleYoutubeSubmit}
            />
          </div>

          {attachments.length > 0 && (
            <div className="attachments-preview">
              {attachments.map(attachment => (
                <div key={attachment.id} className="attachment">
                  {attachment.type === 'file' ? (
                    <FileIcon size={16} />
                  ) : (
                    <YoutubeIcon size={16} />
                  )}
                  <span>{attachment.name}</span>
                  {attachment.size && (
                    <span className="attachment__size">
                      {formatFileSize(attachment.size)}
                    </span>
                  )}
                  <button
                    className="attachment__remove"
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="message-input-container">
            <textarea
              ref={textareaRef}
              className="message-input"
              placeholder="Ask me anything about your studies..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={(!message.trim() && attachments.length === 0) || isLoading}
            >
              <SendIcon size={16} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

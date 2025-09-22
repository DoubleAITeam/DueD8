# AI Study Assistant Chatbot

A comprehensive chatbot interface designed for students to interact with an AI assistant for academic support. The interface features a clean, organized layout with multiple AI proficiency levels and file upload capabilities.

## Features

### Core Functionality
- **Dual AI Models**: Toggle between "Basic" and "Advanced" modes
- **Chat Sessions**: Save and manage multiple conversation threads
- **File Uploads**: Support for PDFs, DOCX, TXT, and RTF files
- **YouTube Integration**: Paste and process YouTube video links
- **Course Context**: Select courses to provide contextual responses
- **Real-time Messaging**: Live chat interface with typing indicators

### User Interface
- **Left Sidebar**: Session management and model selection
- **Main Chat Area**: Message display and input controls
- **Right Panel**: Suggested prompts and study tips
- **Responsive Design**: Mobile-friendly layout
- **Dark/Light Theme**: Consistent with app theming

### State Management
- **Zustand Store**: Persistent chat sessions and settings
- **Model Switching**: Seamless transition between AI models
- **Context Preservation**: Full chat history maintained across model switches

## Component Structure

```
ChatbotInterface/
├── ChatbotInterface.tsx      # Main container component
├── ChatSidebar.tsx          # Left sidebar with sessions
├── ChatMain.tsx             # Main chat area
├── MessageList.tsx          # Message display component
├── FileUpload.tsx           # File upload functionality
├── YoutubeInput.tsx         # YouTube link input
├── ChatRightPanel.tsx       # Right panel with tips
├── ChatbotInterface.css     # Styling
└── README.md               # This file
```

## Usage

### Basic Usage
1. Navigate to `/chatbot` in the app
2. Select your preferred AI model (Basic/Advanced)
3. Choose a course context (optional)
4. Start typing your question
5. Upload files or paste YouTube links as needed

### Advanced Features
- **Session Management**: Create, rename, and delete chat sessions
- **Model Switching**: Change AI models mid-conversation
- **File Attachments**: Upload academic documents for reference
- **YouTube Videos**: Share video content for analysis
- **Course Context**: Get responses tailored to specific courses

## State Management

The chatbot uses Zustand for state management with the following key features:

```typescript
// Chat sessions with persistent storage
sessions: Record<string, ChatSession>
sessionOrder: string[]

// Current session and UI state
currentSessionId: string | null
selectedModel: AIModel
isTyping: boolean

// Actions
createSession, deleteSession, selectSession
addMessage, updateMessage
setSelectedModel, setTyping, setError
```

## Styling

The component uses CSS custom properties for theming and follows the app's design system:

- **CSS Variables**: Consistent with app theme
- **Responsive Grid**: Adapts to different screen sizes
- **Interactive States**: Hover, active, and focus states
- **Accessibility**: Proper focus management and ARIA labels

## Future Enhancements

- **Real AI Integration**: Connect to actual AI models
- **File Processing**: Parse and analyze uploaded documents
- **YouTube Processing**: Extract and analyze video content
- **Export Features**: Save conversations and summaries
- **Collaboration**: Share sessions with classmates
- **Analytics**: Track usage and learning progress

## Technical Notes

- **TypeScript**: Fully typed components and state
- **React Hooks**: Modern functional components
- **Zustand**: Lightweight state management
- **CSS Grid**: Modern layout system
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG compliant components

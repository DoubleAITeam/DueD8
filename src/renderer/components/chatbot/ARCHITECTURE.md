# Chatbot Interface Architecture

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        AppShell Header                         │
├─────────────┬─────────────────────────────────┬─────────────────┤
│             │                                 │                 │
│   Left      │          Main Chat              │   Right         │
│  Sidebar    │            Area                 │   Panel         │
│             │                                 │                 │
│ ┌─────────┐ │ ┌─────────────────────────────┐ │ ┌─────────────┐ │
│ │  Model  │ │ │        Messages             │ │ │   Prompts   │ │
│ │ Toggle  │ │ │                             │ │ │             │ │
│ └─────────┘ │ │  ┌─────────────────────────┐ │ │ ┌─────────┐ │ │
│             │ │  │    User Message         │ │ │ │  Tips   │ │ │
│ ┌─────────┐ │ │  └─────────────────────────┘ │ │ └─────────┘ │ │
│ │ Sessions│ │ │                             │ │             │ │
│ │ List    │ │ │  ┌─────────────────────────┐ │ │ ┌─────────┐ │ │
│ │         │ │ │  │   AI Response           │ │ │ │ Model   │ │ │
│ │         │ │ │  └─────────────────────────┘ │ │ │ Info    │ │ │
│ └─────────┘ │ │                             │ │ └─────────┘ │ │
│             │ └─────────────────────────────┘ │             │ │
│             │                                 │             │ │
│             │ ┌─────────────────────────────┐ │             │ │
│             │ │      Input Controls         │ │             │ │
│             │ │                             │ │             │ │
│             │ │ [Course] [Files] [YouTube]  │ │             │ │
│             │ │                             │ │             │ │
│             │ │ ┌─────────────────────────┐ │ │             │ │
│             │ │ │    Message Input        │ │ │             │ │
│             │ │ │                         │ │ │             │ │
│             │ │ └─────────────────────────┘ │ │             │ │
│             │ │                    [Send]   │ │             │ │
│             │ └─────────────────────────────┘ │             │ │
└─────────────┴─────────────────────────────────┴─────────────────┘
```

## Component Hierarchy

```
ChatbotInterface
├── ChatSidebar
│   ├── Model Toggle (Basic/Advanced)
│   ├── New Chat Button
│   └── Sessions List
│       ├── Session Item (with rename/delete)
│       └── Session Meta (time, course)
├── ChatMain
│   ├── Header (title, actions)
│   ├── MessageList
│   │   ├── User Message
│   │   ├── AI Response
│   │   └── Typing Indicator
│   └── Input Area
│       ├── Input Controls
│       │   ├── Class Selector
│       │   ├── FileUpload
│       │   └── YoutubeInput
│       ├── Attachments Preview
│       └── Message Input + Send Button
└── ChatRightPanel
    ├── Suggested Prompts
    ├── Study Tips
    └── Model Information
```

## Data Flow

```
User Input → ChatMain → useChatbotStore → State Update
     ↓
Message Added → MessageList → UI Update
     ↓
AI Response → State Update → MessageList → UI Update
```

## State Management

```
useChatbotStore
├── Sessions: Record<string, ChatSession>
├── Current Session ID
├── Selected Model (Basic/Advanced)
├── UI State (typing, error)
└── Actions
    ├── createSession()
    ├── deleteSession()
    ├── selectSession()
    ├── addMessage()
    ├── updateMessage()
    └── setSelectedModel()
```

## Key Features

1. **Model Switching**: Toggle between Basic and Advanced AI modes
2. **Session Management**: Create, rename, delete chat sessions
3. **File Uploads**: Support for PDF, DOCX, TXT, RTF files
4. **YouTube Integration**: Process video links
5. **Course Context**: Select courses for contextual responses
6. **Responsive Design**: Mobile-friendly layout
7. **Persistent Storage**: Sessions saved across app restarts
8. **Real-time UI**: Typing indicators and smooth interactions

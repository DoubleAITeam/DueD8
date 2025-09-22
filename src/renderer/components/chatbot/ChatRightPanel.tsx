import React from 'react';
import { XIcon, LightbulbIcon, BookOpenIcon, SparklesIcon } from '../icons';
import { type AIModel } from '../../state/chatbot';

type ChatRightPanelProps = {
  onClose: () => void;
  selectedModel: AIModel;
  onPromptClick?: (prompt: string) => void;
};

export default function ChatRightPanel({ onClose, selectedModel, onPromptClick }: ChatRightPanelProps) {
  const basicPrompts = [
    "Explain this concept in simple terms",
    "Help me understand the main points",
    "What are the key takeaways?",
    "Can you summarize this for me?",
    "I need help with basic concepts",
    "What should I focus on studying?",
  ];

  const advancedPrompts = [
    "Analyze this topic in depth",
    "Compare and contrast these concepts",
    "What are the implications of this theory?",
    "Help me develop a research question",
    "Critically evaluate this argument",
    "What are the current debates in this field?",
    "Help me understand the methodology",
    "What are the limitations of this approach?",
  ];

  const studyTips = [
    {
      icon: BookOpenIcon,
      title: "Active Reading",
      description: "Ask questions while reading and summarize key points in your own words."
    },
    {
      icon: SparklesIcon,
      title: "Spaced Repetition",
      description: "Review material at increasing intervals to improve long-term retention."
    },
    {
      icon: LightbulbIcon,
      title: "Concept Mapping",
      description: "Create visual diagrams to connect related concepts and ideas."
    }
  ];

  const currentPrompts = selectedModel === 'basic' ? basicPrompts : advancedPrompts;

  return (
    <div className="chat-right-panel">
      <div className="chat-right-panel__header">
        <h3 className="chat-right-panel__title">Tips & Prompts</h3>
        <button className="close-panel-btn" onClick={onClose}>
          <XIcon size={16} />
        </button>
      </div>

      <div className="chat-right-panel__content">
        <div className="prompts-section">
          <h4 className="prompts-section__title">
            Suggested Prompts ({selectedModel === 'basic' ? 'Basic' : 'Advanced'})
          </h4>
          <div className="prompts-list">
            {currentPrompts.map((prompt, index) => (
              <button
                key={index}
                className="prompt-item"
                onClick={() => onPromptClick?.(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="tips-section">
          <h4 className="tips-section__title">Study Tips</h4>
          <div className="tips-list">
            {studyTips.map((tip, index) => (
              <div key={index} className="tip-item">
                <div className="tip-item__icon">
                  <tip.icon size={20} />
                </div>
                <div className="tip-item__content">
                  <h5 className="tip-item__title">{tip.title}</h5>
                  <p className="tip-item__description">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="model-info">
          <h4 className="model-info__title">Current Model: {selectedModel === 'basic' ? 'Basic' : 'Advanced'}</h4>
          <div className="model-info__description">
            {selectedModel === 'basic' ? (
              <p>Basic mode provides simple explanations and general guidance. Perfect for quick questions and basic concepts.</p>
            ) : (
              <p>Advanced mode offers detailed analysis, complex problem-solving, and comprehensive academic support. Ideal for research and in-depth study.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

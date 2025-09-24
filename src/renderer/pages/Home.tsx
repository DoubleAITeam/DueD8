// src/pages/Home.tsx
import React from 'react';
import TextType from '../components/TextType';
import GradientBlinds from '../components/GradientBlinds';
import ShinyText from '../components/ShinyText';

export default function Home() {
  return (
    <div className="home-container">
      <GradientBlinds
        gradientColors={['#FF9FFC', '#5227FF']}
        angle={0}
        noise={0.3}
        blindCount={12}
        blindMinWidth={50}
        spotlightRadius={0.5}
        spotlightSoftness={1}
        spotlightOpacity={1}
        mouseDampening={0.15}
        distortAmount={0}
        shineDirection="left"
        mixBlendMode="lighten"
      />
      
      <div className="home-content">
        <TextType 
          text={[
            "Welcome to DueD8.",
            "This isn't just a planner; it's your AI-powered command center.",
            "Let's make every deadline your advantage."
          ]}
          typingSpeed={75}
          pauseDuration={1500}
          showCursor={true}
          cursorCharacter="|"
          className="welcome-text"
        />
        
        <button className="lock-in-button">
          <ShinyText 
            text="Lock in" 
            disabled={false} 
            speed={3} 
            className="button-shiny-text" 
          />
        </button>
      </div>
    </div>
  );
}
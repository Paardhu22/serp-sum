import React, { useState } from 'react';

interface FloatingTriggerProps {
  onClick: () => void;
}

export const FloatingTrigger: React.FC<FloatingTriggerProps> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        top: '85%',
        transform: 'translateY(-50%)',
        right: 0,
        zIndex: 2147483647,
        background: 'rgba(30, 30, 30, 0.8)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px 0 0 12px',
        boxShadow: '-2px 0 10px rgba(0,0,0,0.2)',
        padding: isHovered ? '12px 14px' : '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'padding 0.2s ease-in-out',
      }}
    >
      <img
        src={chrome.runtime.getURL("Gemini_Generated_Image_v58ufcv58ufcv58u-removebg-preview.png")}
        alt="Open Sidebar"
        style={{ width: '24px', height: '24px' }}
      />
    </div>
  );
};

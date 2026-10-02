import React, { useState, useEffect } from 'react';
import { AIDA_MOODS, AIDA_DIALOGUE_GRAPH } from '../game/aidaDialogue';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

export default function AidaDialogueModal({ nodeKey = 'awakening_intro', onClose, onSelectChoice }) {
  const node = AIDA_DIALOGUE_GRAPH[nodeKey] || AIDA_DIALOGUE_GRAPH.awakening_intro;
  const mood = AIDA_MOODS[node.mood] || AIDA_MOODS.calm;
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    setLineIdx(0);
    if (Audio.aidaVoice) Audio.aidaVoice(node.mood);
  }, [nodeKey, node.mood]);

  const currentLine = node.lines[lineIdx] || node.lines[0];
  const isLastLine = lineIdx >= node.lines.length - 1;

  const handleNext = () => {
    if (!isLastLine) {
      setLineIdx(i => i + 1);
      if (Audio.aidaVoice) Audio.aidaVoice(node.mood);
    }
  };

  const handleChoice = (choice) => {
    if (Audio.uiClick) Audio.uiClick();
    if (choice.to === 'end') {
      onClose(choice);
    } else {
      onSelectChoice(choice.to, choice);
    }
  };

  // E / Space / Enter used to close the modal from StationRoom instead of
  // advancing the line — after inserting the core the player hammers E and
  // the talk vanishes. Advance here; Escape still closes.
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        if (!isLastLine) handleNext();
      }
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [isLastLine, onClose, nodeKey]);

  return (
    <div className="aida-dialogue-overlay" onClick={isLastLine ? undefined : handleNext}>
      <div
        className="aida-dialogue-box"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLastLine) handleNext();
        }}
      >
        <div className="aida-holo-header">
          <div className="aida-holo-avatar" style={{ borderColor: mood.color, boxShadow: `0 0 20px ${mood.color}66` }}>
            <GameIcon name="orb" size={28} tone={mood.color} />
            <div className="aida-holo-scanlines" />
          </div>
          <div className="aida-holo-meta">
            <div className="aida-holo-name" style={{ color: mood.color }}>{node.speaker}</div>
            <div className="aida-holo-status">
              <span className="aida-status-dot" style={{ backgroundColor: mood.color }} />
              STATUS: {mood.label.toUpperCase()} · ORBITAL SANCTUARY
            </div>
          </div>
        </div>

        <div className="aida-holo-body">
          <p className="aida-holo-text">{currentLine}</p>
          {!isLastLine && (
            <div className="aida-holo-continue">
              <span>TAP TO CONTINUE</span>
              <span className="aida-continue-arrow">▶</span>
            </div>
          )}
        </div>

        {isLastLine && node.choices && node.choices.length > 0 && (
          <div className="aida-holo-choices" onClick={e => e.stopPropagation()}>
            {node.choices.map((choice, idx) => (
              <button
                key={idx}
                className="aida-holo-choice-btn"
                onClick={() => handleChoice(choice)}
              >
                <span className="aida-choice-bullet">◆</span>
                <span className="aida-choice-label">{choice.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

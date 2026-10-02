import React from 'react';
import { getCurrentStationQuest, claimStationQuest } from '../game/stationQuests';
import { storyBeat } from '../game/campaign';
import GameIcon from './GameIcon';
import { fireClaimFx, CAMP_CLAIM_FLY } from './ClaimFx';

export default function StationQuestBanner({ save, setSave, onTalkAida, onCheer, onGather }) {
  const currentQuest = getCurrentStationQuest(save);
  if (!currentQuest) return null;

  const isReady = currentQuest.status === 'ready';
  const beat = storyBeat(save);
  const needsGather = beat.why === 'gather';

  const handleClaim = (e) => {
    e.stopPropagation();
    fireClaimFx(e.currentTarget, currentQuest.reward, { flyTo: CAMP_CLAIM_FLY });
    if (onCheer) onCheer();
    setSave(s => claimStationQuest(s, currentQuest.id));
  };

  const handleGather = (e) => {
    e.stopPropagation();
    if (onGather) onGather();
  };

  return (
    <div className={`station-quest-banner ${isReady ? 'is-ready' : ''}${needsGather ? ' is-gather' : ''}`} onClick={() => onTalkAida && onTalkAida(needsGather ? 'quest_gather' : currentQuest.dialogueKey)}>
      <div className="sqb-left">
        <div className="sqb-icon-badge" style={{ borderColor: currentQuest.accent, color: currentQuest.accent }}>
          <GameIcon name={currentQuest.icon} size={22} tone={currentQuest.accent} />
        </div>
        <div className="sqb-info">
          <div className="sqb-title-row">
            <span className="sqb-tag">STATION STORYLINE</span>
            <span className="sqb-title">{currentQuest.title}</span>
          </div>
          <div className="sqb-desc">{currentQuest.desc}</div>
        </div>
      </div>

      <div className="sqb-right">
        {isReady ? (
          <button className="sqb-claim-btn" onClick={handleClaim}>
            <span>CLAIM REWARD</span>
          </button>
        ) : needsGather && onGather ? (
          <button className="sqb-gather-btn" onClick={handleGather} data-testid="station-quest-gather">
            <span>GO GATHER</span>
          </button>
        ) : (
          <div className="sqb-progress-pill">
            <span className="sqb-dot" />
            <span>IN PROGRESS</span>
          </div>
        )}
      </div>
    </div>
  );
}

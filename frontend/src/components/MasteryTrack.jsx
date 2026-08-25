import React, { useState, useRef, useEffect } from 'react';
import { MASTERY_TIERS, CHEST_VISUALS, pendingMasteryChests, claimMasteryChest, fmtMP } from '../game/masterMilestones';
import { rollRune } from '../game/runes';
import { rollCard } from '../game/petTcg';
import { rollPartsDrop, addParts } from '../game/gear';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import GameIcon from './GameIcon';
import { fireClaimFx } from './ClaimFx';

// =============================================
// MASTERY TRACK — the horizontal chest reward line
// =============================================
// Renders a scrollable gold progress track with chest icons at each tier.
// Chests pulse when claimable and burst open on tap. This is the HERO
// section of the Welcome screen — the single place a player sees every
// piece of progress they have ever made across every game mode, counted
// and rewarded.

export default function MasteryTrack({ save, setSave }) {
  const mp = save.mastery?.points || 0;
  const claimed = save.mastery?.claimed || {};
  const pending = pendingMasteryChests(save);
  const trackRef = useRef(null);
  const [claimingIdx, setClaimingIdx] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-scroll to the first claimable chest on mount
  useEffect(() => {
    if (!trackRef.current) return;
    const firstClaimable = trackRef.current.querySelector('.mastery-chest.ready');
    if (firstClaimable) {
      firstClaimable.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  // Find the current progress tier (first unclaimed tier, or last tier if all claimed)
  const currentTierIdx = MASTERY_TIERS.findIndex(t => mp < t.threshold);
  const prevThreshold = currentTierIdx > 0 ? MASTERY_TIERS[currentTierIdx - 1].threshold : 0;
  const nextThreshold = currentTierIdx >= 0 ? MASTERY_TIERS[currentTierIdx].threshold : MASTERY_TIERS[MASTERY_TIERS.length - 1].threshold;
  const segmentProgress = nextThreshold > prevThreshold
    ? Math.min(1, (mp - prevThreshold) / (nextThreshold - prevThreshold))
    : 1;

  const claimChest = (tierIdx, e) => {
    const tier = MASTERY_TIERS[tierIdx];
    if (!tier || mp < tier.threshold || claimed[tierIdx]) return;

    setClaimingIdx(tierIdx);

    setSave(cur => {
      let ns = claimMasteryChest(cur, tierIdx);

      // Roll runes if the tier awards them
      if (tier.rewards.rune) {
        const runes = [...(ns.runeInventory || [])];
        for (let i = 0; i < tier.rewards.rune; i++) runes.push(rollRune(ns.attrs?.luck || 0));
        ns = { ...ns, runeInventory: runes };
      }
      // Roll TCG cards
      if (tier.rewards.tcgCard) {
        const cards = [...(ns.tcgCardInventory || [])];
        for (let i = 0; i < tier.rewards.tcgCard; i++) cards.push(rollCard(ns.attrs?.luck || 0));
        ns = { ...ns, tcgCardInventory: cards };
      }
      // Roll a gear part bonus
      const p = rollPartsDrop(1);
      ns.gearSlotParts = addParts(ns, p.slot, p.amount);

      return ns;
    });

    const vis = CHEST_VISUALS[tier.chestType];
    pushToast({
      tone: tier.chestType === 'monolith' ? 'legendary' : 'gold',
      icon: vis.icon,
      title: `${vis.label} opened!`,
      text: rewardSummary(tier.rewards),
    });

    if (e?.currentTarget) fireClaimFx(e.currentTarget, tier.rewards);
    Audio.levelUp?.();

    setTimeout(() => setClaimingIdx(null), 600);
  };

  const claimAll = (e) => {
    if (!pending.length) return;
    for (const p of pending) {
      claimChest(p.index, e);
    }
  };

  return (
    <div className="mastery-track-wrap" data-testid="mastery-track">
      {/* Header */}
      <div className="mastery-header">
        <div className="mastery-title">
          <GameIcon name="ui_star" size={18} tone="#ffd700" />
          <span>MASTERY REWARDS</span>
        </div>
        <div className="mastery-points">
          <span className="mastery-mp-value">{fmtMP(mp)}</span>
          <span className="mastery-mp-label">MP</span>
        </div>
      </div>

      {/* Progress bar between current tiers */}
      <div className="mastery-progress-bar">
        <div className="mastery-progress-fill" style={{ width: `${segmentProgress * 100}%` }} />
        <span className="mastery-progress-text">
          {fmtMP(mp)} / {fmtMP(nextThreshold)}
        </span>
      </div>

      {/* Scrollable chest track */}
      <div className="mastery-track-scroll" ref={trackRef}>
        <div className="mastery-track-line">
          {MASTERY_TIERS.map((tier, idx) => {
            const done = !!claimed[idx];
            const ready = !done && mp >= tier.threshold;
            const vis = CHEST_VISUALS[tier.chestType];
            const pct = MASTERY_TIERS.length > 1
              ? (idx / (MASTERY_TIERS.length - 1)) * 100
              : 50;

            return (
              <div
                key={idx}
                className={`mastery-chest ${tier.chestType} ${done ? 'done' : ready ? 'ready' : 'locked'} ${claimingIdx === idx ? 'claiming' : ''}`}
                style={{ left: `${pct}%`, '--chest-glow': vis.glow }}
                onClick={(e) => ready && claimChest(idx, e)}
                title={`${vis.label} — ${fmtMP(tier.threshold)} MP`}
              >
                <div className="mastery-chest-icon">
                  <GameIcon name={vis.icon} size={done ? 22 : ready ? 28 : 20} tone={done ? '#666' : vis.glow} />
                </div>
                <div className="mastery-chest-threshold">{fmtMP(tier.threshold)}</div>
                {done && <div className="mastery-chest-check"><GameIcon name="ui_check" size={12} tone="#4dffd4" /></div>}
                {ready && <div className="mastery-chest-bang">!</div>}
              </div>
            );
          })}
          {/* The gold track line itself */}
          <div className="mastery-track-gold-line" />
          {/* Fill up to current progress */}
          <div
            className="mastery-track-gold-fill"
            style={{
              width: `${currentTierIdx >= 0
                ? ((currentTierIdx > 0 ? currentTierIdx - 1 : 0) / (MASTERY_TIERS.length - 1)) * 100 + segmentProgress * (100 / (MASTERY_TIERS.length - 1))
                : 100}%`
            }}
          />
        </div>
      </div>

      {/* Claim all button */}
      {pending.length > 0 && (
        <button className="mastery-claim-all" onClick={claimAll} data-testid="mastery-claim-all">
          <GameIcon name="ui_chest" size={16} tone="#ffd700" />
          <span>OPEN {pending.length} CHEST{pending.length > 1 ? 'S' : ''}</span>
        </button>
      )}

      {/* Details toggle */}
      <button className="mastery-details-btn" onClick={() => setShowDetails(!showDetails)}>
        <GameIcon name="ui_scroll" size={14} />
        <span>{showDetails ? 'Hide' : 'Reward'} Details</span>
      </button>

      {/* Expanded details panel */}
      {showDetails && (
        <div className="mastery-details-panel">
          {MASTERY_TIERS.map((tier, idx) => {
            const done = !!claimed[idx];
            const ready = !done && mp >= tier.threshold;
            const vis = CHEST_VISUALS[tier.chestType];
            return (
              <div key={idx} className={`mastery-detail-row ${done ? 'done' : ready ? 'ready' : ''}`}>
                <span className="mastery-detail-icon">
                  <GameIcon name={vis.icon} size={18} tone={done ? '#555' : vis.glow} />
                </span>
                <span className="mastery-detail-name" style={{ color: done ? '#555' : vis.glow }}>
                  {vis.label}
                </span>
                <span className="mastery-detail-threshold">{fmtMP(tier.threshold)} MP</span>
                <span className="mastery-detail-rewards">{rewardSummary(tier.rewards)}</span>
                {done && <span className="mastery-detail-check"><GameIcon name="ui_check" size={14} tone="#4dffd4" /></span>}
                {ready && (
                  <button className="mastery-detail-claim" onClick={(e) => claimChest(idx, e)}>
                    OPEN
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Helpers ----------------------------------------------------------------

function rewardSummary(rewards) {
  const parts = [];
  if (rewards.gold) parts.push(`${rewards.gold} Gold`);
  if (rewards.gems) parts.push(`${rewards.gems} Gems`);
  if (rewards.sp) parts.push(`${rewards.sp} SP`);
  if (rewards.slotCoins) parts.push(`${rewards.slotCoins} Coins`);
  if (rewards.gachaTokens) parts.push(`${rewards.gachaTokens} Tokens`);
  if (rewards.gearParts) parts.push(`${rewards.gearParts} Parts`);
  if (rewards.rune) parts.push(`${rewards.rune} Rune${rewards.rune > 1 ? 's' : ''}`);
  if (rewards.tcgCard) parts.push(`${rewards.tcgCard} Card${rewards.tcgCard > 1 ? 's' : ''}`);
  if (rewards.flux) parts.push(`${rewards.flux} Flux`);
  return parts.join(' + ') || 'Mystery reward';
}

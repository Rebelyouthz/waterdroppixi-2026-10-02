import React, { useState, useRef, useEffect } from 'react';
import GameIcon from './GameIcon';
import { STAR_RAID_TIERS, pendingStarRaidChests, claimStarRaidChest } from '../game/starRaidMilestones';
import { CHEST_VISUALS } from '../game/masterMilestones';
import { pushToast } from '../game/toastBus';
import { Audio } from '../game/audio';
import { rollRune } from '../game/runes';
// `../game/cards` does not exist. `rollCard(luckBonus)` lives in petTcg.js,
// and the call site here passes exactly that argument.
import { rollCard } from '../game/petTcg';
import { fireClaimFx } from './ClaimFx';

const fmtSRP = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function StarRaidMilestonesTrack({ save, setSave }) {
  const sr = save.starRaid || {};
  const srp = sr.milestonePoints || 0;
  const claimed = sr.milestoneClaimed || {};
  
  const pending = pendingStarRaidChests(save);
  const trackRef = useRef(null);
  const [claimingIdx, setClaimingIdx] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!trackRef.current) return;
    const firstClaimable = trackRef.current.querySelector('.mastery-chest.ready');
    if (firstClaimable) {
      firstClaimable.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  const currentTierIdx = STAR_RAID_TIERS.findIndex(t => srp < t.threshold);
  const prevThreshold = currentTierIdx > 0 ? STAR_RAID_TIERS[currentTierIdx - 1].threshold : 0;
  const nextThreshold = currentTierIdx >= 0 ? STAR_RAID_TIERS[currentTierIdx].threshold : STAR_RAID_TIERS[STAR_RAID_TIERS.length - 1].threshold;
  const segmentProgress = nextThreshold > prevThreshold
    ? Math.min(1, (srp - prevThreshold) / (nextThreshold - prevThreshold))
    : 1;

  const claimChest = (tierIdx, e) => {
    const tier = STAR_RAID_TIERS[tierIdx];
    if (!tier || srp < tier.threshold || claimed[tierIdx]) return;

    setClaimingIdx(tierIdx);

    setSave(cur => {
      let ns = claimStarRaidChest(cur, tierIdx);

      if (tier.rewards.rune) {
        const runes = [...(ns.runeInventory || [])];
        for (let i = 0; i < tier.rewards.rune; i++) runes.push(rollRune(ns.attrs?.luck || 0));
        ns = { ...ns, runeInventory: runes };
      }
      if (tier.rewards.tcgCard) {
        const cards = [...(ns.tcgCardInventory || [])];
        for (let i = 0; i < tier.rewards.tcgCard; i++) cards.push(rollCard(ns.attrs?.luck || 0));
        ns = { ...ns, tcgCardInventory: cards };
      }
      return ns;
    });

    const vis = CHEST_VISUALS[tier.chestType] || CHEST_VISUALS['bronze'];
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
    <div className="mastery-track-wrap star-raid-milestones" data-testid="starraid-milestone-track">
      <div className="mastery-header">
        <div className="mastery-title" style={{ color: '#5fd6ff' }}>
          <GameIcon name="ui_rocket" size={18} tone="#5fd6ff" />
          <span>ATLAS MILESTONES</span>
        </div>
        <div className="mastery-points">
          <span className="mastery-mp-value" style={{ color: '#5fd6ff', textShadow: '0 0 10px rgba(95,214,255,0.5)' }}>{fmtSRP(srp)}</span>
          <span className="mastery-mp-label">SRP</span>
        </div>
      </div>

      <div className="mastery-progress-bar">
        <div className="mastery-progress-fill" style={{ width: `${segmentProgress * 100}%`, background: 'linear-gradient(90deg, #00507a 0%, #5fd6ff 100%)' }} />
        <span className="mastery-progress-text">
          {fmtSRP(srp)} / {fmtSRP(nextThreshold)}
        </span>
      </div>

      <div className="mastery-track-scroll" ref={trackRef}>
        <div className="mastery-track-line">
          {STAR_RAID_TIERS.map((tier, idx) => {
            const done = !!claimed[idx];
            const ready = !done && srp >= tier.threshold;
            const vis = CHEST_VISUALS[tier.chestType] || CHEST_VISUALS['bronze'];
            const pct = STAR_RAID_TIERS.length > 1
              ? (idx / (STAR_RAID_TIERS.length - 1)) * 100
              : 50;

            return (
              <div
                key={idx}
                className={`mastery-chest ${tier.chestType} ${done ? 'done' : ready ? 'ready' : 'locked'} ${claimingIdx === idx ? 'claiming' : ''}`}
                style={{ left: `${pct}%`, '--chest-glow': vis.glow }}
                onClick={(e) => ready && claimChest(idx, e)}
                title={`${vis.label} ?" ${fmtSRP(tier.threshold)} SRP`}
              >
                <div className="mastery-chest-icon">
                  <GameIcon name={vis.icon} size={done ? 22 : ready ? 28 : 20} tone={done ? '#666' : vis.glow} />
                </div>
                <div className="mastery-chest-threshold">{fmtSRP(tier.threshold)}</div>
                {done && <div className="mastery-chest-check"><GameIcon name="ui_check" size={12} tone="#4dffd4" /></div>}
                {ready && <div className="mastery-chest-bang">!</div>}
              </div>
            );
          })}
          <div className="mastery-track-gold-line" style={{ background: '#002a40' }} />
          <div
            className="mastery-track-gold-fill"
            style={{
              background: '#5fd6ff',
              boxShadow: '0 0 10px #5fd6ff',
              width: `${currentTierIdx >= 0
                ? ((currentTierIdx > 0 ? currentTierIdx - 1 : 0) / (STAR_RAID_TIERS.length - 1)) * 100 + segmentProgress * (100 / (STAR_RAID_TIERS.length - 1))
                : 100}%`
            }}
          />
        </div>
      </div>

      {pending.length > 0 && (
        <button className="mastery-claim-all" onClick={claimAll} style={{ background: '#002a40', borderColor: '#5fd6ff', color: '#5fd6ff' }}>
          <GameIcon name="ui_chest" size={16} tone="#5fd6ff" />
          <span>OPEN {pending.length} CHEST{pending.length > 1 ? 'S' : ''}</span>
        </button>
      )}

      <button className="mastery-details-btn" onClick={() => setShowDetails(!showDetails)} style={{ color: '#5fd6ff' }}>
        <GameIcon name="ui_scroll" size={14} />
        <span>{showDetails ? 'Hide' : 'Reward'} Details</span>
      </button>

      {showDetails && (
        <div className="mastery-details-panel">
          {STAR_RAID_TIERS.map((tier, idx) => {
            const done = !!claimed[idx];
            const ready = !done && srp >= tier.threshold;
            const vis = CHEST_VISUALS[tier.chestType] || CHEST_VISUALS['bronze'];
            return (
              <div key={idx} className={`mastery-detail-row ${done ? 'done' : ready ? 'ready' : ''}`}>
                <span className="mastery-detail-icon">
                  <GameIcon name={vis.icon} size={18} tone={done ? '#555' : vis.glow} />
                </span>
                <span className="mastery-detail-name" style={{ color: done ? '#555' : vis.glow }}>
                  {vis.label}
                </span>
                <span className="mastery-detail-threshold">{fmtSRP(tier.threshold)} SRP</span>
                <span className="mastery-detail-rewards">{rewardSummary(tier.rewards)}</span>
                {done && <span className="mastery-detail-check"><GameIcon name="ui_check" size={14} tone="#4dffd4" /></span>}
                {ready && (
                  <button className="mastery-detail-claim" onClick={(e) => claimChest(idx, e)} style={{ background: '#5fd6ff', color: '#000' }}>
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

function rewardSummary(rewards) {
  const parts = [];
  if (rewards.scrap) parts.push(`${rewards.scrap} Scrap`);
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

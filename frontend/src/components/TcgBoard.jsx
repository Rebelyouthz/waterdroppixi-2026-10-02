import React from 'react';
import { CARD_RARITY_COLORS } from '../game/petTcg';
import { PET_TYPES } from './PetPanel';
import GameIcon from './GameIcon';

export const KIND_LABEL = { strike: 'Strike', guard: 'Guard', drain: 'Drain', heal: 'Heal', rally: 'Rally', overload: 'Overload' };

// Same colours pixiRenderer.js already uses for these pet types — the type
// wheel needs to be readable at a glance on a card, and reusing the palette
// the pet already wears elsewhere means no second colour language to learn.
export const TYPE_TAG = {
  aquaSprite: { label: 'AQUA',   color: '#5ba3ff' },
  emberFairy: { label: 'EMBER',  color: '#ff7a1a' },
  shadowWisp: { label: 'SHADOW', color: '#b362ff' },
  stormHawk:  { label: 'STORM',  color: '#ffe44d' },
  lifeSprite: { label: 'LIFE',   color: '#4dffd4' },
};

export function CardFace({ card, onClick, disabled, small }) {
  const rc = CARD_RARITY_COLORS[card.rarity];
  const tt = TYPE_TAG[card.type];
  return (
    <button className={`tcg-card${small ? ' small' : ''}`} style={{ '--rc': rc }}
            onClick={onClick} disabled={disabled} data-testid={`tcg-card-${card.id}`}>
      <div className="tcg-card-top">
        <GameIcon name={card.icon} size={small ? 18 : 24} tone={rc} />
        <span className="tcg-card-cost">{card.cost}</span>
      </div>
      <div className="tcg-card-name">{card.name}</div>
      <div className="tcg-card-kind">{KIND_LABEL[card.kind]}</div>
      <div className="tcg-card-power">{card.kind === 'rally' ? `+${Math.round(card.power * 100)}%` : Math.round(card.power)}</div>
      {tt && <span className="tcg-card-type" style={{ '--tc': tt.color }}>{tt.label}</span>}
    </button>
  );
}

// The live battle board — hand, HP bars, energy, log. Shared between
// TcgScreen's practice battles and Exploration's encounter/trainer nodes so
// the two never drift into two different-feeling versions of the same
// fight. `resultChildren` is whatever the caller wants shown once the
// battle is over (rematch buttons for practice, claim-prize for a wager) —
// the board itself doesn't know or care which context it's in.
export default function TcgBoard({ battle, yourName, resolving, onPlayCard, onPass, resultChildren }) {
  return (
    <div className="tcg-board">
      <div className="tcg-side">
        <div className="tcg-side-label">
          {yourName || 'YOU'}
          {TYPE_TAG[battle.you.type] && <span className="tcg-card-type" style={{ '--tc': TYPE_TAG[battle.you.type].color }}>{TYPE_TAG[battle.you.type].label}</span>}
        </div>
        <div className="tcg-hpbar"><i style={{ width: `${(battle.you.hp / battle.you.maxHp) * 100}%` }} /></div>
        <div className="tcg-hptext">{Math.ceil(battle.you.hp)}/{battle.you.maxHp}{battle.you.shield > 0 && <> · <GameIcon name="ui_shield" size={12} />{Math.round(battle.you.shield)}</>}</div>
        <div className="tcg-energy">{Array.from({ length: battle.you.maxEnergy }).map((_, i) => (
          <i key={i} className={i < battle.you.energy ? 'on' : ''} />
        ))}</div>
      </div>
      <div className="tcg-vs">TURN {battle.turn}</div>
      <div className="tcg-side">
        <div className="tcg-side-label">
          {battle.foeName || PET_TYPES.find(t => t.id === battle.foe.type)?.name || 'FOE'}
          {TYPE_TAG[battle.foe.type] && <span className="tcg-card-type" style={{ '--tc': TYPE_TAG[battle.foe.type].color }}>{TYPE_TAG[battle.foe.type].label}</span>}
        </div>
        <div className="tcg-hpbar foe"><i style={{ width: `${(battle.foe.hp / battle.foe.maxHp) * 100}%` }} /></div>
        <div className="tcg-hptext">{Math.ceil(battle.foe.hp)}/{battle.foe.maxHp}{battle.foe.shield > 0 && <> · <GameIcon name="ui_shield" size={12} />{Math.round(battle.foe.shield)}</>}</div>
      </div>

      <div className="tcg-log">
        {battle.log.map((l, i) => (
          <div key={i} className={`tcg-log-row ${l.who}`}>{l.who === 'you' ? '▸' : '◂'} {l.text}</div>
        ))}
      </div>

      {battle.over ? (
        <div className={`tcg-result ${battle.winner}`}>
          <div className="tcg-result-title">
            {battle.winner === 'you' ? 'VICTORY' : battle.winner === 'foe' ? 'DEFEAT' : 'DRAW'}
          </div>
          {resultChildren}
        </div>
      ) : (
        <>
          <div className="tcg-hand">
            {battle.you.hand.map(c => (
              <CardFace key={c.id} card={c} disabled={resolving || c.cost > battle.you.energy}
                        onClick={() => onPlayCard(c)} />
            ))}
          </div>
          <button className="prosp-btn ghost" disabled={resolving} onClick={onPass} data-testid="tcg-pass">Pass turn</button>
        </>
      )}
    </div>
  );
}

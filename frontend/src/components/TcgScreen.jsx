import React, { useState } from 'react';
import {
  CARD_RARITY_COLORS, DECK_SIZE, DECK_MIN,
  resolveCard, deckIsValid, initBattle, resolveTurn, rollPracticeFoeDeck,
} from '../game/petTcg';
import { PET_TYPES, petStageMult } from './PetPanel';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

const KIND_LABEL = { strike: 'Strike', guard: 'Guard', drain: 'Drain', heal: 'Heal', rally: 'Rally', overload: 'Overload' };

// Same colours pixiRenderer.js already uses for these pet types (its
// PET_LIGHT_COLORS) — the type wheel needs to be readable AT A GLANCE on a
// card, and reusing the palette the pet already wears elsewhere means a
// player doesn't have to learn a second colour language for the same thing.
const TYPE_TAG = {
  aquaSprite: { label: 'AQUA',   color: '#5ba3ff' },
  emberFairy: { label: 'EMBER',  color: '#ff7a1a' },
  shadowWisp: { label: 'SHADOW', color: '#b362ff' },
  stormHawk:  { label: 'STORM',  color: '#ffe44d' },
  lifeSprite: { label: 'LIFE',   color: '#4dffd4' },
};

function CardFace({ card, onClick, disabled, small }) {
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

// Pet TCG. Three tabs: the collection you've pulled from Prospector/Clicker,
// the deck you build per pet from it, and a practice battle to actually
// play with what you built. No wagering here yet — that lands with the
// Exploration mode and its NPC trainers, on top of this same engine.
export default function TcgScreen({ save, setSave, onClose }) {
  const [tab, setTab] = useState('deck'); // 'cards' | 'deck' | 'battle'
  const inventory = save.tcgCardInventory || [];
  const decks = save.tcgDecks || {};
  const pets = save.pets || [];

  const [deckPetId, setDeckPetId] = useState(pets[0]?.id || null);
  const [battlePetId, setBattlePetId] = useState(pets[0]?.id || null);
  const [battle, setBattle] = useState(null);   // live petTcg state, or null
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState(null);   // 'you' | 'foe' | 'draw' | null

  const resolved = inventory.map(resolveCard).sort((a, b) => a.type.localeCompare(b.type) || b.power - a.power);
  const deckPet = pets.find(p => p.id === deckPetId);
  const battlePet = pets.find(p => p.id === battlePetId);
  const curDeckIds = decks[deckPetId] || [];

  const toggleDeckCard = (cardId) => {
    const cur = decks[deckPetId] || [];
    const inDeck = cur.includes(cardId);
    if (!inDeck && cur.length >= DECK_SIZE) return;
    const next = inDeck ? cur.filter(id => id !== cardId) : [...cur, cardId];
    setSave({ ...save, tcgDecks: { ...decks, [deckPetId]: next } });
    Audio.click();
  };

  const startBattle = () => {
    const deckIds = decks[battlePetId] || [];
    if (!battlePet || !deckIsValid(deckIds)) return;
    const foeType = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)].id;
    const foeLevel = battlePet.level;
    const foeDeck = rollPracticeFoeDeck(DECK_SIZE, 0);
    setBattle(initBattle({
      deckIds, cardInventory: inventory,
      petType: battlePet.type, petLevel: battlePet.level, petStageMult: petStageMult(battlePet.level),
      foeDeckIds: foeDeck.deckIds, foeCardInventory: foeDeck.cardInventory,
      foeType, foeLevel, foeStageMult: petStageMult(foeLevel),
    }));
    setResult(null);
    Audio.cardShuffle();
  };

  const playCard = (card) => {
    if (!battle || battle.over || resolving) return;
    if (card && card.cost > battle.you.energy) return;
    setResolving(true);
    Audio.cardLay();
    setTimeout(() => {
      const next = resolveTurn(battle, card);
      setBattle(next);
      setResolving(false);
      Audio.cardFlip();
      if (next.over) {
        setResult(next.winner);
        if (next.winner === 'you') {
          setSave(s => ({ ...s, petFood: (s.petFood || 0) + 3 }));
          Audio.rewardFanfare();
        } else {
          Audio.hit();
        }
      }
    }, 550);
  };

  const passTurn = () => playCard(null);

  return (
    <div className="modal-overlay" data-testid="tcg-screen" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) onClose(); }}>
      <div className="forge-panel forge-panel-scrollable" style={{ maxWidth: 760 }}>
        <div className="forge-header">
          <div className="forge-title">⚔ PET TCG</div>
          <div style={{ fontFamily: 'VT323', fontSize: 14, color: 'var(--ink-dim)' }}>🃏 {inventory.length} cards</div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        <div className="gear-tabs" style={{ marginBottom: 12 }}>
          <button className={`gear-tab ${tab === 'cards' ? 'active' : ''}`} onClick={() => setTab('cards')} data-testid="tcg-tab-cards">🃏 CARDS</button>
          <button className={`gear-tab ${tab === 'deck' ? 'active' : ''}`} onClick={() => setTab('deck')} data-testid="tcg-tab-deck">📋 DECK</button>
          <button className={`gear-tab ${tab === 'battle' ? 'active' : ''}`} onClick={() => setTab('battle')} data-testid="tcg-tab-battle">⚔ BATTLE</button>
        </div>

        {tab === 'cards' && (
          <div className="tcg-collection">
            {resolved.length === 0 ? (
              <div className="tcg-empty">No cards yet. Astro Prospector and the Clicker both find them.</div>
            ) : (
              <div className="tcg-card-grid">
                {resolved.map(c => <CardFace key={c.id} card={c} />)}
              </div>
            )}
          </div>
        )}

        {tab === 'deck' && (
          <div className="tcg-deck-tab">
            {pets.length === 0 ? (
              <div className="tcg-empty">No pets yet — hatch one first.</div>
            ) : (
              <>
                <div className="tcg-pet-picker">
                  {pets.map(p => {
                    const def = PET_TYPES.find(t => t.id === p.type);
                    return (
                      <button key={p.id} className={`tcg-pet-chip${deckPetId === p.id ? ' on' : ''}`}
                              onClick={() => setDeckPetId(p.id)} data-testid={`tcg-deckpet-${p.id}`}>
                        {def?.icon} {p.name || def?.name} <i>Lv{p.level}</i>
                      </button>
                    );
                  })}
                </div>
                <div className="tcg-deck-count">
                  {deckPet?.name || 'This pet'}'s deck: {curDeckIds.length}/{DECK_SIZE} socketed
                  {curDeckIds.length < DECK_MIN && <span className="tcg-deck-warn"> — need at least {DECK_MIN} to battle</span>}
                </div>
                <div className="tcg-card-grid">
                  {resolved.map(c => (
                    <CardFace key={c.id} card={c} small
                              onClick={() => toggleDeckCard(c.id)}
                              disabled={!curDeckIds.includes(c.id) && curDeckIds.length >= DECK_SIZE} />
                  ))}
                  {resolved.length === 0 && <div className="tcg-empty">No cards yet.</div>}
                </div>
                <div className="tcg-deck-hint">
                  Tap a card to socket or remove it. Cards don't have to match your pet's own type —
                  a couple of Heal cards on an Attack pet is a real choice, not a mistake.
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'battle' && (
          <div className="tcg-battle-tab">
            {!battle ? (
              <>
                <div className="tcg-pet-picker">
                  {pets.map(p => {
                    const def = PET_TYPES.find(t => t.id === p.type);
                    const valid = deckIsValid(decks[p.id] || []);
                    return (
                      <button key={p.id} className={`tcg-pet-chip${battlePetId === p.id ? ' on' : ''}${valid ? '' : ' invalid'}`}
                              onClick={() => setBattlePetId(p.id)} data-testid={`tcg-battlepet-${p.id}`}>
                        {def?.icon} {p.name || def?.name} <i>Lv{p.level}</i>
                        {!valid && <span className="tcg-pet-nodeck"> no deck</span>}
                      </button>
                    );
                  })}
                </div>
                <button className="prosp-btn go" disabled={!battlePet || !deckIsValid(decks[battlePetId] || [])}
                        onClick={startBattle} data-testid="tcg-start-battle">
                  ▶ PRACTICE BATTLE
                </button>
                <div className="tcg-deck-hint">Wins earn your pet a treat. A synthetic opponent for now — trainer battles with real stakes come with Exploration.</div>
              </>
            ) : (
              <div className="tcg-board">
                <div className="tcg-side">
                  <div className="tcg-side-label">
                    {battlePet?.name || 'YOU'}
                    {TYPE_TAG[battle.you.type] && <span className="tcg-card-type" style={{ '--tc': TYPE_TAG[battle.you.type].color }}>{TYPE_TAG[battle.you.type].label}</span>}
                  </div>
                  <div className="tcg-hpbar"><i style={{ width: `${(battle.you.hp / battle.you.maxHp) * 100}%` }} /></div>
                  <div className="tcg-hptext">{Math.ceil(battle.you.hp)}/{battle.you.maxHp}{battle.you.shield > 0 && ` · 🛡${Math.round(battle.you.shield)}`}</div>
                  <div className="tcg-energy">{Array.from({ length: battle.you.maxEnergy }).map((_, i) => (
                    <i key={i} className={i < battle.you.energy ? 'on' : ''} />
                  ))}</div>
                </div>
                <div className="tcg-vs">TURN {battle.turn}</div>
                <div className="tcg-side">
                  <div className="tcg-side-label">
                    {PET_TYPES.find(t => t.id === battle.foe.type)?.name || 'FOE'}
                    {TYPE_TAG[battle.foe.type] && <span className="tcg-card-type" style={{ '--tc': TYPE_TAG[battle.foe.type].color }}>{TYPE_TAG[battle.foe.type].label}</span>}
                  </div>
                  <div className="tcg-hpbar foe"><i style={{ width: `${(battle.foe.hp / battle.foe.maxHp) * 100}%` }} /></div>
                  <div className="tcg-hptext">{Math.ceil(battle.foe.hp)}/{battle.foe.maxHp}{battle.foe.shield > 0 && ` · 🛡${Math.round(battle.foe.shield)}`}</div>
                </div>

                <div className="tcg-log">
                  {battle.log.map((l, i) => (
                    <div key={i} className={`tcg-log-row ${l.who}`}>{l.who === 'you' ? '▸' : '◂'} {l.text}</div>
                  ))}
                </div>

                {result ? (
                  <div className={`tcg-result ${result}`}>
                    <div className="tcg-result-title">
                      {result === 'you' ? 'VICTORY' : result === 'foe' ? 'DEFEAT' : 'DRAW'}
                    </div>
                    <div className="tcg-result-actions">
                      <button className="prosp-btn go" onClick={startBattle} data-testid="tcg-rematch">↻ AGAIN</button>
                      <button className="prosp-btn ghost" onClick={() => setBattle(null)}>Back to decks</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tcg-hand">
                      {battle.you.hand.map(c => (
                        <CardFace key={c.id} card={c} disabled={resolving || c.cost > battle.you.energy}
                                  onClick={() => playCard(c)} />
                      ))}
                    </div>
                    <button className="prosp-btn ghost" disabled={resolving} onClick={passTurn} data-testid="tcg-pass">Pass turn</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

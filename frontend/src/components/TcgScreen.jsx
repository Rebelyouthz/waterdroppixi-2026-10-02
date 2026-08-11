import React, { useState } from 'react';
import {
  DECK_SIZE, DECK_MIN,
  resolveCard, deckIsValid, initBattle, resolveTurn, rollPracticeFoeDeck,
} from '../game/petTcg';
import { PET_TYPES, petStageMult } from './PetPanel';
import { Audio } from '../game/audio';
import TcgBoard, { CardFace } from './TcgBoard';

// Pet TCG. Three tabs: the collection you've pulled from Prospector/Clicker,
// the deck you build per pet from it, and a practice battle to actually
// play with what you built. Wagering lives in Exploration's trainer nodes,
// on top of this same engine (see game/exploration.js, ExplorationScreen).
export default function TcgScreen({ save, setSave, onClose }) {
  const [tab, setTab] = useState('deck'); // 'cards' | 'deck' | 'battle'
  const inventory = save.tcgCardInventory || [];
  const decks = save.tcgDecks || {};
  const pets = save.pets || [];

  const [deckPetId, setDeckPetId] = useState(pets[0]?.id || null);
  const [battlePetId, setBattlePetId] = useState(pets[0]?.id || null);
  const [battle, setBattle] = useState(null);   // live petTcg state, or null — battle.over/battle.winner drive the result panel
  const [resolving, setResolving] = useState(false);

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
      <div className="forge-panel forge-panel-scrollable tcg-panel" style={{ maxWidth: 760 }}>
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
              <div className="tcg-empty">No cards yet. The Lootmine and the Clicker both find them.</div>
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
                <div className="tcg-deck-hint">Wins earn your pet a treat. A synthetic opponent for now — trainer battles with real stakes live in Exploration.</div>
              </>
            ) : (
              <TcgBoard
                battle={battle} yourName={battlePet?.name} resolving={resolving}
                onPlayCard={playCard} onPass={passTurn}
                resultChildren={(
                  <div className="tcg-result-actions">
                    <button className="prosp-btn go" onClick={startBattle} data-testid="tcg-rematch">↻ AGAIN</button>
                    <button className="prosp-btn ghost" onClick={() => setBattle(null)}>Back to decks</button>
                  </div>
                )}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

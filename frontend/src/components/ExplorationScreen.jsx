import React, { useEffect, useRef, useState } from 'react';
import { rollPartsDrop, addParts } from '../game/gear';
import {
  NODE_SECONDS, generatePath, rollLootNode,
  rollTrainer, stakeOptions, rollNegotiatedPrizes, rollGamblePrize,
} from '../game/exploration';
import {
  DECK_SIZE, deckIsValid, initBattle, resolveTurn, rollPracticeFoeDeck, CARD_TEMPLATES,
  rollCard, generateCard,
} from '../game/petTcg';
import { PET_TYPES, petStageMult } from './PetPanel';
import { Audio } from '../game/audio';
import { pushToast } from '../game/toastBus';
import TcgBoard from './TcgBoard';
import GameIcon from './GameIcon';

const NODE_ICON = { loot: 'gem', encounter: 'swarm', trainer: 'trophy' };

function prizeLine(p) {
  if (!p) return '';
  if (p.type === 'card') return `🃏 ${p.card.templateId ? '' : ''}Card${p.card2 ? ' ×2' : ''}`;
  if (p.type === 'egg') return `🥚 ${p.rarity} egg`;
  if (p.type === 'gold') return `★ ${p.amount} gold`;
  return '';
}

// Builds a themed deck for a trainer — mostly their own type, a couple of
// neutral fillers — rather than a fully random practice deck, so beating a
// trainer feels like beating a personality with a plan, not a shuffled bag.
function trainerDeck(type, level) {
  const own = CARD_TEMPLATES.filter(t => t.type === type);
  const rest = CARD_TEMPLATES.filter(t => t.type !== type);
  const pool = [...own, ...own, ...rest].slice(0, DECK_SIZE);
  const rarity = level >= 14 ? 'rare' : level >= 9 ? 'magic' : 'common';
  const cards = pool.map(t => generateCard(t.id, rarity));
  return { deckIds: cards.map(c => c.id), cardInventory: cards };
}

// Exploration: a ~30s active walk, not idle like Patrol. Your character and
// active pet visibly move node to node; loot nodes pay out immediately,
// encounter nodes are a quick no-stakes TCG fight, and the one trainer node
// per walk is where the real wager happens — see game/exploration.js for
// why the shape is fixed (loot, loot, encounter, trainer, loot, loot)
// rather than randomized.
export default function ExplorationScreen({ save, setSave, onClose }) {
  // Menu track, not the run playlist -- Star Atlas is the only screen outside a
  // run with music of its own.
  useEffect(() => { Audio.swapToMenuMusic(); return () => Audio.swapToMenuMusic(); }, []);

  const pets = save.pets || [];
  const activePet = pets.find(p => p.active) || pets[0] || null;
  const decks = save.tcgDecks || {};
  const deckIds = activePet ? (decks[activePet.id] || []) : [];
  const ready = activePet && deckIsValid(deckIds);

  const [path] = useState(() => generatePath());
  const [nodeIdx, setNodeIdx] = useState(0);
  const [phase, setPhase] = useState(ready ? 'walking' : 'blocked'); // blocked | walking | popup | trainer | battle | pathDone
  const [progress, setProgress] = useState(0);
  const [popup, setPopup] = useState(null);       // { icon, title, text }
  const [trainer, setTrainer] = useState(null);   // rolled ONCE on arrival, not re-derived every render
  const [haul, setHaul] = useState({ gold: 0, gearParts: 0, petFood: 0, cards: 0, eggs: [] });
  const [battle, setBattle] = useState(null);
  const [battleCtx, setBattleCtx] = useState(null); // { kind: 'encounter'|'trainer', trainer, stake, prize }
  const [resolving, setResolving] = useState(false);
  const [stakePick, setStakePick] = useState(null);
  const [prizeChoices, setPrizeChoices] = useState(null);
  const rafRef = useRef(null);

  const inventory = save.tcgCardInventory || [];

  const applyHaulToSave = (loot) => {
    setHaul(h => ({
      gold: h.gold + (loot.type === 'gold' ? loot.amount : 0),
      gearParts: h.gearParts + (loot.type === 'gearParts' ? loot.amount : 0),
      petFood: h.petFood + (loot.type === 'petFood' ? loot.amount : 0),
      cards: h.cards + (loot.type === 'card' ? 1 : 0),
      eggs: loot.type === 'egg' ? [...h.eggs, loot.rarity] : h.eggs,
    }));
    setSave(s => {
      const ns = { ...s };
      if (loot.type === 'gold') ns.gold = (ns.gold || 0) + loot.amount;
      // Exploration pays its parts as SLOT parts, which is the whole point of
      // the new currency -- a dig site gives you helmet parts or tread parts,
      // not an anonymous pile. A little generic still comes along so the
      // wildcard pool keeps growing too.
      if (loot.type === 'gearParts') {
        const p = rollPartsDrop(loot.amount / 3);
        ns.gearSlotParts = addParts(ns, p.slot, p.amount);
        ns.gearParts = (ns.gearParts || 0) + Math.ceil(loot.amount / 2);
      }
      if (loot.type === 'petFood') ns.petFood = (ns.petFood || 0) + loot.amount;
      if (loot.type === 'card') ns.tcgCardInventory = [...(ns.tcgCardInventory || []), loot.card];
      if (loot.card2) ns.tcgCardInventory = [...(ns.tcgCardInventory || []), loot.card2];
      if (loot.type === 'egg') {
        ns.petEggs = [...(ns.petEggs || []), {
          id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          rarity: loot.rarity,
          type: PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)].id,
        }];
      }
      return ns;
    });
  };

  // ---- Walking ----
  useEffect(() => {
    if (phase !== 'walking') return undefined;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      setProgress(p => Math.min(1, p + dt / NODE_SECONDS));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, nodeIdx]);

  useEffect(() => {
    if (phase === 'walking' && progress >= 1) arriveAtNode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, phase]);

  const arriveAtNode = () => {
    const node = path[nodeIdx];
    if (node.type === 'loot') {
      const loot = rollLootNode(save.attrs?.luck || 0);
      applyHaulToSave(loot);
      setPopup({ icon: NODE_ICON.loot, title: 'Found something', text: prizeLine(loot) || `${loot.amount} ${loot.type}` });
      Audio.pickup();
      setPhase('popup');
      setTimeout(() => advanceOrFinish(), 1500);
    } else if (node.type === 'encounter') {
      Audio.cardShuffle();
      const foeType = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)].id;
      const foeDeck = rollPracticeFoeDeck(DECK_SIZE, 0);
      setBattleCtx({ kind: 'encounter' });
      setBattle(initBattle({
        deckIds, cardInventory: inventory,
        petType: activePet.type, petLevel: activePet.level, petStageMult: petStageMult(activePet.level),
        foeDeckIds: foeDeck.deckIds, foeCardInventory: foeDeck.cardInventory,
        foeType, foeLevel: activePet.level, foeStageMult: petStageMult(activePet.level),
      }));
      setPhase('battle');
    } else if (node.type === 'trainer') {
      setTrainer(rollTrainer(0));
      setPhase('trainer');
    }
  };

  const advanceOrFinish = () => {
    if (nodeIdx + 1 >= path.length) { setPhase('pathDone'); return; }
    setNodeIdx(i => i + 1);
    setProgress(0);
    setPhase('walking');
  };

  // ---- Encounter / trainer battles ----
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
        if (next.winner === 'you') Audio.rewardFanfare(); else Audio.hit();
        settleBattle(next);
      }
    }, 550);
  };
  const passTurn = () => playCard(null);

  const settleBattle = (final) => {
    if (battleCtx?.kind === 'encounter') {
      if (final.winner === 'you') {
        const card = rollCard(save.attrs?.luck || 0);
        applyHaulToSave({ type: 'card', card });
        pushToast({ tone: 'default', icon: 'swarm', title: 'Encounter won', text: 'Found a card' });
      }
    }
    // Trainer settlement happens in claimTrainerResult (needs the stake/prize)
  };

  const claimTrainerResult = () => {
    const { stake, prize } = battleCtx;
    const won = battle.winner === 'you';
    setSave(s => {
      let ns = { ...s };
      if (won) {
        if (prize.type === 'card') ns.tcgCardInventory = [...(ns.tcgCardInventory || []), prize.card, ...(prize.card2 ? [prize.card2] : [])];
        if (prize.type === 'egg') ns.petEggs = [...(ns.petEggs || []), { id: `e_${Date.now().toString(36)}`, rarity: prize.rarity, type: PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)].id }];
        if (prize.type === 'gold') ns.gold = (ns.gold || 0) + prize.amount;
      } else {
        if (stake.kind === 'gold') ns.gold = Math.max(0, (ns.gold || 0) - stake.amount);
        if (stake.kind === 'gems') ns.gems = Math.max(0, (ns.gems || 0) - stake.amount);
        if (stake.kind === 'egg') ns.petEggs = (ns.petEggs || []).filter(e => e.id !== stake.eggId);
        if (stake.kind === 'pet') ns.pets = (ns.pets || []).filter(p => p.id !== stake.petId);
      }
      return ns;
    });
    pushToast({
      tone: won ? 'legendary' : 'default',
      icon: won ? 'trophy' : 'shield',
      title: won ? `Beat ${battleCtx.trainer.name}` : `Lost to ${battleCtx.trainer.name}`,
      text: won ? prizeLine(prize) : `Lost the stake`,
    });
    setBattle(null); setBattleCtx(null); setStakePick(null); setPrizeChoices(null);
    advanceOrFinish();
  };

  // ---- Trainer wager flow ----
  const opts = phase === 'trainer' ? stakeOptions(save) : [];

  const negotiate = () => setPrizeChoices(rollNegotiatedPrizes(save.attrs?.luck || 0));
  const gamble = () => {
    const prize = rollGamblePrize(save.attrs?.luck || 0);
    startTrainerBattle(stakePick, prize);
  };
  const pickPrize = (prize) => startTrainerBattle(stakePick, prize);

  const startTrainerBattle = (stake, prize) => {
    Audio.cardShuffle();
    const t = trainer;
    const foeDeck = trainerDeck(t.type, t.level);
    const b = initBattle({
      deckIds, cardInventory: inventory,
      petType: activePet.type, petLevel: activePet.level, petStageMult: petStageMult(activePet.level),
      foeDeckIds: foeDeck.deckIds, foeCardInventory: foeDeck.cardInventory,
      foeType: t.type, foeLevel: t.level, foeStageMult: 1,
    });
    b.foeName = t.name;
    setBattleCtx({ kind: 'trainer', trainer: t, stake, prize });
    setBattle(b);
    setPhase('battle');
  };

  const skipTrainer = () => { Audio.click(); advanceOrFinish(); };

  return (
    <div className="modal-overlay" data-testid="exploration-screen" onClick={(e) => { if (e.target.classList.contains('modal-overlay') && phase !== 'battle') onClose(); }}>
      <div className="forge-panel forge-panel-scrollable expl-panel">
        <div className="forge-header">
          <div className="forge-title">🧭 EXPLORATION</div>
          <div style={{ fontFamily: 'VT323', fontSize: 13, color: 'var(--ink-dim)' }}>
            ★{haul.gold} · 🔩{haul.gearParts} · 🃏{haul.cards}
          </div>
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12 }}>✕</button>
        </div>

        {phase === 'blocked' && (
          <div className="tcg-empty">
            {!activePet ? 'Hatch and activate a pet first.' : 'Build that pet a valid deck in Pet TCG first (at least 5 cards).'}
          </div>
        )}

        {phase !== 'blocked' && (
          <>
            <div className="expl-path" data-testid="expl-path">
              {path.map((n, i) => (
                <div key={n.i} className={`expl-node t-${n.type}${i < nodeIdx ? ' done' : ''}${i === nodeIdx ? ' current' : ''}`}>
                  <GameIcon name={NODE_ICON[n.type]} size={20} />
                </div>
              ))}
              <div className="expl-walker" style={{ left: `${((nodeIdx + Math.min(1, progress)) / path.length) * 100}%` }}>
                <GameIcon name="ui_waterdrop" size={18} />{activePet && <i className="expl-walker-pet"><GameIcon name={PET_TYPES.find(t => t.id === activePet.type)?.icon || 'ui_pets'} size={14} /></i>}
              </div>
              <div className="expl-track"><i style={{ width: `${((nodeIdx + Math.min(1, progress)) / path.length) * 100}%` }} /></div>
            </div>

            {phase === 'walking' && <div className="expl-status">Walking…</div>}

            {phase === 'popup' && popup && (
              <div className="expl-popup">
                <span className="expl-popup-icon"><GameIcon name={popup.icon} size={26} /></span>
                <div className="expl-popup-title">{popup.title}</div>
                <div className="expl-popup-text">{popup.text}</div>
              </div>
            )}

            {phase === 'trainer' && trainer && (
              <div className="expl-trainer" style={{ '--tc': trainer.accent }}>
                <div className="expl-trainer-name">{trainer.name} <i>Lv{trainer.level}</i></div>
                <div className="expl-trainer-line">"{trainer.line}"</div>

                {!stakePick ? (
                  <>
                    <div className="expl-sub">What do you put down?</div>
                    <div className="expl-stakes">
                      {opts.length === 0 && <div className="tcg-empty">Nothing worth staking right now.</div>}
                      {opts.map(o => (
                        <button key={o.kind} className={`expl-stake${o.risky ? ' risky' : ''}`} onClick={() => setStakePick(o)}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <button className="prosp-btn ghost" onClick={skipTrainer}>Walk past</button>
                  </>
                ) : !prizeChoices ? (
                  <>
                    <div className="expl-sub">Staking: {stakePick.label}. Negotiate a prize, or gamble on one.</div>
                    <div className="expl-actions">
                      <button className="prosp-btn go" onClick={negotiate}>🤝 NEGOTIATE</button>
                      <button className="prosp-btn dig" onClick={gamble}>🎲 GAMBLE</button>
                      <button className="prosp-btn ghost" onClick={() => setStakePick(null)}>Back</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="expl-sub">Pick what you're fighting for:</div>
                    <div className="expl-prizes">
                      {prizeChoices.map((p, i) => (
                        <button key={i} className="expl-prize" onClick={() => pickPrize(p)}>{prizeLine(p)}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {phase === 'battle' && battle && (
              <TcgBoard
                battle={battle} yourName={activePet?.name} resolving={resolving}
                onPlayCard={playCard} onPass={passTurn}
                resultChildren={
                  battleCtx?.kind === 'trainer' ? (
                    <div className="tcg-result-actions">
                      <button className="prosp-btn go" onClick={claimTrainerResult} data-testid="expl-claim">
                        {battle.winner === 'you' ? '✓ CLAIM PRIZE' : 'CONTINUE'}
                      </button>
                    </div>
                  ) : (
                    <div className="tcg-result-actions">
                      <button className="prosp-btn go" onClick={() => { setBattle(null); setBattleCtx(null); advanceOrFinish(); }}>CONTINUE</button>
                    </div>
                  )
                }
              />
            )}

            {phase === 'pathDone' && (
              <div className="expl-done">
                <div className="expl-done-title">WALK COMPLETE</div>
                <div className="expl-done-haul">
                  ★ {haul.gold} · 🔩 {haul.gearParts} · 🍖 {haul.petFood} · 🃏 {haul.cards}
                  {haul.eggs.length > 0 && ` · 🥚 ${haul.eggs.length}`}
                </div>
                <button className="prosp-btn go" onClick={onClose} data-testid="expl-return">↩ RETURN TO CAMP</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

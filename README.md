# Waterdrop Survivor — Standalone Build

## Innehåll i denna ZIP
- `backend/` — FastAPI + MongoDB (save/load + leaderboard API)
- `frontend/` — React + HTML5 Canvas 2D game engine
- `memory/PRD.md` — Full feature-PRD med alla iterations

## Snabbstart (lokalt)

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # justera MONGO_URL om du vill
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
yarn start   # öppnar localhost:3000
```
(Sätt `REACT_APP_BACKEND_URL=http://localhost:8001` i `frontend/.env` lokalt.)

## Tech stack
- **Frontend**: React 18, HTML5 Canvas 2D engine (~1800 rader), procedurell WebAudio + MP3 BGM
- **Backend**: FastAPI 0.110, Motor (async Mongo), Pydantic v2
- **DB**: MongoDB (auto-skapar `saves` + `runs` collections)

## Steam / iOS publishing
- **PC/Steam**: wrappa med Electron (`yarn add electron electron-builder` → `electron-builder --win --mac`). Steam Direct fee: $100.
- **iOS/iPhone**: wrappa med Capacitor (`npm i @capacitor/core @capacitor/ios && npx cap add ios`). Apple Developer: $99/år. Endast Mac med Xcode kan bygga `.ipa`.

## Filöversikt
```
frontend/src/
├── game/
│   ├── engine.js          # canvas 2D engine (objektpool, render, AI, vapen, particles)
│   ├── data.js            # 6 vapen, 7 fiender, 2 bosses, lvl-up cards, meta upgrades
│   ├── data_ext.js        # skill tree (5 grenar), equipment, chests, daily quests
│   ├── data_ext2.js       # 5 starter weapons, parts, missions, achievements, challenges, active skills, 21 advanced cards
│   └── audio.js           # procedurell WebAudio SFX + MP3 BGM
├── components/
│   ├── App.js, MainMenu, Welcome, IntroDialogue
│   ├── Camp, CampPanels    # 12 tabs/modaler
│   ├── GameScreen, HUD, LevelUpModal, GameOverScreen
│   ├── MobileControls, MissionReveal, Shop, SkillTree, Weaponsmith
│   └── ...
├── store.js                # localStorage save + backend sync
└── index.css               # gritty Dead Cells-themed CSS
backend/
└── server.py               # /api/health, /api/save, /api/run-result, /api/leaderboard
```

## Licens
Eget projekt — fri att modifiera och publicera. MP3-låten är din egen asset.

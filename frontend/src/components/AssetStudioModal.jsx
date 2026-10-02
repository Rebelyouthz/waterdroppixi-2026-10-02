import React, { useState, useEffect } from 'react';
import { DESIGN_CATEGORIES, loadDesignChoices, saveDesignChoices } from '../game/assetStudioData';
import { Audio } from '../game/audio';
import GameIcon from './GameIcon';

export default function AssetStudioModal({ onClose }) {
  const [choices, setChoices] = useState(loadDesignChoices());
  const [selectedCatId, setSelectedCatId] = useState(DESIGN_CATEGORIES[0].id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    saveDesignChoices(choices);
  }, [choices]);

  const activeCategory = DESIGN_CATEGORIES.find(c => c.id === selectedCatId) || DESIGN_CATEGORIES[0];
  const chosenOptId = choices[activeCategory.id] || 1;

  const handleSelectOption = (catId, optId) => {
    setChoices(prev => ({
      ...prev,
      [catId]: optId,
    }));
    if (Audio.click) Audio.click();
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(choices, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "waterdrop_chosen_design_manifest.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalCategories = DESIGN_CATEGORIES.length;
  const pickedCategories = Object.keys(choices).filter(k => choices[k] != null).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(4, 2, 10, 0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 1100, maxHeight: '92vh',
        background: '#090514', border: '2px solid #3d2466', borderRadius: 12,
        boxShadow: '0 0 40px rgba(110, 50, 200, 0.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid #2a1845',
          background: 'linear-gradient(90deg, #130a2a, #090514)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🎨</span>
            <div>
              <div style={{ fontFamily: 'VT323', fontSize: 20, color: '#ffd166', letterSpacing: '0.1em' }}>
                ASSET DESIGN STUDIO & MASTER CATALOG
              </div>
              <div style={{ fontFamily: 'VT323', fontSize: 13, color: '#a094b8' }}>
                Preview 5 distinct visual styles for each game element & pick your favorites before hardcoding
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontFamily: 'VT323', fontSize: 14, padding: '4px 10px', borderRadius: 4,
              background: '#1b0e38', border: '1px solid #4dffd4', color: '#4dffd4'
            }}>
              CHOICES: {pickedCategories} / {totalCategories} SELECTED
            </div>
            <button
              onClick={handleExportJson}
              style={{
                fontFamily: 'VT323', fontSize: 14, padding: '6px 14px', borderRadius: 4,
                background: '#ffd166', color: '#090514', border: 'none', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              {copied ? '✓ EXPORTED JSON!' : '📥 EXPORT CHOICES JSON'}
            </button>
            <button
              onClick={onClose}
              style={{
                fontFamily: 'VT323', fontSize: 18, width: 32, height: 32,
                borderRadius: '50%', background: '#26123e', border: '1px solid #ff3146',
                color: '#ff3146', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body (Sidebar + Content) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Category Tabs Sidebar */}
          <div style={{
            width: 250, borderRight: '1px solid #2a1845', background: '#070310',
            padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <div style={{ fontFamily: 'VT323', fontSize: 13, color: '#7a6c94', letterSpacing: '0.15em', padding: '4px 6px' }}>
              CATEGORIES (5 CHOICES EACH)
            </div>
            {DESIGN_CATEGORIES.map(cat => {
              const active = cat.id === selectedCatId;
              const chosen = choices[cat.id] || 1;
              const chosenOpt = cat.options.find(o => o.id === chosen);
              return (
                <div
                  key={cat.id}
                  onClick={() => { setSelectedCatId(cat.id); Audio.click(); }}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                    background: active ? '#1a0d33' : 'transparent',
                    border: active ? '1px solid #ffd166' : '1px solid transparent',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontFamily: 'VT323', fontSize: 14, color: active ? '#ffd166' : '#e0d8c0' }}>
                    {cat.title}
                  </div>
                  <div style={{ fontFamily: 'VT323', fontSize: 12, color: chosenOpt ? chosenOpt.color : '#888' }}>
                    Selected: #{chosen} {chosenOpt?.name.split(' ')[0]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Category Display */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Category Banner & Desc */}
            <div>
              <div style={{ fontFamily: 'VT323', fontSize: 22, color: '#4dffd4', letterSpacing: '0.1em' }}>
                {activeCategory.title}
              </div>
              <div style={{ fontFamily: 'VT323', fontSize: 14, color: '#b0a4cc' }}>
                {activeCategory.description}
              </div>
            </div>

            {/* Master Concept Sheet Preview */}
            <div style={{
              borderRadius: 8, overflow: 'hidden', border: '1px solid #3d2466',
              background: '#040208', boxShadow: '0 0 20px rgba(0,0,0,0.8)'
            }}>
              <img
                src={activeCategory.sheetImage}
                alt={activeCategory.title}
                style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }}
              />
            </div>

            {/* 5 Choosable Cards */}
            <div>
              <div style={{ fontFamily: 'VT323', fontSize: 14, color: '#ffd166', letterSpacing: '0.15em', marginBottom: 8 }}>
                CHOOSE YOUR PREFERRED STYLE (CLICK TO SELECT):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {activeCategory.options.map(opt => {
                  const isSelected = chosenOptId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(activeCategory.id, opt.id)}
                      style={{
                        padding: 10, borderRadius: 8, cursor: 'pointer',
                        background: isSelected ? '#1b0e36' : '#0c071a',
                        border: isSelected ? `2px solid ${opt.color}` : '1px solid #23143d',
                        boxShadow: isSelected ? `0 0 14px ${opt.color}88` : 'none',
                        transition: 'all 0.15s ease',
                        display: 'flex', flexDirection: 'column', gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontFamily: 'VT323', fontSize: 14, fontWeight: 'bold',
                          color: isSelected ? opt.color : '#888'
                        }}>
                          STYLE #{opt.id}
                        </span>
                        {isSelected && (
                          <span style={{
                            fontFamily: 'VT323', fontSize: 12, padding: '2px 6px', borderRadius: 4,
                            background: opt.color, color: '#090514', fontWeight: 'bold'
                          }}>
                            ACTIVE ✓
                          </span>
                        )}
                      </div>

                      <div style={{ fontFamily: 'VT323', fontSize: 15, color: isSelected ? '#ffffff' : '#d8d0e8' }}>
                        {opt.name}
                      </div>

                      <div style={{ fontFamily: 'VT323', fontSize: 12, color: '#9084a8', lineHeight: 1.2 }}>
                        {opt.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createDataClient } from './dataClient.js';
import { createWorld } from './world.js';
import { createHUD } from './ui.js';
import { deriveCondition } from './condition.js';

const hud = createHUD();
const world = createWorld(document.getElementById('world'), {
  onScene: (scene) => hud.onScene(scene),
  onError: (e) => console.warn('world error', e),
});

let lastKey = null;

createDataClient((snap) => {
  if (!snap || !snap.reading) {
    hud.setStatus(false, snap?.error ? 'Source error' : 'Waiting for station…');
    return;
  }
  const cond = deriveCondition(snap.reading);
  if (cond.key !== lastKey) {
    document.body.dataset.cond = cond.key;
    document.body.classList.toggle('is-night', !cond.isDay);
    lastKey = cond.key;
  }
  world.applyCondition(cond);
  hud.update(cond, snap);

  const age = Math.round((snap.serverTime - snap.lastUpdated) / 1000);
  hud.setStatus(true, snap.lastUpdated && age < 120 ? 'Live' : `Updated ${age}s ago`);
});

requestAnimationFrame(() => setTimeout(() => document.getElementById('splash')?.classList.add('hide'), 900));

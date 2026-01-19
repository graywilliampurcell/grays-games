// Utility: seed encoding/decoding and seed UI attachment for Escape test pages
(function(){
  function _encodeBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function _decodeBase64(b64) { try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return null; } }

  function mazeToSeed(maze) {
    try { return 'v1:' + _encodeBase64(JSON.stringify(maze)); } catch (e) { return null; }
  }

  function seedToMaze(seed) {
    if (!seed || typeof seed !== 'string') return null;
    if (seed.indexOf('v1:') !== 0) return null;
    try { const json = _decodeBase64(seed.slice(3)); return JSON.parse(json); } catch (e) { return null; }
  }

  // Attach a small seed UI near a reference node.
  // options: { attachTo: HTMLElement (defaults to document.body), onLoad: fn(maze), initialSeed: string }
  function attachSeedUI(options) {
    options = options || {};
    const attachTo = options.attachTo || document.body;
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.maxWidth = '600px';
    container.style.margin = '8px auto';
    container.style.textAlign = 'left';

    const label = document.createElement('div');
    label.textContent = options.label || 'Seed (copy to reproduce exact map):';
    label.style.fontSize = '12px';
    label.style.color = options.labelColor || '#ddd';
    container.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.rows = 2;
    textarea.style.width = '100%';
    textarea.style.boxSizing = 'border-box';
    textarea.style.padding = '6px';
    textarea.style.borderRadius = '4px';
    textarea.style.border = '1px solid #444';
    textarea.style.background = options.textareaBg || '#111';
    textarea.style.color = options.textColor || '#fff';
    container.appendChild(textarea);

    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '6px';
    btnWrap.style.textAlign = 'right';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = options.loadText || 'Load seed';
    btnWrap.appendChild(loadBtn);
    container.appendChild(btnWrap);

    // Insert
    if (options.insertBefore && options.insertBefore.parentNode) {
      options.insertBefore.parentNode.insertBefore(container, options.insertBefore);
    } else if (attachTo.appendChild) {
      attachTo.appendChild(container);
    }

    loadBtn.addEventListener('click', () => {
      const s = textarea.value.trim();
      const m = seedToMaze(s);
      if (!m) {
        if (options.onError) options.onError('Invalid seed');
        return;
      }
      if (options.onLoad) options.onLoad(m);
    });

    return {
      setSeed(seed) { textarea.value = seed || ''; },
      getSeed() { return textarea.value.trim(); },
      element: container,
    };
  }

  window.mazeToSeed = mazeToSeed;
  window.seedToMaze = seedToMaze;
  window.attachSeedUI = attachSeedUI;
})();

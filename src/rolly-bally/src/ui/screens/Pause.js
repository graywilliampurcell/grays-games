// In-game pause overlay. Holding the Home button for 1 s pauses the game
// (Game.pause) and shows this over the mode's HUD: a big green "keep
// playing" button and a Home button. Nothing is lost by pausing.

import * as icons from '../icons/index.js';
import { h, iconButton } from '../components.js';
import { drawSkinIcon } from '../../ball/skins.js';

/**
 * @param {{root: HTMLElement, resume: () => void, exit: () => void, app: object, seed?: string}} opts
 * @returns {() => void} close without resuming or exiting
 */
export function showPause({ root, resume, exit, app, seed = null }) {
  const ball = drawSkinIcon(app.save.get().skins.selected, 96);
  ball.className = 'pause-ball';
  // World / race code as small 4-emoji decoration (so a grown-up can note it).
  const code = seed ? h('div', { class: 'pause-seed', 'aria-label': 'World code' }, seed) : null;
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'pause-overlay ui-block', 'data-ui': '' },
    h('div', { class: 'pause-card rb-pop' },
      ball,
      code,
      h('div', { class: 'rb-row' },
        iconButton({
          icon: icons.home, caption: 'Home', label: 'Home', kind: 'big', color: 'blue', className: 'pause-home', app,
          onTap: () => {
            close();
            exit();
          },
        }),
        iconButton({
          icon: icons.go, caption: 'Play', label: 'Keep playing', kind: 'big', color: 'green', className: 'pause-resume', app,
          onTap: () => {
            close();
            resume();
          },
        }),
      ),
    ),
  );
  root.append(overlay);
  return close;
}

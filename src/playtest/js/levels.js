// Fixed level layouts. One string per row, one character per block:
//   '#' wall, ' ' floor, 'S' start, 'X' spike, 'Y' row of spikes right across
//   a corridor, 'D' exit door (in the outer wall), 'G' a space door that slides
//   open and shut by itself (three blocks across a gap; see Maze.js), 'I' a
//   slippery spot on the floor (a strip right across a corridor)
// Found with tools/find-level.mjs. theme: colors and the fluffy look, see Maze.js.
// music: the level's tune (see sound.js), a little sneakier each level.
// spikeRadius: size of the spike's plate (default 0.75; see Maze.js).
// finale: the last level of a world: golden door, confetti, its own end title.

// Levels 1-10 share the cotton candy look: fluffy pink walls on blue ground.
const COTTON_CANDY = { wall: 0xff9fcf, floor: 0x6fb8ff, sky: 0xe6d6ff, fluffy: true };
// Levels 11-20, Space World: star walls, metal floor, a dark sky with Earth,
// the Moon and things flying by (see Maze.js)
const SPACE = { wall: 0x1c2153, floor: 0x8c939c, sky: 0x04060f, space: true };

export const LEVELS = [
    {
        name: 'Level 1',
        theme: COTTON_CANDY,
        music: 'happy',
        // 5 x 5 corridors. Correct path 17 cells; 5 dead ends exactly 1 cell
        // deep, so each end wall shows from the junction; the spike dead end is
        // 3 cells deep with one turn, branching off the start cell (spike 3
        // cells from the start).
        layout: [
            '#####################',
            '#                   #',
            '#                   #',
            '#                   #',
            '#####   #########   #',
            '#               #   #',
            '#               #   #',
            '#               #   #',
            '#############   #   #',
            '#           #   #   #',
            '#         X #   #   #',
            '#           #   #   #',
            '#   #########   #   #',
            '#       #       #   #',
            '# S     #       #   D',
            '#       #       #   #',
            '#####   #####   #   #',
            '#               #   #',
            '#               #   #',
            '#               #   #',
            '#####################',
        ],
    },
    {
        name: 'Level 2',
        // `node tools/find-level.mjs level2`, seed 6. 5 x 5 corridors. Correct
        // path 14 cells; 4 dead ends each 2 cells deep; the spike dead end is
        // 3 cells deep with one turn (spike 4 cells from the start).
        theme: COTTON_CANDY,
        music: 'happySneaky',
        layout: [
            '#####################',
            '#   #   #   #       #',
            '#   #   # X #       #',
            '#   #   #   #       #',
            '#   #   #   #####   #',
            '#   #   #   #       #',
            '#   #   #   #       D',
            '#   #   #   #       #',
            '#   #   #   #   #   #',
            '#           #   #   #',
            '# S         #   #   #',
            '#           #   #   #',
            '#####   #########   #',
            '#       #       #   #',
            '#       #       #   #',
            '#       #       #   #',
            '#   #####   #   #   #',
            '#           #       #',
            '#           #       #',
            '#           #       #',
            '#####################',
        ],
    },
    {
        name: 'Level 3',
        // The spike on the path. `node tools/find-level.mjs level3`, seed 4.
        // 5 x 5 corridors. Correct path 17 cells; 4 dead ends each 2 cells
        // deep, no spike dead end. The spike sits in the middle of a straight
        // 5-cell hallway (path cell 6 of 17): it covers the middle third of the
        // corridor, leaving a one-block gap on each side to walk round it.
        theme: COTTON_CANDY,
        music: 'happySneakier',
        spikeRadius: 0.5,
        layout: [
            '#####################',
            '#   #               #',
            '#   #               D',
            '#   #               #',
            '#   #   #############',
            '#   #               #',
            '#   #               #',
            '#   #               #',
            '#   #############   #',
            '#                   #',
            '#         X         #',
            '#                   #',
            '#   #############   #',
            '#               #   #',
            '#               #   #',
            '#               #   #',
            '#####   #########   #',
            '#               #   #',
            '# S             #   #',
            '#               #   #',
            '#####################',
        ],
    },
    {
        name: 'Level 4',
        // A narrower squeeze. `node tools/find-level.mjs level4`, seed 19.
        // 5 x 5 corridors. Correct path 17 cells; 4 dead ends each 2 cells
        // deep. The spike is on the path, in a straight stretch down the
        // middle (path cell 11 of 17). Its plate is a little bigger than
        // Level 3's (0.55 vs 0.5), so the room to walk past it without
        // touching is about 15% narrower.
        theme: COTTON_CANDY,
        music: 'tiptoe',
        spikeRadius: 0.55,
        layout: [
            '#####################',
            '#               #   #',
            '# S             #   #',
            '#               #   #',
            '#####   #########   #',
            '#       #           #',
            '#       #           #',
            '#       #           #',
            '#   #####   #   #####',
            '#       #   #   #   #',
            '#       # X #   #   D',
            '#       #   #   #   #',
            '#####   #   #   #   #',
            '#   #   #   #       #',
            '#   #   #   #       #',
            '#   #   #   #       #',
            '#   #   #   #####   #',
            '#           #       #',
            '#           #       #',
            '#           #       #',
            '#####################',
        ],
    },
    {
        name: 'Level 5',
        // Two spikes. `node tools/find-level.mjs level5`, seed 30. 5 x 5
        // corridors. Correct path 17 cells; 4 dead ends each 2 cells deep.
        // X: the spike on the path, in the long straight top corridor (path
        // cell 10 of 17); plate 0.6 (Level 4: 0.55), so the room to walk past
        // is about 15% narrower again. Y: a row of spikes right across the
        // opening of a straight dead end below the path: no way past.
        theme: COTTON_CANDY,
        music: 'march',
        spikeRadius: 0.6,
        layout: [
            '#####################',
            '#                   #',
            '#                   D',
            '#                   #',
            '#   #################',
            '#                   #',
            '#         X         #',
            '#                   #',
            '#################   #',
            '#   #               #',
            '#   #               #',
            '#   #               #',
            '#   #   #   #   #   #',
            '#   #   #   # Y #   #',
            '#   #   #   #   #   #',
            '#   #   #   #   #   #',
            '#   #####   #   #   #',
            '#           #   #   #',
            '# S         #   #   #',
            '#           #   #   #',
            '#####################',
        ],
    },
    {
        name: 'Level 6',
        // Two spikes, a tighter squeeze. `node tools/find-level.mjs level6`,
        // seed 45. 5 x 5 corridors. Correct path 17 cells; 4 dead ends each 2
        // cells deep. X: the spike on the path, in the long straight bottom
        // corridor (path cell 12 of 17); plate 0.64 (Level 5: 0.6), so the
        // room to walk past is about 15% narrower again. Y: a row of spikes
        // across the dead end that drops straight down from the start.
        theme: COTTON_CANDY,
        music: 'creep',
        spikeRadius: 0.64,
        layout: [
            '#####################',
            '#           #   #   #',
            '# S         #   #   D',
            '#           #   #   #',
            '#   #####   #   #   #',
            '# Y #           #   #',
            '#   #           #   #',
            '#   #           #   #',
            '#   #   #   #####   #',
            '#   #   #       #   #',
            '#   #   #       #   #',
            '#   #   #       #   #',
            '#############   #   #',
            '#   #           #   #',
            '#   #           #   #',
            '#   #           #   #',
            '#   #   #########   #',
            '#                   #',
            '#             X     #',
            '#                   #',
            '#####################',
        ],
    },
    {
        name: 'Level 7',
        // Longer wrong ways. `node tools/find-level.mjs level7`, seed 64.
        // 5 x 5 corridors. Correct path 16 cells; 3 dead ends each 3 cells
        // deep. X: the spike on the path, in a straight corridor (path cell
        // 10 of 16); plate 0.67 (Level 6: 0.64), so the room to walk past is
        // about 15% narrower again. Y: a row of spikes across the opening of
        // the straight 3-cell dead end along the top.
        theme: COTTON_CANDY,
        music: 'shuffle',
        spikeRadius: 0.67,
        layout: [
            '#####################',
            '#                   #',
            '#          Y        #',
            '#                   #',
            '#############   #   #',
            '#               #   #',
            '#         X     #   #',
            '#               #   #',
            '#   #########   #   #',
            '#   #           #   #',
            '#   #           #   #',
            '#   #           #   #',
            '#   #############   #',
            '#               #   #',
            '#               #   D',
            '#               #   #',
            '#########   #   #####',
            '#           #       #',
            '# S         #       #',
            '#           #       #',
            '#####################',
        ],
    },
    {
        name: 'Level 8',
        // A tighter squeeze, long wrong ways. `node tools/find-level.mjs
        // level8`, seed 117. 5 x 5 corridors. Correct path 16 cells; 3 dead
        // ends each 3 cells deep. X: the spike on the path, in the long
        // straight corridor near the bottom (path cell 9 of 16); plate 0.7
        // (Level 7: 0.67), so the room to walk past is about 15% narrower
        // again. Y: a row of spikes across the straight 3-cell dead end in
        // the middle of the maze.
        theme: COTTON_CANDY,
        music: 'ding',
        spikeRadius: 0.7,
        layout: [
            '#####################',
            '#           #       #',
            '#           #       #',
            '#           #       #',
            '#########   #   #   #',
            '#               #   #',
            '# S             #   #',
            '#               #   #',
            '#############   #####',
            '#                   #',
            '#          Y        #',
            '#                   #',
            '#################   #',
            '#                   #',
            '#         X         #',
            '#                   #',
            '#   #################',
            '#                   #',
            '#                   D',
            '#                   #',
            '#####################',
        ],
    },
    {
        name: 'Level 9',
        // The sneaky big spike. `node tools/find-level.mjs level9`, seed 464.
        // 5 x 5 corridors. Correct path 16 cells; 3 dead ends each 3 cells
        // deep. X: the spike on the path, in the long straight corridor near
        // the top; plate 0.7, the same room to walk past as Level 8. Y: the
        // row of spikes hidden round a corner: the dead end that leaves the
        // path one cell from the start runs east two cells, then turns north,
        // and the row is in the middle of the cell just round that corner. A
        // program checked it can't be seen from the path or the opening.
        theme: COTTON_CANDY,
        music: 'echo',
        spikeRadius: 0.7,
        layout: [
            '#####################',
            '#                   #',
            '#                   #',
            '#                   #',
            '#   #############   #',
            '#               #   #',
            '#     X         #   D',
            '#               #   #',
            '#############   #####',
            '#       #           #',
            '#       #           #',
            '#       #           #',
            '#   #   #   #####   #',
            '#   #       #   #   #',
            '#   #       # Y #   #',
            '#   #       #   #   #',
            '#####   #####   #   #',
            '#               #   #',
            '# S             #   #',
            '#               #   #',
            '#####################',
        ],
    },
    {
        name: 'Level 10',
        // The cotton candy finale. `node tools/find-level.mjs level10`, seed
        // 132. 5 x 5 corridors. Correct path 16 cells; 3 dead ends each 3
        // cells deep. X: the spike on the path, in the straight corridor down
        // the east side; plate 0.72 (Level 9: 0.7), the tightest squeeze yet.
        // Y: a row of spikes across the long straight dead end that drops
        // down from the start. The door is golden, and finishing it sets off
        // confetti, an extra-long cheer and this end screen.
        theme: COTTON_CANDY,
        music: 'finale',
        spikeRadius: 0.72,
        finale: 'You beat Cotton Candy World!',
        nextLabel: 'Start Space World',
        layout: [
            '#####################',
            '#           #       #',
            '#           #       #',
            '#           #       #',
            '#   #########   #   #',
            '#               #   #',
            '# S             #   #',
            '#               #   #',
            '#   #############   #',
            '# Y #   #       #   #',
            '#   #   #       # X #',
            '#   #   #       #   #',
            '#   #   #   #   #   #',
            '#   #   #   #       #',
            '#   #   #   #       #',
            '#   #   #   #       #',
            '#   #   #   #########',
            '#   #               #',
            '#   #               D',
            '#   #               #',
            '#####################',
        ],
    },
    {
        name: 'Level 11',
        // Welcome to Space World. `node tools/find-level.mjs level11`, seed 26.
        // 6 x 6 corridors. Correct path 21 cells; 6 dead ends each 2 cells
        // deep; the spike trail is 3 cells deep with one turn, leaving the
        // path in its first 3 cells (spike 5 cells from the start), and a
        // program checked the spike can't be seen from the path. No spike on
        // the path, no doors, no slippery spots.
        theme: SPACE,
        music: 'twinkle',
        layout: [
            '#########################',
            '#       #   #           #',
            '# X     #   #           D',
            '#       #   #           #',
            '#####   #   #########   #',
            '#   #   #   #       #   #',
            '#   #   #   #       #   #',
            '#   #   #   #       #   #',
            '#   #   #   #   #####   #',
            '#               #       #',
            '#               #       #',
            '#               #       #',
            '#####   #####   #   #####',
            '#       #       #       #',
            '# S     #       #       #',
            '#       #       #       #',
            '#   #####   #########   #',
            '#   #       #       #   #',
            '#   #       #       #   #',
            '#   #       #       #   #',
            '#   #   #   #   #   #   #',
            '#   #   #       #       #',
            '#   #   #       #       #',
            '#   #   #       #       #',
            '#########################',
        ],
    },
    {
        name: 'Level 12',
        // Learning space doors. `node tools/find-level.mjs level12`, seed 9.
        // 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2 cells
        // deep. G: the space door, across the straight middle stretch of the
        // path (between path cells 14 and 15), so you see it coming and have
        // to go through it. No spikes, no slippery spots.
        theme: SPACE,
        music: 'orbit',
        layout: [
            '#########################',
            '#       #       #       #',
            '#       #       #       #',
            '#       #       #       #',
            '#   #####   #   #   #   #',
            '#       #   #       #   #',
            '# S     #   #       #   D',
            '#       #   #       #   #',
            '#####   #   #############',
            '#       #       G       #',
            '#       #       G       #',
            '#       #       G       #',
            '#   #################   #',
            '#                   #   #',
            '#                   #   #',
            '#                   #   #',
            '#   #   #   #   #   #   #',
            '#   #   #   #   #       #',
            '#   #   #   #   #       #',
            '#   #   #   #   #       #',
            '#   #   #   #   #####   #',
            '#   #   #   #   #       #',
            '#   #   #   #   #       #',
            '#   #   #   #   #       #',
            '#########################',
        ],
    },
    {
        name: 'Level 13',
        // Learning slippery spots. `node tools/find-level.mjs level13`, seed
        // 30. 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2 cells
        // deep. I: the slippery spot, right across a straight corridor (path
        // cell 7), well away from G, the space door (between path cells 12 and
        // 13). No spikes.
        theme: SPACE,
        music: 'skate',
        layout: [
            '#########################',
            '#                       #',
            '#                       #',
            '#                       #',
            '#   #################   #',
            '#   #       G       #   #',
            '#   #       G       #   D',
            '#   #       G       #   #',
            '#   #   #####   #   #####',
            '#       #       #       #',
            '#       #       #       #',
            '#       #       #       #',
            '#   #################   #',
            '#   #   #         I     #',
            '#   #   #         I     #',
            '#   #   #         I     #',
            '#   #   #   #########   #',
            '#   #   #           #   #',
            '#   #   #           #   #',
            '#   #   #           #   #',
            '#####   #   #########   #',
            '#                   #   #',
            '# S                 #   #',
            '#                   #   #',
            '#########################',
        ],
    },
    {
        name: 'Level 14',
        // Spikes are back. `node tools/find-level.mjs level14`, seed 73. 6 x 6
        // corridors. Correct path 24 cells; 6 dead ends each 2 cells deep. X:
        // a space spike on the path (path cell 7, straight corridor in and
        // out), plate 0.64 like Level 6. G: the space door (between path cells
        // 12 and 13), 5 cells on from the spike. No slippery spots.
        theme: SPACE,
        music: 'robot',
        spikeRadius: 0.64,
        layout: [
            '#########################',
            '#                       #',
            '#                       D',
            '#                       #',
            '#   #   #################',
            '#   #   #       G       #',
            '#   #   #       G       #',
            '#   #   #       G       #',
            '#####   #   #########   #',
            '#   #   #   #           #',
            '#   #   #   #           #',
            '#   #   #   #           #',
            '#   #   #   #   #####   #',
            '#           #   #       #',
            '#           # X #       #',
            '#           #   #       #',
            '#############   #########',
            '#           #           #',
            '# S         #           #',
            '#           #           #',
            '#   #####   #   #########',
            '#       #               #',
            '#       #               #',
            '#       #               #',
            '#########################',
        ],
    },
];

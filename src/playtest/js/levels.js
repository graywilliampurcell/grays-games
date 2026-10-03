// Fixed level layouts. One string per row, one character per block:
//   '#' wall, ' ' floor, 'S' start, 'X' spike, 'Y' row of spikes right across
//   a corridor, 'D' exit door (in the outer wall)
// Found with tools/find-level.mjs. theme: colors and the fluffy look, see Maze.js.
// music: the level's tune (see sound.js), a little sneakier each level.
// spikeRadius: size of the spike's plate (default 0.75; see Maze.js).

// Levels 1-10 share the cotton candy look: fluffy pink walls on blue ground.
const COTTON_CANDY = { wall: 0xff9fcf, floor: 0x6fb8ff, sky: 0xe6d6ff, fluffy: true };

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
];

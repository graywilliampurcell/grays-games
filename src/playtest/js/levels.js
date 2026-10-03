// Fixed level layouts. One string per row, one character per block:
//   '#' wall, ' ' floor, 'S' start, 'X' spike, 'D' exit door (in the outer wall)
// Found with tools/find-level.mjs. theme: colors (and Level 2's fluffy look), see Maze.js.
// music: the level's tune (see sound.js), a little sneakier each level.

export const LEVELS = [
    {
        name: 'Level 1',
        theme: { wall: 0x8a8f96, floor: 0x90ee90, sky: 0x87ceeb },
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
        // The cotton candy maze: fluffy pink walls on blue ground.
        // `node tools/find-level.mjs level2`, seed 6. 5 x 5 corridors. Correct
        // path 14 cells; 4 dead ends each 2 cells deep; the spike dead end is
        // 3 cells deep with one turn (spike 4 cells from the start).
        theme: { wall: 0xff9fcf, floor: 0x6fb8ff, sky: 0xe6d6ff, fluffy: true },
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
];

// Fixed level layouts. One string per row, one character per block:
//   '#' wall, ' ' floor, 'S' start, 'X' spike, 'Y' row of spikes right across
//   a corridor, 'D' exit door (in the outer wall), 'G' a space door that slides
//   open and shut by itself (three blocks across a gap; see Maze.js), 'I' a
//   slippery spot on the floor (a strip right across a corridor), 'O' a gap
//   with no floor, crossed on a moving platform (Level 17 on), 'Z' a second
//   spike on the path with its own size (spike2Radius), 'F' a gap like 'O'
//   whose leaf goes about 30% faster (Level 27)
// Found with tools/find-level.mjs. theme: colors and the fluffy look, see Maze.js.
// music: the level's tune (see sound.js), a little sneakier each level.
// spikeRadius: size of the spike's plate (default 0.75; see Maze.js).
// spike2Radius: the second path spike's ('Z') plate, Level 20's tighter squeeze.
// finale: the last level of a world: golden door, confetti, its own end title.

// Levels 1-10 share the cotton candy look: fluffy pink walls on blue ground.
const COTTON_CANDY = { wall: 0xff9fcf, floor: 0x6fb8ff, sky: 0xe6d6ff, fluffy: true };
// Levels 11-20, Space World: star walls, metal floor, a dark sky with Earth,
// the Moon and things flying by (see Maze.js)
const SPACE = { wall: 0x1c2153, floor: 0x8c939c, sky: 0x04060f, space: true };
// Levels 21-30, Jungle World: thick green leaf-and-vine walls, a brown dirt
// path, a bright sky with parrots, toucans and butterflies (see Maze.js)
const JUNGLE = { wall: 0x2e7d32, floor: 0x8b5a2b, sky: 0x9fdcff, jungle: true };
// Levels 31-40, Moon World: a secret high-tech base on the Moon. Shiny metal
// walls with security cameras, gray moon dust with footprints, a black starry
// sky with the Earth; the spikes are craters (see Maze.js)
const MOON = { wall: 0xb6bfca, floor: 0x9a9a9c, sky: 0x000000, moon: true };

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
    {
        name: 'Level 15',
        // Slippery spots are back. `node tools/find-level.mjs level15`, seed
        // 10. 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2 cells
        // deep. Y: a row of spikes just inside the straight dead end that goes
        // up from the start cell, in plain view. I: the slippery spot (path
        // cell 4). X: a spike on the path (path cell 15), plate 0.64 like
        // Levels 6 and 14. At least 2 path cells between any two of them. No
        // space door.
        theme: SPACE,
        music: 'bounce',
        spikeRadius: 0.64,
        layout: [
            '#########################',
            '#               #       #',
            '#               #       #',
            '#               #       #',
            '#########   #   #   #   #',
            '#   #   #   #       #   #',
            '#   #   #   #       #   D',
            '#   #   #   #       #   #',
            '#   #   #   #############',
            '#   #                   #',
            '#   #         X         #',
            '# Y #                   #',
            '#   #################   #',
            '#           #           #',
            '# S         #           #',
            '#           #           #',
            '#   #   #   #   #########',
            '#   #   #   #       #   #',
            '#   #   #III#       #   #',
            '#   #   #   #       #   #',
            '#   #   #   #####   #   #',
            '#   #   #               #',
            '#   #   #               #',
            '#   #   #               #',
            '#########################',
        ],
    },
    {
        name: 'Level 16',
        // Four things to watch out for. `node tools/find-level.mjs level16`,
        // seed 74. 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2
        // cells deep. I: two slippery spots (path cells 3 and 6). G: the space
        // door (between path cells 10 and 11), with 2+ dead ends opening off
        // the path after it. X: a spike on the path (path cell 14), plate 0.64
        // like Levels 14-15. Y: a spike row just inside the straight dead end
        // off path cell 19. At least 2 path cells between any two of them.
        theme: SPACE,
        music: 'rocket',
        spikeRadius: 0.64,
        layout: [
            '#########################',
            '#         I     #   #   #',
            '# S       I     #   #   D',
            '#         I     #   #   #',
            '#############   #   #   #',
            '#         I     #       #',
            '#         I     #       #',
            '#         I     #       #',
            '#   #   #############   #',
            '#   #       #           #',
            '#   #       #           #',
            '#   #       #           #',
            '#####   #   #   #########',
            '#       #   #           #',
            '#       #   #    Y      #',
            '#       #   #           #',
            '#########GGG#   #########',
            '#           #           #',
            '#           #           #',
            '#           #           #',
            '#########   #########   #',
            '#                       #',
            '#                 X     #',
            '#                       #',
            '#########################',
        ],
    },    {
        name: 'Level 17',
        // The first moving platform. `node tools/find-level.mjs level17`, seed
        // 11. 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2 cells
        // deep. I: the slippery spot (path cell 8). O: a gap with no floor
        // right across path cells 11-12 (straight from 10 to 13), crossed on
        // the moving platform, which waits at the start's side (see Maze.js).
        // X: a spike on the path (path cell 15), plate 0.67 like Level 7. G:
        // the space door (between path cells 21 and 22). At least 2 path cells
        // between any two of them.
        theme: SPACE,
        music: 'float',
        spikeRadius: 0.67,
        layout: [
            '#########################',
            '#       #       #       #',
            '#       #       #       #',
            '#       #       #       #',
            '#   #########   #   #####',
            '#           G           #',
            '#           G           D',
            '#           G           #',
            '#   #####################',
            '#                       #',
            '#             X         #',
            '#                       #',
            '#####################   #',
            '#           #       #OOO#',
            '# S         #       #OOO#',
            '#           #       #OOO#',
            '#   #   #   #   #   #OOO#',
            '#   #   #       #   #OOO#',
            '#   #   #       #III#OOO#',
            '#   #   #       #   #OOO#',
            '#   #   #####   #   #   #',
            '#   #   #       #       #',
            '#   #   #       #       #',
            '#   #   #       #       #',
            '#########################',
        ],
    },    {
        name: 'Level 18',
        // The platform and the big spike. `node tools/find-level.mjs level18`,
        // seed 150. 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2
        // cells deep. Y: a spike row just inside the straight dead end that
        // goes up from the start cell, in plain view. G: the space door
        // (between path cells 8 and 9). X: a spike on the path (path cell 12),
        // plate 0.7 like Level 8. O: the platform gap over path cells 17-18
        // (straight from 16 to 19). I: the slippery spot (path cell 21). At
        // least 2 path cells between any two of them.
        theme: SPACE,
        music: 'hopscotch',
        spikeRadius: 0.7,
        layout: [
            '#########################',
            '#        OOOOOOO        #',
            '#        OOOOOOO        #',
            '#        OOOOOOO        #',
            '#   #################   #',
            '#                   #   #',
            '#         X         #III#',
            '#                   #   #',
            '#####   #########   #   #',
            '#   #       #       #   #',
            '#   #       #       #   #',
            '#   #       #       #   #',
            '#   #########   #GGG#   #',
            '#   #       #   #   #   #',
            '#   #       #   #   #   #',
            '# Y #       #   #   #   #',
            '#   #####   #####   #   #',
            '#           #       #   #',
            '# S         #       #   D',
            '#           #       #   #',
            '#   #####   #   #####   #',
            '#       #       #       #',
            '#       #       #       #',
            '#       #       #       #',
            '#########################',
        ],
    },    {
        name: 'Level 19',
        // The sneaky big spike in space. `node tools/find-level.mjs level19`,
        // seed 117. 6 x 6 corridors. Correct path 23 cells; 5 dead ends 2
        // cells deep, plus the hidden one: off path cell 3 it runs straight
        // for two cells, then turns, and Y (the spike row) sits in the middle
        // of the cell round the corner, out of sight like Level 9's. I: the
        // slippery spot (path cell 7). X: a spike on the path (path cell 11),
        // plate 0.7 like Level 18. O: the platform gap over path cells 15-16
        // (straight from 14 to 17). G: the space door (between path cells 19
        // and 20). At least 2 path cells between any two of them.
        theme: SPACE,
        music: 'peekaboo',
        spikeRadius: 0.7,
        layout: [
            '#########################',
            '#       #       #       #',
            '#       #       #       #',
            '#       #       #       #',
            '#   #####   #####   #   #',
            '#               #   #   #',
            '# S             #III#   #',
            '#               #   #   #',
            '#   #####   #   #   #   #',
            '#   #   #   #       #   #',
            '#   #   #   #       # X #',
            '#   #   #   #       #   #',
            '#   #   #   #########   #',
            '#   #   #       #       #',
            '#   #   #     Y #       #',
            '#   #   #       #       #',
            '#####   #########   #####',
            '#   #    OOOOOOO    #   #',
            '#   #    OOOOOOO    #   D',
            '#   #    OOOOOOO    #   #',
            '#   #   #############   #',
            '#           G           #',
            '#           G           #',
            '#           G           #',
            '#########################',
        ],
    },    {
        name: 'Level 20',
        // The Space World finale. `node tools/find-level.mjs level20`, seed 25.
        // 6 x 6 corridors. Correct path 24 cells; 6 dead ends each 2 cells
        // deep. Y: a spike row just inside the straight dead end that goes
        // down from the start cell, in plain view. X: a spike on the path
        // (path cell 7), plate 0.7 like Level 18. Z: a second spike on the
        // path (path cell 12), plate 0.72 like Level 10, the tightest squeeze.
        // O: the platform gap over path cells 16-17 (straight from 15 to 18).
        // I: the slippery spot (path cell 21). No space door. At least 2 path
        // cells between any two of them. Golden door, confetti, long cheer.
        theme: SPACE,
        music: 'galaxy',
        spikeRadius: 0.7,
        spike2Radius: 0.72,
        finale: 'You beat Space World!',
        nextLabel: 'Start Jungle World',
        layout: [
            '#########################',
            '#   #         I         #',
            '#   #         I         #',
            '#   #         I         #',
            '#   #   #############   #',
            '#        OOOOOOO    #   #',
            '#        OOOOOOO    #   D',
            '#        OOOOOOO    #   #',
            '#################   #####',
            '#       #       #       #',
            '#       #       #       #',
            '#       #       #       #',
            '#####   #   #   #####   #',
            '#           #   #   #   #',
            '# S         #   #   # Z #',
            '#           #   #   #   #',
            '#   #   #####   #   #   #',
            '# Y #       #   #       #',
            '#   #       # X #       #',
            '#   #       #   #       #',
            '#   #########   #####   #',
            '#   #                   #',
            '#   #                   #',
            '#   #                   #',
            '#########################',
        ],
    },    {
        name: 'Level 21',
        // Welcome to Jungle World. `node tools/find-level.mjs level21 8`, seed 1.
        // 7 x 7 corridors. Correct path 30 cells; 8 dead ends 2 cells deep,
        // plus the thorny bush's: off path cell 2 it goes 2 cells, turns once,
        // and the bush (X) sits in its last cell, out of sight of the path like
        // Level 11's spike. O: the river gap for the leaf over path cells 19-20
        // (straight from 18 to 21). No doors, no slippery spots.
        theme: JUNGLE,
        music: 'jungle',
        layout: [
            '#############################',
            '#           #               #',
            '#           #               #',
            '#           #               #',
            '#   #####   #   #####   #   #',
            '#       #           #   #   #',
            '#       #           #   #   #',
            '#       #           #   #   #',
            '#####   #####   #   #   #   #',
            '#       #       #   #   #OOO#',
            '#       #       #   #   #OOO#',
            '#       #       #   #   #OOO#',
            '#   #####################OOO#',
            '#       #       #       #OOO#',
            '#       #       #       #OOO#',
            '#       #       #       #OOO#',
            '#####   #   #########   #   #',
            '#       #                   #',
            '# S     #                   #',
            '#       #                   #',
            '#   #   #   #################',
            '#   #   #                   #',
            '#   #   #                   D',
            '#   #   #                   #',
            '#   #   #####   #########   #',
            '#   #       #       #       #',
            '#   #     X #       #       #',
            '#   #       #       #       #',
            '#############################',
        ],
    },
    {
        name: 'Level 22',
        // The big bush. `node tools/find-level.mjs level22 7`, seed 33.
        // 7 x 7 corridors. Correct path 32 cells; 7 dead ends 2 cells deep,
        // plus the hidden bush's (X): off path cell 3 it goes 2 cells, turns
        // once, and the bush sits in its last cell, out of sight of the path.
        // Y: the big bush right across the opening of a straight dead end off
        // path cell 9, in plain view. O: the river gap for the leaf over path
        // cells 25-26. No doors, no slippery spots.
        theme: JUNGLE,
        music: 'thicket',
        layout: [
            '#############################',
            '#       #           #       #',
            '#       #           #       #',
            '#       #           #       #',
            '#####   #   #####   #####   #',
            '#   #       #   #           #',
            '#   #       # X #           #',
            '#   #       #   #           #',
            '#   #   #####   #   #####   #',
            '#   #           # Y #       #',
            '#   #           #   #       #',
            '#   #           #   #       #',
            '#   #   #########   #   #####',
            '#               #   #       #',
            '# S             #   #       #',
            '#               #   #       #',
            '#########################   #',
            '#       #       #           #',
            '#       #       #           #',
            '#       #       #           #',
            '#####   #   #####   #########',
            '#                   #       #',
            '#                   #       #',
            '#                   #       #',
            '#   #################   #   #',
            '#    OOOOOOO            #   #',
            '#    OOOOOOO            #   D',
            '#    OOOOOOO            #   #',
            '#############################',
        ],
    },
    {
        name: 'Level 23',
        // Two rivers. `node tools/find-level.mjs level23 7`, seed 50.
        // 7 x 7 corridors. Correct path 32 cells; 7 dead ends 2 cells deep,
        // plus the hidden bush's (X): off path cell 3 it goes 2 cells, turns
        // once, and the bush sits in its last cell, out of sight of the path.
        // O: two river gaps, each with its own leaf: over path cells 11-12
        // (running north) and 19-20 (running east), with a turn between them.
        // No big bush, no doors, no slippery spots.
        theme: JUNGLE,
        music: 'rapids',
        layout: [
            '#############################',
            '#                       #   #',
            '#                       #   D',
            '#                       #   #',
            '#   #   #########   #   #   #',
            '#   #           #   #       #',
            '#   #           #   #       #',
            '#   #           #   #       #',
            '#############   #   #####   #',
            '#           #   #   #       #',
            '#         X #   #   #       #',
            '#           #   #   #       #',
            '#   #########   #############',
            '#           #OOO#       #   #',
            '# S         #OOO#       #   #',
            '#           #OOO#       #   #',
            '#####   #   #OOO#####   #   #',
            '#       #   #OOO#           #',
            '#       #   #OOO#           #',
            '#       #   #OOO#           #',
            '#   #########   #   #   #####',
            '#   #       #       #       #',
            '#   #       #       #       #',
            '#   #       #       #       #',
            '#   #   #   #########   #   #',
            '#       #    OOOOOOO    #   #',
            '#       #    OOOOOOO    #   #',
            '#       #    OOOOOOO    #   #',
            '#############################',
        ],
    },
    {
        name: 'Level 24',
        // Three rivers and two bushes. `node tools/find-level.mjs level24 6`,
        // seed 58. 7 x 7 corridors. Correct path 34 cells; 6 dead ends 2 cells
        // deep, plus the hidden bush's (X): off one of the first 3 path cells
        // it goes 2 cells, turns once, and the bush sits in its last cell, out
        // of sight of the path. Y: the big bush right across the opening of a
        // straight dead end off path cell 18, in plain view. O: three river
        // gaps, each with its own leaf, over path cells 13-14, 25-26 and
        // 31-32, with turns between them. No doors, no slippery spots.
        theme: JUNGLE,
        music: 'canopy',
        layout: [
            '#############################',
            '#            OOOOOOO        #',
            '#            OOOOOOO        D',
            '#            OOOOOOO        #',
            '#   #########################',
            '#    OOOOOOO                #',
            '#    OOOOOOO                #',
            '#    OOOOOOO                #',
            '#############   #   #####   #',
            '#           #   #   #       #',
            '# X         #   #   #       #',
            '#           #   #   #       #',
            '#########   #   #   #   #   #',
            '#           #   #   #   #   #',
            '# S         #   #   #   #   #',
            '#           #   #   #   #   #',
            '#########   #############   #',
            '#           #   #           #',
            '#           #   #      Y    #',
            '#           #   #           #',
            '#   #########   #########   #',
            '#   #           #           #',
            '#   #           #           #',
            '#   #           #           #',
            '#   #   #   #############   #',
            '#       #    OOOOOOO        #',
            '#       #    OOOOOOO        #',
            '#       #    OOOOOOO        #',
            '#############################',
        ],
    },
    {
        name: 'Level 25',
        // The squeeze-past bush. `node tools/find-level.mjs level25 8`, seed
        // 122. 7 x 7 corridors. Correct path 33 cells; 8 dead ends, each 2
        // cells deep. X: a small thorny bush on the path in cell 24, with
        // straight path in and out so you see it coming; its plate 0.64 like
        // Level 14's spike. O: three river gaps, each with its own leaf, over
        // path cells 6-7, 19-20 and 30-31, with turns between them. No big
        // bush, no hidden bush, no doors, no slippery spots.
        theme: JUNGLE,
        music: 'vines',
        spikeRadius: 0.64,
        layout: [
            '#############################',
            '#            OOOOOOO        #',
            '#            OOOOOOO        D',
            '#            OOOOOOO        #',
            '#########   #################',
            '#           #               #',
            '#           #     X         #',
            '#           #               #',
            '#########   #   #########   #',
            '#   #           #           #',
            '#   #           #           #',
            '#   #           #           #',
            '#   #   #################   #',
            '#   #   #       #       #OOO#',
            '#   #   #       #       #OOO#',
            '#   #   #       #       #OOO#',
            '#   #####   #########   #OOO#',
            '#               #       #OOO#',
            '# S             #       #OOO#',
            '#               #       #OOO#',
            '#############   #   #   #   #',
            '#    OOOOOOO    #   #       #',
            '#    OOOOOOO    #   #       #',
            '#    OOOOOOO    #   #       #',
            '#   #############   #   #####',
            '#                   #       #',
            '#                   #       #',
            '#                   #       #',
            '#############################',
        ],
    },
    {
        name: 'Level 26',
        // A tighter squeeze. `node tools/find-level.mjs level26 7`, seed 74.
        // 7 x 7 corridors. Correct path 32 cells; 7 dead ends 2 cells deep and
        // the hidden bush's dead end 3 cells deep with one turn. Z: the small
        // thorny bush on the path in cell 24, straight path in and out; its
        // plate 0.67 like Level 7's spike (about 15% less room than Level 25).
        // X: the hidden bush round the corner of the dead end off path cell 3.
        // O: three river gaps, each with its own leaf, over path cells 11-12,
        // 19-20 and 27-28. No big bush, no doors, no slippery spots.
        theme: JUNGLE,
        music: 'bramble',
        spike2Radius: 0.67,
        layout: [
            '#############################',
            '#       #           #       #',
            '#       #           #       #',
            '#       #           #       #',
            '#####   #   #   #   #   #   #',
            '#           #   #   #OOO#   #',
            '# S         #   #   #OOO#   #',
            '#           #   #   #OOO#   #',
            '#   #########   #####OOO#   #',
            '#           #   #   #OOO#   #',
            '#         X #   #   #OOO#   D',
            '#           #   #   #OOO#   #',
            '#############   #   #   #####',
            '#                   #       #',
            '#                   #       #',
            '#                   #       #',
            '#########   #############   #',
            '#            OOOOOOO    #   #',
            '#            OOOOOOO    # Z #',
            '#            OOOOOOO    #   #',
            '#####################   #   #',
            '#                       #   #',
            '#                       #   #',
            '#                       #   #',
            '#########   #############   #',
            '#            OOOOOOO        #',
            '#            OOOOOOO        #',
            '#            OOOOOOO        #',
            '#############################',
        ],
    },
    {
        name: 'Level 27',
        // The first fast leaf. `node tools/find-level.mjs level27 7`, seed
        // 111. 7 x 7 corridors. Correct path 35 cells; 7 dead ends, each 2
        // cells deep. X: a small thorny bush on the path in cell 19, straight
        // path in and out; its plate 0.7 like Level 8's spike (about 15% less
        // room than Level 26). Three river gaps, each with its own leaf, over
        // path cells 3-4 (O), 15-16 (F: the fast leaf, about 30% faster) and
        // 23-24 (O). No big bush, no hidden bush, no doors, no slippery spots.
        theme: JUNGLE,
        music: 'zoom',
        spikeRadius: 0.7,
        layout: [
            '#############################',
            '#                           #',
            '#                           #',
            '#                           #',
            '#   #################   #   #',
            '#   #    FFFFFFF    #   #   #',
            '#   #    FFFFFFF    #   #   #',
            '#   #    FFFFFFF    #   #   #',
            '#   #   #########   #   #   #',
            '#   #   #   #       #   #   #',
            '#   #   #   #       #   #   D',
            '#   #   #   #       #   #   #',
            '#   #   #   #   #   #####   #',
            '#OOO#   #       #       #   #',
            '#OOO# X #       #       #   #',
            '#OOO#   #       #       #   #',
            '#OOO#   #####   #########   #',
            '#OOO#   #               #   #',
            '#OOO#   #               #   #',
            '#OOO#   #               #   #',
            '#   #   #   #################',
            '#       #                   #',
            '#       #                   #',
            '#       #                   #',
            '#################   #########',
            '#        OOOOOOO            #',
            '# S      OOOOOOO            #',
            '#        OOOOOOO            #',
            '#############################',
        ],
    },
    {
        name: 'Level 28',
        // Two fast leaves. `node tools/find-level.mjs level28 7`, seed 399.
        // 7 x 7 corridors. Correct path 28 cells; 7 dead ends, each 3 cells
        // deep (longer than Levels 21-27). X: a small thorny bush on the path
        // in cell 10, straight path in and out; its plate 0.7 like Level 27's.
        // Three river gaps, each with its own leaf, over path cells 6-7 (F,
        // fast), 20-21 (O) and 24-25 (F, fast). No big bush, no hidden bush,
        // no doors, no slippery spots.
        theme: JUNGLE,
        music: 'leap',
        spikeRadius: 0.7,
        layout: [
            '#############################',
            '#    FFFFFFF                #',
            '#    FFFFFFF          X     #',
            '#    FFFFFFF                #',
            '#   #####################   #',
            '#       #                   #',
            '#       #                   #',
            '#       #                   #',
            '#####   #############   #####',
            '#                   #   #   #',
            '# S                 #   #   #',
            '#                   #   #   #',
            '#   #################   #   #',
            '#           #           #   #',
            '#           #           #   #',
            '#           #           #   #',
            '#############   #   #####   #',
            '#       #       #       #   #',
            '#       #       #       #   #',
            '#       #       #       #   #',
            '#####   #############   #   #',
            '#   #        OOOOOOO    #   #',
            '#   #        OOOOOOO    #   D',
            '#   #        OOOOOOO    #   #',
            '#   #####   #############   #',
            '#            FFFFFFF        #',
            '#            FFFFFFF        #',
            '#            FFFFFFF        #',
            '#############################',
        ],
    },
    {
        name: 'Level 29',
        // Three fast leaves. `node tools/find-level.mjs level29 6`, seed 1152.
        // 7 x 7 corridors. Correct path 28 cells; 6 dead ends 3 cells deep and
        // the hidden bush's dead end, also 3 cells deep with one turn. Z: the
        // small thorny bush on the path in cell 26, straight path in and out;
        // its plate 0.72 like Level 10's spike (about 15% less room than Level
        // 28). X: the hidden bush round the corner of a dead end near the
        // start. F: three river gaps, every leaf fast, over path cells 6-7,
        // 10-11 and 22-23. No big bush, no doors, no slippery spots.
        theme: JUNGLE,
        music: 'scamper',
        spike2Radius: 0.72,
        layout: [
            '#############################',
            '#                FFFFFFF    #',
            '#                FFFFFFF    #',
            '#                FFFFFFF    #',
            '#############   #########   #',
            '#       #   #           #   #',
            '#     X #   #           #   #',
            '#       #   #           #   #',
            '#   #####   #########   #   #',
            '#   #       #           #   #',
            '#   #       #           # Z #',
            '#   #       #           #   #',
            '#   #   #####   #####   #   #',
            '#           #   #       #   #',
            '# S         #   #       #   #',
            '#           #   #       #   #',
            '#####   #   #####   #   #   #',
            '#       #       #   #   #   #',
            '#       #       #   #   #   D',
            '#       #       #   #   #   #',
            '#   #############   #   #####',
            '#    FFFFFFF    #   #       #',
            '#    FFFFFFF    #   #       #',
            '#    FFFFFFF    #   #       #',
            '#############   #########   #',
            '#                FFFFFFF    #',
            '#                FFFFFFF    #',
            '#                FFFFFFF    #',
            '#############################',
        ],
    },
    {
        name: 'Level 30',
        // The Jungle World finale. `node tools/find-level.mjs level30 6`, seed
        // 1226. 7 x 7 corridors. Correct path 28 cells; 6 dead ends 3 cells
        // deep and the hidden bush's dead end, also 3 cells deep with one
        // turn. Z: the small thorny bush on the path in cell 18, plate 0.72
        // like Level 29. Y: the big bush just inside the straight dead end off
        // path cell 24, in plain view. X: the hidden bush round the corner of
        // a dead end near the start. F: three river gaps, every leaf fast,
        // over path cells 6-7, 10-11 and 14-15. At least 2 path cells between
        // any two of the six. Golden door, confetti, long cheer.
        theme: JUNGLE,
        music: 'junglefinale',
        spike2Radius: 0.72,
        finale: 'You beat Jungle World!',
        nextLabel: 'Start Moon World',
        layout: [
            '#############################',
            '#                FFFFFFF    #',
            '#                FFFFFFF    #',
            '#                FFFFFFF    #',
            '#############   #########   #',
            '#    FFFFFFF            #   #',
            '#    FFFFFFF            #   #',
            '#    FFFFFFF            #   #',
            '#   #################   #   #',
            '#    FFFFFFF        #   #   #',
            '#    FFFFFFF        #   # Z #',
            '#    FFFFFFF        #   #   #',
            '#############   #   #####   #',
            '#               #   #       #',
            '# S             #   #       #',
            '#               #   #       #',
            '#   #   #########   #   #####',
            '#   #   #       #   #   #   #',
            '#   #   #       #   #   #   D',
            '#   #   #       #   #   #   #',
            '#   #   #####   #####   #   #',
            '#   #       #           #   #',
            '#   #     X #           #   #',
            '#   #       #           #   #',
            '#   #############   #####   #',
            '#   #                       #',
            '#   #          Y            #',
            '#   #                       #',
            '#############################',
        ],
    },
    {
        name: 'Level 31',
        // Welcome to Moon World. `node tools/find-level.mjs level31 8`, seed 27.
        // 8 x 8 corridors. Correct path 45 cells; 8 dead ends 2 cells deep,
        // plus the crater's: off path cell 3 it goes 2 cells, turns once, and
        // the crater (X) fills its last cell, out of sight of the path like
        // Level 21's bush. No crater on the path, no platform, no doors.
        theme: MOON,
        music: 'moonbase',
        spikeRadius: 1.2,
        layout: [
            '#################################',
            '#                               #',
            '#                               #',
            '#                               #',
            '#   #########################   #',
            '#                           #   #',
            '#                           #   #',
            '#                           #   #',
            '#########   #############   #   #',
            '#       #   #   #       #   #   #',
            '#       #   #   #       #   #   #',
            '#       #   #   #       #   #   #',
            '#####   #   #   #   #   #   #   #',
            '#       #   #       #   #   #   #',
            '# S     #   #       #   #   #   #',
            '#       #   #       #   #   #   #',
            '#####   #########   #   #   #   #',
            '#               #   #       #   #',
            '#               #   #       #   #',
            '#               #   #       #   #',
            '#   #########   #   #########   #',
            '#           #   #   #           #',
            '#           # X #   #           #',
            '#           #   #   #           #',
            '#   #####   #####   #   #   #####',
            '#   #               #   #   #   #',
            '#   #               #   #   #   D',
            '#   #               #   #   #   #',
            '#   #   #   #####   #####   #   #',
            '#   #   #       #       #       #',
            '#   #   #       #       #       #',
            '#   #   #       #       #       #',
            '#################################',
        ],
    },
    {
        name: 'Level 32',
        // The squeeze-past crater. `node tools/find-level.mjs level32 8`, seed
        // 161. 8 x 8 corridors. Correct path 45 cells; 8 dead ends 2 cells
        // deep, plus the hidden crater's (3 cells, one turn, branching off
        // within the first 3 path cells).
        // Z: a small crater on the path in cell 16, in a straight stretch of
        // the bottom row so you see it coming; its plate 0.64 like Level 25's
        // bush (Level 14's spike). X: the hidden crater filling the last cell
        // of a 3-cell dead end with one turn near the start, out of sight of
        // the path. No platform, no doors, no slippery spots.
        theme: MOON,
        music: 'craterhop',
        spikeRadius: 1.2,
        spike2Radius: 0.64,
        layout: [
            '#################################',
            '#   #           #   #   #       #',
            '#   #         X #   #   #       #',
            '#   #           #   #   #       #',
            '#   #   #########   #   #   #####',
            '#               #   #           #',
            '#               #   #           #',
            '#               #   #           #',
            '#####   #####   #   #####   #   #',
            '#       #       #           #   #',
            '# S     #       #           #   #',
            '#       #       #           #   #',
            '#########   #####   #   #####   #',
            '#       #   #       #       #   #',
            '#       #   #       #       #   #',
            '#       #   #       #       #   #',
            '#   #####   #   #############   #',
            '#           #       #       #   #',
            '#           #       #       #   #',
            '#           #       #       #   #',
            '#   #############   #   #   #   #',
            '#   #   #           #   #       #',
            '#   #   #           #   #       #',
            '#   #   #           #   #       #',
            '#   #   #   #########   #########',
            '#   #   #       #   #   #       #',
            '#   #   #       #   #   #       #',
            '#   #   #       #   #   #       #',
            '#   #   #####   #   #   #   #   #',
            '#                   #       #   #',
            '#         Z         #       #   D',
            '#                   #       #   #',
            '#################################',
        ],
    },
    {
        name: 'Level 33',
        // The big crater. `node tools/find-level.mjs level33 8`, seed 9. 8 x 8
        // corridors. Correct path 48 cells; 8 dead ends, all 2 cells deep.
        // Y: the big crater right across the corridor just inside a straight
        // dead end off path cell 21 (top row, heading east), in plain sight
        // of the path. X: a small crater on the path in cell 30, in the
        // straight right-hand column so you see it coming; its plate 0.64
        // like Level 32's. No hidden crater, no platform, no doors, no
        // slippery spots.
        theme: MOON,
        music: 'craterdrop',
        spikeRadius: 0.64,
        layout: [
            '#################################',
            '#       #                       #',
            '#       #                Y      #',
            '#       #                       #',
            '#   #####   #########   #########',
            '#       #   #       #           #',
            '# S     #   #       #           #',
            '#       #   #       #           #',
            '#####   #   #   #   #########   #',
            '#       #       #       #       #',
            '#       #       #       #       #',
            '#       #       #       #       #',
            '#   #################   #   #####',
            '#                       #       #',
            '#                       #       #',
            '#                       #       #',
            '#   #   #####################   #',
            '#   #   #                   #   #',
            '#   #   #                   #   #',
            '#   #   #                   #   #',
            '#   #   #   #####   #####   #   #',
            '#   #   #   #   #       #   #   #',
            '#   #   #   #   #       #   # X #',
            '#   #   #   #   #       #   #   #',
            '#########   #   #########   #   #',
            '#   #           #       #       #',
            '#   #           #       #       #',
            '#   #           #       #       #',
            '#   #   #########   #############',
            '#                               #',
            '#                               D',
            '#                               #',
            '#################################',
        ],
    },
    {
        name: 'Level 34',
        // A tighter squeeze on the moon. `node tools/find-level.mjs level34 8`,
        // seed 50. 8 x 8 corridors. Correct path 48 cells; 8 dead ends, all 2
        // cells deep. Y: the big crater right across a straight dead end off
        // path cell 35, in plain sight of the path. X: a small crater on the
        // path in cell 28 (top row, in a straight stretch); its plate 0.67
        // like Level 7's, a little tighter than Level 33's 0.64. No hidden
        // crater, no platform, no doors, no slippery spots.
        theme: MOON,
        music: 'craterpeek',
        spikeRadius: 0.67,
        layout: [
            '#################################',
            '#                   #       #   #',
            '#             X     #       #   #',
            '#                   #       #   #',
            '#   #   #########   #   #   #   #',
            '#   #   #       #       #       #',
            '#   #   #       #       #       #',
            '#   #   #       #       #       #',
            '#####   #####   #########   #####',
            '#               #               #',
            '#               #      Y        #',
            '#               #               #',
            '#   #########   #############   #',
            '#   #       #   #               #',
            '#   #       #   #               #',
            '#   #       #   #               #',
            '#####   #####   #   #############',
            '#           #   #           #   #',
            '# S         #   #           #   #',
            '#           #   #           #   #',
            '#####   #   #   #########   #   #',
            '#       #   #   #       #       #',
            '#       #   #   #       #       #',
            '#       #   #   #       #       #',
            '#   #########   #   #   #   #####',
            '#   #       #       #   #   #   #',
            '#   #       #       #   #   #   D',
            '#   #       #       #   #   #   #',
            '#   #   #   #########   #   #   #',
            '#       #               #       #',
            '#       #               #       #',
            '#       #               #       #',
            '#################################',
        ],
    },
    {
        name: 'Level 35',
        // Three craters. `node tools/find-level.mjs level35 8`, seed 308. 8 x 8
        // corridors. Correct path 45 cells; 8 dead ends 2 cells deep, plus the
        // hidden crater's (3 cells, one turn, branching off the start cell).
        // Y: the big crater right across a straight dead end off path cell 5
        // (bottom row), in plain sight of the path. Z: a small crater on the
        // path in cell 32, in a straight stretch of the left column; its plate
        // 0.7 like Level 8's, a little tighter than Level 34's 0.67. X: the
        // hidden crater filling the last cell of the dead end near the start,
        // out of sight of the path. No platform, no doors, no slippery spots.
        theme: MOON,
        music: 'cratertrio',
        spikeRadius: 1.2,
        spike2Radius: 0.7,
        layout: [
            '#################################',
            '#                           #   #',
            '#                           #   D',
            '#                           #   #',
            '#   #####################   #   #',
            '#   #           #       #   #   #',
            '#   #           #       #   #   #',
            '#   #           #       #   #   #',
            '#   #   #####   #   #   #   #   #',
            '#   #       #       #   #       #',
            '# Z #       #       #   #       #',
            '#   #       #       #   #       #',
            '#   #####   #   #####   #########',
            '#   #       #       #           #',
            '#   #       #       #           #',
            '#   #       #       #           #',
            '#   #   #############   #####   #',
            '#       #   #       #       #   #',
            '#       #   #       #       #   #',
            '#       #   #       #       #   #',
            '#####   #   #   #############   #',
            '#       #                       #',
            '#       #                       #',
            '#       #                       #',
            '#############   #####   #####   #',
            '#           #       #       #   #',
            '#         X #       #       #   #',
            '#           #       #       #   #',
            '#   #############   #########   #',
            '#                           #   #',
            '# S                  Y      #   #',
            '#                           #   #',
            '#################################',
        ],
    },
    {
        name: 'Level 36',
        // The first hover platform. `node tools/find-level.mjs level36 8`,
        // seed 53. 8 x 8 corridors. Correct path 48 cells; 8 dead ends, all 2
        // cells deep. O: the giant crater, a gap over path cells 26-28 (three
        // cells in a straight line down the second column), crossed on a hover
        // disc that works like Level 17's platform. X: a small crater on the
        // path in cell 32 (left column, straight stretch); its plate 0.7 like
        // Level 35's. No big crater, no hidden crater, no doors, no slippery spots.
        theme: MOON,
        music: 'hoverdisc',
        spikeRadius: 0.7,
        layout: [
            '#################################',
            '#               #       #       #',
            '# S             #       #       #',
            '#               #       #       #',
            '#############   #####   #   #   #',
            '#           #               #   #',
            '#           #               #   #',
            '#           #               #   #',
            '#   #   #   #####   #########   #',
            '#   #OOO#   #       #           #',
            '#   #OOO#   #       #           #',
            '#   #OOO#   #       #           #',
            '#   #OOO#####################   #',
            '#   #OOO#       #       #       #',
            '# X #OOO#       #       #       #',
            '#   #OOO#       #       #       #',
            '#   #OOO#   #########   #   #####',
            '#   #OOO#                       #',
            '#   #OOO#                       #',
            '#   #OOO#                       #',
            '#   #   #   #################   #',
            '#   #   #       #           #   #',
            '#   #   #       #           #   #',
            '#   #   #       #           #   #',
            '#   #   #####   #   #####   #####',
            '#   #           #       #   #   #',
            '#   #           #       #   #   D',
            '#   #           #       #   #   #',
            '#   #############   #   #   #   #',
            '#                   #   #       #',
            '#                   #   #       #',
            '#                   #   #       #',
            '#################################',
        ],
    },
    {
        name: 'Level 37',
        // The platform and the sneaky crater. `node tools/find-level.mjs level37 8`,
        // seed 398. 8 x 8 corridors. Correct path 45 cells; 8 dead ends 2 cells
        // deep, plus the hidden crater's (3 cells, one turn, branching off the
        // start cell). X: the hidden crater filling the last cell of that dead
        // end, out of sight of the path. Z: a small crater on the path in cell
        // 35 (top row, straight stretch); its plate 0.7 like Level 35's. O: the
        // giant crater, a gap over path cells 38-40 (three cells straight down
        // the right column), crossed on a hover disc like Level 36's. No big
        // crater, no doors, no slippery spots.
        theme: MOON,
        music: 'craterdive',
        spikeRadius: 1.2,
        spike2Radius: 0.7,
        layout: [
            '#################################',
            '#                               #',
            '#                         Z     #',
            '#                               #',
            '#   #########################   #',
            '#                           #   #',
            '#                           #   #',
            '#                           #   #',
            '#   #   #   #############   #   #',
            '#   #   #   #               #OOO#',
            '#   #   #   #               #OOO#',
            '#   #   #   #               #OOO#',
            '#   #   #   #   #   #########OOO#',
            '#   #   #   #   #   #       #OOO#',
            '#   #   #   #   #   #       #OOO#',
            '#   #   #   #   #   #       #OOO#',
            '#################   #   #   #OOO#',
            '#       #       #       #   #OOO#',
            '#     X #       #       #   #OOO#',
            '#       #       #       #   #OOO#',
            '#   #########   #########   #   #',
            '#   #       #               #   #',
            '#   #       #               #   #',
            '#   #       #               #   #',
            '#   #####   #   #############   #',
            '#           #           #       #',
            '# S         #           #       #',
            '#           #           #       #',
            '#########   #####   #   #   #####',
            '#                   #   #       #',
            '#                   #   #       D',
            '#                   #   #       #',
            '#################################',
        ],
    },
    {
        name: 'Level 38',
        // Two hover platforms. `node tools/find-level.mjs level38 8`, seed 174.
        // 8 x 8 corridors. Correct path 48 cells; 8 dead ends, all 2 cells
        // deep. O: two giant craters, gaps over path cells 35-37 (straight up
        // the left column) and 44-46 (straight along the top row), each
        // crossed on its own hover disc like Level 36's, with a turn between
        // them. X: a small crater on the path in cell 22 (right column,
        // straight stretch); its plate 0.7 like Level 35's. Y: the big crater
        // just inside a straight dead end off path cell 19, seen from the
        // path. No hidden crater, no doors, no slippery spots.
        theme: MOON,
        music: 'twinhover',
        spikeRadius: 0.7,
        layout: [
            '#################################',
            '#       #        OOOOOOOOOOO    #',
            '#       #        OOOOOOOOOOO    #',
            '#       #        OOOOOOOOOOO    #',
            '#   #   #   #################   #',
            '#OOO#       #               #   #',
            '#OOO#       #               #   D',
            '#OOO#       #               #   #',
            '#OOO#########   #########   #####',
            '#OOO#           #       #       #',
            '#OOO#           #       #       #',
            '#OOO#           #       #       #',
            '#OOO#   #########   #   #####   #',
            '#OOO#   #           #   #   #   #',
            '#OOO#   #           #   #   # X #',
            '#OOO#   #           #   #   #   #',
            '#   #   #   #########   #   #   #',
            '#       #       #   #   #       #',
            '#       #       #   #   #       #',
            '#       #       #   #   #       #',
            '#############   #   #   #####   #',
            '#           #   #               #',
            '# S         #   #               #',
            '#           #   #               #',
            '#   #   #   #   #####   #   #   #',
            '#   #   #   #   #   #   # Y #   #',
            '#   #   #   #   #   #   #   #   #',
            '#   #   #   #   #   #   #   #   #',
            '#   #   #   #   #   #   #   #   #',
            '#   #   #           #   #   #   #',
            '#   #   #           #   #   #   #',
            '#   #   #           #   #   #   #',
            '#################################',
        ],
    },
    {
        name: 'Level 39',
        // Longer wrong ways on the moon. `node tools/find-level.mjs level39 6`,
        // seed 654. 8 x 8 corridors. Correct path 43 cells; 6 dead ends 3 cells
        // deep, plus the hidden crater's (3 cells, one turn, branching off path
        // cell 2). X: the hidden crater filling the last cell of that dead end,
        // out of sight of the path. Z: a small crater on the path in cell 31
        // (straight stretch); its plate 0.7 like Level 35's. O: two giant
        // craters, gaps over path cells 25-27 (straight along the bottom row)
        // and 38-40 (straight up the right column), each crossed on its own
        // hover disc like Level 38's, with turns between them. No big crater,
        // no doors, no slippery spots. (7 or 8 dead ends 3 deep didn't fit.)
        theme: MOON,
        music: 'longway',
        spikeRadius: 1.2,
        spike2Radius: 0.7,
        layout: [
            '#################################',
            '#   #           #       #       #',
            '#   #           #       #       #',
            '#   #           #       #       #',
            '#   #########   #####   #   #####',
            '#                   #   #   #   #',
            '#                   #   #   #   D',
            '#                   #   #   #   #',
            '#########   #####   #   #   #   #',
            '#               #           #   #',
            '# S             #           #   #',
            '#               #           #   #',
            '#   #   #####   #########   #   #',
            '#   #   #       #           #   #',
            '#   #   #       #           #   #',
            '#   #   #       #           #   #',
            '#   #   #########   #########   #',
            '#   #       #       #       #OOO#',
            '#   #     X #       #       #OOO#',
            '#   #       #       #       #OOO#',
            '#   #########   #####   #   #OOO#',
            '#   #       #       #   #   #OOO#',
            '#   #       #       # Z #   #OOO#',
            '#   #       #       #   #   #OOO#',
            '#####   #   #####   #   #   #OOO#',
            '#       #           #   #   #OOO#',
            '#       #           #   #   #OOO#',
            '#       #           #   #   #OOO#',
            '#   #################   #   #   #',
            '#    OOOOOOOOOOO        #       #',
            '#    OOOOOOOOOOO        #       #',
            '#    OOOOOOOOOOO        #       #',
            '#################################',
        ],
    },
    {
        name: 'Level 40',
        // The Moon World finale. `node tools/find-level.mjs level40 6`, seed
        // 246. 8 x 8 corridors. Correct path 43 cells; 6 dead ends 3 cells
        // deep, plus the hidden crater's (3 cells, one turn, 3 cells from the
        // start). X: the hidden crater filling the last cell of that dead end,
        // out of sight of the path. Z: a small crater on the path in cell 28
        // (straight up the right column); its plate 0.72 like Level 10's
        // spike, the tightest squeeze in Moon World. Y: the big crater just
        // inside the straight dead end off path cell 16, in plain view. O: two
        // giant craters, gaps over path cells 8-10 (bottom row) and 39-41 (top
        // row), each crossed on its own hover disc like Level 38's. At least 2
        // path cells between any two of the five. Golden door, confetti, long
        // cheer. (7 dead ends 3 deep didn't fit.)
        theme: MOON,
        music: 'moonfinale',
        spikeRadius: 1.2,
        spike2Radius: 0.72,
        finale: 'You beat Moon World!',
        layout: [
            '#################################',
            '#            OOOOOOOOOOO        #',
            '#            OOOOOOOOOOO        D',
            '#            OOOOOOOOOOO        #',
            '#   #####   #####################',
            '#   #                           #',
            '#   #                           #',
            '#   #                           #',
            '#####   #########   #########   #',
            '#       #           #       #   #',
            '#       #           #       #   #',
            '#       #           #       #   #',
            '#########################   #   #',
            '#                       #   #   #',
            '#          Y            #   #   #',
            '#                       #   #   #',
            '#############   #####   #   #   #',
            '#           #       #       #   #',
            '#         X #       #       #   #',
            '#           #       #       #   #',
            '#   #########   #   #####   #   #',
            '#           #   #       #   #   #',
            '# S         #   #       #   # Z #',
            '#           #   #       #   #   #',
            '#########   #   #########   #   #',
            '#           #       #       #   #',
            '#           #       #       #   #',
            '#           #       #       #   #',
            '#   #############   #   #####   #',
            '#    OOOOOOOOOOO    #           #',
            '#    OOOOOOOOOOO    #           #',
            '#    OOOOOOOOOOO    #           #',
            '#################################',
        ],
    },
];

// The worlds, for Pick a level: each run of levels with the same theme, with
// the index of its first and last built level and its look.
export const WORLDS = [];
LEVELS.forEach((level, index) => {
    const last = WORLDS[WORLDS.length - 1];
    if (last && last.theme === level.theme) {
        last.last = index;
    } else {
        const look = level.theme.moon ? 'moon' : level.theme.space ? 'space' : level.theme.jungle ? 'jungle' : 'candy';
        WORLDS.push({ theme: level.theme, first: index, last: index, look });
    }
});

// Read the Green - Golf Caddie Strategy Game
// You're the caddie - set strategy and learn your player's hidden abilities

const COLS = 20;
const ROWS = 50;
const CELL_SIZE = 14;
const YARDS_PER_CELL = 8.4; // 420 yards / 50 rows = 8.4 yards per cell

// Terrain types
const TERRAIN = {
    TEE: 'tee',
    FAIRWAY: 'fairway',
    ROUGH: 'rough',
    DEEP_ROUGH: 'deep_rough',
    BUNKER: 'bunker',
    WATER: 'water',
    GREEN: 'green',
    TREES: 'trees'
};

// Terrain colors
const TERRAIN_COLORS = {
    [TERRAIN.TEE]: '#f5f5f5',
    [TERRAIN.FAIRWAY]: '#7cb342',
    [TERRAIN.ROUGH]: '#558b2f',
    [TERRAIN.DEEP_ROUGH]: '#33691e',
    [TERRAIN.BUNKER]: '#d7ccc8',
    [TERRAIN.WATER]: '#42a5f5',
    [TERRAIN.GREEN]: '#69f0ae',
    [TERRAIN.TREES]: '#4e342e'
};

const FOG_COLOR = '#37474f';
const OUTLINE_COLOR = 'rgba(255,255,255,0.15)';

// Slope directions
const SLOPES = {
    FLAT: { symbol: '', dx: 0, dy: 0, name: 'flat' },
    N: { symbol: '↑', dx: 0, dy: -1, name: 'uphill' },
    S: { symbol: '↓', dx: 0, dy: 1, name: 'downhill' },
    E: { symbol: '→', dx: 1, dy: 0, name: 'right break' },
    W: { symbol: '←', dx: -1, dy: 0, name: 'left break' },
    NE: { symbol: '↗', dx: 1, dy: -1, name: 'uphill right' },
    NW: { symbol: '↖', dx: -1, dy: -1, name: 'uphill left' },
    SE: { symbol: '↘', dx: 1, dy: 1, name: 'downhill right' },
    SW: { symbol: '↙', dx: -1, dy: 1, name: 'downhill left' }
};

// Pin positions (row, col, name, difficulty)
const PIN_POSITIONS = [
    { row: 6, col: 10, name: 'Front Center', difficulty: 'Easy', desc: 'Front Center - Easy' },
    { row: 4, col: 8, name: 'Back Left', difficulty: 'Hard', desc: 'Back Left - Hard (near bunker)' },
    { row: 4, col: 12, name: 'Back Right', difficulty: 'Medium', desc: 'Back Right - Medium' },
    { row: 7, col: 7, name: 'Front Left', difficulty: 'Medium', desc: 'Front Left - Medium (downhill)' },
    { row: 5, col: 13, name: 'Right Side', difficulty: 'Hard', desc: 'Right Side - Hard (near water)' }
];

// Distance limits in yards
const MAX_DISTANCES = {
    tee: 300,
    fairway: 200,
    rough: 180,
    deep_rough: 140,
    bunker: 100,
    green: 50
};

// Dispersion (radius in feet) at various distances
const BASE_DISPERSION = {
    100: 15,
    150: 30,
    200: 50,
    250: 75,
    300: 100
};

// Player names for random generation
const FIRST_NAMES = ['James', 'Michael', 'David', 'Chris', 'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Jamie'];
const LAST_NAMES = ['Woods', 'Palmer', 'Nicklaus', 'Player', 'Watson', 'Faldo', 'Norman', 'Singh', 'Els', 'Garcia'];

// Audio context for sounds
let audioCtx = null;

// Game state
let gameState = {
    attempt: 1,
    strokes: 0,
    phase: 'planning',
    ballPos: { row: 47, col: 10 },
    plannedShots: [],
    executedShots: [],
    pinIndex: 0,
    revealedCells: new Set(),
    courseGrid: [],
    slopeGrid: [],
    outlineGrid: [], // For showing faint outline of fairway/green
    hoverPos: null,
    observations: [],
    roundObservations: [],
    player: null,
    totalAttempts: 0,
    scores: [],
    hazardsFound: 0
};

// Generate random player with hidden attributes (1-10 scale)
function generatePlayer() {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

    return {
        name: `${firstName} ${lastName}`,
        // Hidden attributes - player never sees exact numbers
        drivingDistance: 3 + Math.floor(Math.random() * 8), // 3-10: affects max drive (270-310)
        drivingAccuracy: 3 + Math.floor(Math.random() * 8),
        approachAccuracy: 3 + Math.floor(Math.random() * 8),
        shortGame: 3 + Math.floor(Math.random() * 8),
        puttingShort: 3 + Math.floor(Math.random() * 8),
        puttingLong: 3 + Math.floor(Math.random() * 8),
        shotShaping: 3 + Math.floor(Math.random() * 8),
        nerves: 3 + Math.floor(Math.random() * 8)
    };
}

// Design the course - 420 yard par 4 dogleg right
function designCourse() {
    gameState.courseGrid = [];
    gameState.slopeGrid = [];
    gameState.outlineGrid = [];

    // Initialize all as rough
    for (let row = 0; row < ROWS; row++) {
        gameState.courseGrid[row] = [];
        gameState.slopeGrid[row] = [];
        gameState.outlineGrid[row] = [];
        for (let col = 0; col < COLS; col++) {
            gameState.courseGrid[row][col] = TERRAIN.ROUGH;
            gameState.slopeGrid[row][col] = 'FLAT';
            gameState.outlineGrid[row][col] = false;
        }
    }

    // Tee box (rows 46-49, cols 8-12)
    fillRect(46, 8, 4, 5, TERRAIN.TEE);
    setOutline(46, 8, 4, 5);

    // Main fairway - starts straight then bends right
    // Section 1: Straight from tee (rows 38-46, cols 7-13)
    fillRect(38, 7, 9, 7, TERRAIN.FAIRWAY);
    setOutline(38, 7, 9, 7);

    // Section 2: Slight bend right (rows 28-38, cols 8-15)
    fillRect(28, 8, 11, 8, TERRAIN.FAIRWAY);
    setOutline(28, 8, 11, 8);

    // Section 3: Approach area (rows 18-28, cols 9-16)
    fillRect(18, 9, 11, 8, TERRAIN.FAIRWAY);
    setOutline(18, 9, 11, 8);

    // Section 4: Near green (rows 10-18, cols 8-15)
    fillRect(10, 8, 9, 8, TERRAIN.FAIRWAY);
    setOutline(10, 8, 9, 8);

    // Green (rows 2-9, cols 6-15) - large green
    fillRect(2, 6, 8, 10, TERRAIN.GREEN);
    setOutline(2, 6, 8, 10);

    // HAZARDS

    // Fairway bunker left at ~250 yards (rows 30-33, cols 5-8)
    fillRect(30, 5, 4, 4, TERRAIN.BUNKER);

    // Trees right side blocking direct line (rows 22-35, cols 16-19)
    fillRect(22, 16, 14, 4, TERRAIN.TREES);

    // More trees right (rows 15-22, cols 17-19)
    fillRect(15, 17, 8, 3, TERRAIN.TREES);

    // Water short-right of green (rows 8-12, cols 14-18)
    fillRect(8, 14, 5, 5, TERRAIN.WATER);

    // Greenside bunker back-left (rows 1-4, cols 4-6)
    fillRect(1, 4, 4, 3, TERRAIN.BUNKER);

    // Deep rough patches
    fillRect(35, 4, 5, 3, TERRAIN.DEEP_ROUGH);
    fillRect(25, 17, 5, 2, TERRAIN.DEEP_ROUGH);
    fillRect(12, 5, 4, 3, TERRAIN.DEEP_ROUGH);

    // Trees behind green
    fillRect(0, 0, 3, 5, TERRAIN.TREES);
    fillRect(0, 16, 3, 4, TERRAIN.TREES);

    // GREEN SLOPES - back to front with some break
    setSlopeArea(2, 6, 3, 5, 'S');   // Back left slopes down
    setSlopeArea(2, 11, 3, 5, 'SW'); // Back right slopes down-left
    setSlopeArea(5, 6, 4, 5, 'SE');  // Front left slopes down-right
    setSlopeArea(5, 11, 4, 5, 'S');  // Front right slopes down
    setSlopeArea(4, 8, 3, 4, 'S');   // Center slopes down (back to front)

    // Fairway slopes
    setSlopeArea(30, 8, 5, 4, 'E');  // Near left bunker, slopes toward it
    setSlopeArea(20, 10, 5, 5, 'W'); // Approach area slight left slope
}

function fillRect(startRow, startCol, rows, cols, terrain) {
    for (let r = startRow; r < startRow + rows && r < ROWS; r++) {
        for (let c = startCol; c < startCol + cols && c < COLS; c++) {
            if (r >= 0 && c >= 0 && c < COLS) {
                gameState.courseGrid[r][c] = terrain;
            }
        }
    }
}

function setOutline(startRow, startCol, rows, cols) {
    for (let r = startRow; r < startRow + rows && r < ROWS; r++) {
        for (let c = startCol; c < startCol + cols && c < COLS; c++) {
            if (r >= 0 && c >= 0 && c < COLS) {
                gameState.outlineGrid[r][c] = true;
            }
        }
    }
}

function setSlopeArea(startRow, startCol, rows, cols, slope) {
    for (let r = startRow; r < startRow + rows && r < ROWS; r++) {
        for (let c = startCol; c < startCol + cols && c < COLS; c++) {
            if (r >= 0 && c >= 0 && c < COLS) {
                gameState.slopeGrid[r][c] = slope;
            }
        }
    }
}

// Canvas and rendering
let canvas, ctx;

function initCanvas() {
    canvas = document.getElementById('course-canvas');
    canvas.width = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;
    ctx = canvas.getContext('2d');
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all cells
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cellKey = `${row},${col}`;
            const isRevealed = gameState.revealedCells.has(cellKey);
            const terrain = gameState.courseGrid[row][col];
            const hasOutline = gameState.outlineGrid[row][col];

            if (isRevealed) {
                // Show actual terrain
                ctx.fillStyle = TERRAIN_COLORS[terrain];
                ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                // Show slope arrow if not flat
                const slope = gameState.slopeGrid[row][col];
                if (slope !== 'FLAT' && SLOPES[slope]) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.font = '8px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        SLOPES[slope].symbol,
                        col * CELL_SIZE + CELL_SIZE / 2,
                        row * CELL_SIZE + CELL_SIZE / 2
                    );
                }
            } else {
                // Fog of war
                ctx.fillStyle = FOG_COLOR;
                ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                // Show faint outline for fairway/green/tee
                if (hasOutline) {
                    ctx.fillStyle = OUTLINE_COLOR;
                    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }

            // Grid lines
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }

    // Draw pin (always visible on green outline)
    const pin = PIN_POSITIONS[gameState.pinIndex];
    drawFlag(pin.col, pin.row);

    // Draw planned shot lines and targets
    if (gameState.phase === 'planning') {
        let fromPos = { ...gameState.ballPos };

        gameState.plannedShots.forEach((shot, index) => {
            // Draw line
            drawShotLine(fromPos, shot.target, index);
            // Draw target
            drawTarget(shot.target, index + 1);
            fromPos = shot.target;
        });

        // Draw hover preview
        if (gameState.hoverPos) {
            const fromPos = gameState.plannedShots.length > 0
                ? gameState.plannedShots[gameState.plannedShots.length - 1].target
                : gameState.ballPos;
            drawShotLine(fromPos, gameState.hoverPos, gameState.plannedShots.length, true);
            drawTarget(gameState.hoverPos, gameState.plannedShots.length + 1, true);
        }
    }

    // Draw executed shot landing spots
    gameState.executedShots.forEach((shot, index) => {
        drawLandingSpot(shot.landingPos.row, shot.landingPos.col, shot.quality);
    });

    // Update ball display
    updateBallDisplay();
}

function drawFlag(col, row) {
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;

    // Hole
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Pole
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 12);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Flag
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 8, y - 9);
    ctx.lineTo(x, y - 6);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
}

function drawShotLine(from, to, index, isPreview = false) {
    const x1 = from.col * CELL_SIZE + CELL_SIZE / 2;
    const y1 = from.row * CELL_SIZE + CELL_SIZE / 2;
    const x2 = to.col * CELL_SIZE + CELL_SIZE / 2;
    const y2 = to.row * CELL_SIZE + CELL_SIZE / 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    if (isPreview) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([4, 4]);
    } else {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
        ctx.setLineDash([]);
    }

    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawTarget(pos, number, isPreview = false) {
    const x = pos.col * CELL_SIZE + CELL_SIZE / 2;
    const y = pos.row * CELL_SIZE + CELL_SIZE / 2;

    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = isPreview ? 'rgba(255,255,255,0.4)' : 'rgba(74, 222, 128, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner fill
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isPreview ? 'rgba(255,255,255,0.15)' : 'rgba(74, 222, 128, 0.3)';
    ctx.fill();

    // Number
    ctx.fillStyle = isPreview ? 'rgba(255,255,255,0.6)' : '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), x, y);
}

function drawLandingSpot(row, col, quality) {
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);

    if (quality === 'good') {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
    } else if (quality === 'ok') {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
    } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    }

    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function updateBallDisplay() {
    const ball = document.getElementById('ball');

    if (gameState.phase === 'planning' && gameState.executedShots.length === 0) {
        // Show ball on tee
        ball.classList.remove('hidden');
        ball.style.left = (gameState.ballPos.col * CELL_SIZE + CELL_SIZE / 2) + 'px';
        ball.style.top = (gameState.ballPos.row * CELL_SIZE + CELL_SIZE / 2) + 'px';
    } else if (gameState.phase === 'executing') {
        ball.classList.remove('hidden');
        ball.style.left = (gameState.ballPos.col * CELL_SIZE + CELL_SIZE / 2) + 'px';
        ball.style.top = (gameState.ballPos.row * CELL_SIZE + CELL_SIZE / 2) + 'px';
    } else {
        ball.classList.add('hidden');
    }
}

// Distance calculations
function cellDistance(from, to) {
    const dRow = to.row - from.row;
    const dCol = to.col - from.col;
    return Math.sqrt(dRow * dRow + dCol * dCol);
}

function cellsToYards(cells) {
    return Math.round(cells * YARDS_PER_CELL);
}

function yardsToFeet(yards) {
    return yards * 3;
}

// Get maximum distance for current lie
function getMaxDistance(terrain) {
    return MAX_DISTANCES[terrain] || MAX_DISTANCES.rough;
}

// Calculate dispersion radius in cells based on distance
function getDispersion(distanceYards, fromTerrain, player, shotType, hasTreesInPath, overWater, tuckedPin) {
    // Base dispersion from distance
    let dispersionFeet;
    if (distanceYards <= 100) {
        dispersionFeet = BASE_DISPERSION[100];
    } else if (distanceYards <= 150) {
        const t = (distanceYards - 100) / 50;
        dispersionFeet = BASE_DISPERSION[100] + t * (BASE_DISPERSION[150] - BASE_DISPERSION[100]);
    } else if (distanceYards <= 200) {
        const t = (distanceYards - 150) / 50;
        dispersionFeet = BASE_DISPERSION[150] + t * (BASE_DISPERSION[200] - BASE_DISPERSION[150]);
    } else if (distanceYards <= 250) {
        const t = (distanceYards - 200) / 50;
        dispersionFeet = BASE_DISPERSION[200] + t * (BASE_DISPERSION[250] - BASE_DISPERSION[200]);
    } else {
        const t = (distanceYards - 250) / 50;
        dispersionFeet = BASE_DISPERSION[250] + t * (BASE_DISPERSION[300] - BASE_DISPERSION[250]);
    }

    // Terrain modifiers
    if (fromTerrain === TERRAIN.ROUGH) dispersionFeet *= 1.3;
    if (fromTerrain === TERRAIN.DEEP_ROUGH) dispersionFeet *= 1.6;
    if (fromTerrain === TERRAIN.BUNKER) dispersionFeet *= 1.5;

    // Hazard modifiers
    if (hasTreesInPath) dispersionFeet *= 1.4;
    if (overWater) dispersionFeet *= 1.2;
    if (tuckedPin) dispersionFeet *= 1.25;

    // Player skill modifiers (1-10 scale, 5 is average)
    let skillMod = 1.0;
    if (shotType === 'tee') {
        skillMod = 1.0 + (5 - player.drivingAccuracy) * 0.08;
    } else if (fromTerrain === TERRAIN.BUNKER || fromTerrain === TERRAIN.ROUGH || fromTerrain === TERRAIN.DEEP_ROUGH) {
        skillMod = 1.0 + (5 - player.shortGame) * 0.08;
    } else {
        skillMod = 1.0 + (5 - player.approachAccuracy) * 0.08;
    }

    // Nerves affect hazard situations
    if ((overWater || tuckedPin) && player.nerves < 5) {
        skillMod *= 1.0 + (5 - player.nerves) * 0.05;
    }

    // Shot shaping helps with trees
    if (hasTreesInPath && player.shotShaping > 5) {
        dispersionFeet *= 1.0 - (player.shotShaping - 5) * 0.05;
    }

    dispersionFeet *= skillMod;

    // Convert feet to cells (1 cell = 8.4 yards = 25.2 feet)
    const dispersionCells = dispersionFeet / 25.2;

    return dispersionCells;
}

// Check if trees are in shot path
function hasTreesInPath(from, to) {
    const steps = Math.max(Math.abs(to.row - from.row), Math.abs(to.col - from.col));
    if (steps === 0) return false;

    for (let i = 1; i < steps; i++) {
        const checkRow = Math.round(from.row + (to.row - from.row) * i / steps);
        const checkCol = Math.round(from.col + (to.col - from.col) * i / steps);

        if (checkRow >= 0 && checkRow < ROWS && checkCol >= 0 && checkCol < COLS) {
            if (gameState.courseGrid[checkRow][checkCol] === TERRAIN.TREES) {
                return true;
            }
        }
    }
    return false;
}

// Check if shot goes over water
function hasWaterInPath(from, to) {
    const steps = Math.max(Math.abs(to.row - from.row), Math.abs(to.col - from.col));
    if (steps === 0) return false;

    for (let i = 1; i < steps; i++) {
        const checkRow = Math.round(from.row + (to.row - from.row) * i / steps);
        const checkCol = Math.round(from.col + (to.col - from.col) * i / steps);

        if (checkRow >= 0 && checkRow < ROWS && checkCol >= 0 && checkCol < COLS) {
            if (gameState.courseGrid[checkRow][checkCol] === TERRAIN.WATER) {
                return true;
            }
        }
    }
    return false;
}

// Check if targeting near hazard (tucked pin)
function isTuckedPin(targetPos) {
    const pin = PIN_POSITIONS[gameState.pinIndex];
    const pinDist = cellDistance(targetPos, { row: pin.row, col: pin.col });

    if (pinDist > 3) return false;

    // Check for hazards near pin
    for (let r = pin.row - 2; r <= pin.row + 2; r++) {
        for (let c = pin.col - 2; c <= pin.col + 2; c++) {
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                const terrain = gameState.courseGrid[r][c];
                if (terrain === TERRAIN.WATER || terrain === TERRAIN.BUNKER) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Execute a shot with dispersion
function executeShot(shot, shotIndex) {
    const player = gameState.player;
    const fromTerrain = gameState.courseGrid[shot.from.row][shot.from.col];
    const distanceYards = cellsToYards(cellDistance(shot.from, shot.target));

    const shotType = fromTerrain === TERRAIN.TEE ? 'tee' : 'approach';
    const treesInPath = hasTreesInPath(shot.from, shot.target);
    const waterInPath = hasWaterInPath(shot.from, shot.target);
    const tuckedPin = isTuckedPin(shot.target);

    // Get dispersion
    const dispersion = getDispersion(distanceYards, fromTerrain, player, shotType, treesInPath, waterInPath, tuckedPin);

    // Random landing within dispersion (weighted toward center)
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random();
    const distance = dispersion * Math.sqrt(r); // Square root for center-weighted

    let landRow = shot.target.row + Math.sin(angle) * distance;
    let landCol = shot.target.col + Math.cos(angle) * distance;

    // Check for tree hit
    let hitTree = false;
    if (treesInPath && Math.random() < 0.3) {
        hitTree = true;
        // Ball drops short in rough
        const midRow = (shot.from.row + shot.target.row) / 2;
        const midCol = (shot.from.col + shot.target.col) / 2;
        landRow = midRow + (Math.random() - 0.5) * 4;
        landCol = midCol + (Math.random() - 0.5) * 4;
    }

    // Clamp to valid positions
    landRow = Math.max(0, Math.min(ROWS - 1, Math.round(landRow)));
    landCol = Math.max(0, Math.min(COLS - 1, Math.round(landCol)));

    // Check landing terrain
    let landTerrain = gameState.courseGrid[landRow][landCol];
    let inWater = false;

    // If landed in water, find drop spot
    if (landTerrain === TERRAIN.WATER) {
        inWater = true;
        const safeSpot = findNearestSafe(landRow, landCol);
        landRow = safeSpot.row;
        landCol = safeSpot.col;
        landTerrain = gameState.courseGrid[landRow][landCol];
    }

    // If landed in trees, find nearest rough
    if (landTerrain === TERRAIN.TREES) {
        hitTree = true;
        const safeSpot = findNearestSafe(landRow, landCol);
        landRow = safeSpot.row;
        landCol = safeSpot.col;
        landTerrain = gameState.courseGrid[landRow][landCol];
    }

    // Determine quality
    const actualDispersion = cellDistance(shot.target, { row: landRow, col: landCol });
    let quality = 'good';
    if (actualDispersion > dispersion * 0.7 || hitTree || inWater) {
        quality = 'bad';
    } else if (actualDispersion > dispersion * 0.3) {
        quality = 'ok';
    }

    return {
        from: shot.from,
        target: shot.target,
        landingPos: { row: landRow, col: landCol },
        landTerrain,
        distanceYards,
        actualDispersion: cellsToYards(actualDispersion),
        expectedDispersion: cellsToYards(dispersion),
        quality,
        hitTree,
        inWater,
        treesInPath,
        waterInPath
    };
}

function findNearestSafe(row, col) {
    for (let radius = 1; radius < 10; radius++) {
        for (let r = row - radius; r <= row + radius; r++) {
            for (let c = col - radius; c <= col + radius; c++) {
                if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                    const terrain = gameState.courseGrid[r][c];
                    if (terrain !== TERRAIN.WATER && terrain !== TERRAIN.TREES) {
                        return { row: r, col: c };
                    }
                }
            }
        }
    }
    return { row, col };
}

// Reveal cells around a landing spot
function revealAround(row, col) {
    let newReveals = 0;
    for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                const key = `${r},${c}`;
                if (!gameState.revealedCells.has(key)) {
                    gameState.revealedCells.add(key);
                    newReveals++;

                    // Check for hazard discovery
                    const terrain = gameState.courseGrid[r][c];
                    if (terrain === TERRAIN.WATER || terrain === TERRAIN.BUNKER) {
                        gameState.hazardsFound++;
                    }
                }
            }
        }
    }
    return newReveals;
}

// Calculate putting result
function calculatePutting(ballPos) {
    const player = gameState.player;
    const pin = PIN_POSITIONS[gameState.pinIndex];
    const distanceCells = cellDistance(ballPos, { row: pin.row, col: pin.col });
    const distanceFeet = cellsToYards(distanceCells) * 3;

    // Get slope at ball position
    const slope = gameState.slopeGrid[ballPos.row][ballPos.col];
    const slopeInfo = SLOPES[slope] || SLOPES.FLAT;

    // Determine if uphill or downhill to pin
    const toPin = {
        row: pin.row - ballPos.row,
        col: pin.col - ballPos.col
    };

    let isDownhill = false;
    let hasSideBreak = false;

    if (slopeInfo.dy > 0 && toPin.row > 0) isDownhill = true;
    if (slopeInfo.dy < 0 && toPin.row < 0) isDownhill = true;
    if (slopeInfo.dx !== 0) hasSideBreak = true;

    // Base probabilities
    let prob1Putt, prob2Putt, prob3Putt;

    if (distanceFeet <= 5) {
        prob1Putt = 95;
        prob2Putt = 5;
        prob3Putt = 0;
    } else if (distanceFeet <= 10) {
        prob1Putt = 50;
        prob2Putt = 48;
        prob3Putt = 2;
    } else if (distanceFeet <= 20) {
        prob1Putt = 20;
        prob2Putt = 75;
        prob3Putt = 5;
    } else if (distanceFeet <= 40) {
        prob1Putt = 5;
        prob2Putt = 80;
        prob3Putt = 15;
    } else {
        prob1Putt = 2;
        prob2Putt = 70;
        prob3Putt = 28;
    }

    // Slope modifiers
    if (isDownhill) {
        prob1Putt *= 0.7;
        prob3Putt *= 1.5;
    }
    if (hasSideBreak) {
        prob1Putt *= 0.8;
        prob3Putt *= 1.3;
    }

    // Player skill modifiers
    if (distanceFeet <= 10) {
        // Short putting skill
        const shortMod = (player.puttingShort - 5) * 0.05;
        prob1Putt *= (1 + shortMod);
    } else {
        // Long putting skill
        const longMod = (player.puttingLong - 5) * 0.04;
        prob1Putt *= (1 + longMod);
        prob3Putt *= (1 - longMod * 0.5);
    }

    // Normalize
    const total = prob1Putt + prob2Putt + prob3Putt;
    prob1Putt = prob1Putt / total * 100;
    prob2Putt = prob2Putt / total * 100;
    prob3Putt = prob3Putt / total * 100;

    // Roll for result
    const roll = Math.random() * 100;
    let putts;
    if (roll < prob1Putt) {
        putts = 1;
    } else if (roll < prob1Putt + prob2Putt) {
        putts = 2;
    } else {
        putts = 3;
    }

    return {
        putts,
        distanceFeet: Math.round(distanceFeet),
        isDownhill,
        hasSideBreak,
        slope: slopeInfo.name
    };
}

// Generate observation text
function generateObservation(shotResult, puttResult = null) {
    const observations = [];
    const player = gameState.player;

    if (shotResult) {
        const distance = shotResult.distanceYards;
        const dispersionPct = shotResult.actualDispersion / shotResult.expectedDispersion;

        if (shotResult.hitTree) {
            observations.push({
                text: `Hit a tree! Ball kicked into the ${shotResult.landTerrain}.`,
                type: 'negative'
            });
        } else if (shotResult.inWater) {
            observations.push({
                text: `Splash! Found the water. Drop with penalty.`,
                type: 'negative'
            });
        } else if (dispersionPct < 0.3 && distance > 150) {
            // Great shot
            const terrain = shotResult.landTerrain === TERRAIN.GREEN ? 'green' : shotResult.landTerrain;
            observations.push({
                text: `Nailed it! ${distance} yards to ${Math.round(shotResult.actualDispersion * 3)} feet.`,
                type: 'positive'
            });

            // Infer skill
            if (shotResult.from && gameState.courseGrid[shotResult.from.row][shotResult.from.col] === TERRAIN.TEE) {
                if (player.drivingAccuracy >= 7) {
                    observations.push({ text: `Driving accuracy looks solid.`, type: 'neutral' });
                }
            } else if (player.approachAccuracy >= 7) {
                observations.push({ text: `Approach game is dialed in.`, type: 'neutral' });
            }
        } else if (dispersionPct > 1.5) {
            // Poor shot
            observations.push({
                text: `Pushed it ${Math.round(shotResult.actualDispersion * 3)} feet off target.`,
                type: 'negative'
            });

            if (shotResult.waterInPath && player.nerves < 5) {
                observations.push({ text: `Seemed nervous over the water.`, type: 'negative' });
            }
        } else if (shotResult.landTerrain === TERRAIN.BUNKER) {
            observations.push({
                text: `Found the bunker. Will need a good escape.`,
                type: 'negative'
            });
        } else if (shotResult.landTerrain === TERRAIN.GREEN && distance > 150) {
            observations.push({
                text: `On the green from ${distance} yards.`,
                type: 'positive'
            });
        }
    }

    if (puttResult) {
        if (puttResult.putts === 1 && puttResult.distanceFeet > 15) {
            observations.push({
                text: `Drained it from ${puttResult.distanceFeet} feet!`,
                type: 'positive'
            });
            if (player.puttingLong >= 7) {
                observations.push({ text: `Has a good touch on long putts.`, type: 'neutral' });
            }
        } else if (puttResult.putts === 1 && puttResult.distanceFeet > 5) {
            observations.push({
                text: `Made the ${puttResult.distanceFeet}-footer.`,
                type: 'positive'
            });
        } else if (puttResult.putts === 3) {
            observations.push({
                text: `Three-putt from ${puttResult.distanceFeet} feet.`,
                type: 'negative'
            });
            if (puttResult.isDownhill) {
                observations.push({ text: `Struggled with the downhill speed.`, type: 'negative' });
            }
            if (puttResult.hasSideBreak) {
                observations.push({ text: `Misread the break.`, type: 'negative' });
            }
            if (player.puttingLong < 5 && puttResult.distanceFeet > 20) {
                observations.push({ text: `Long putting looks like a weakness.`, type: 'negative' });
            }
        } else if (puttResult.putts === 2 && puttResult.distanceFeet <= 8) {
            observations.push({
                text: `Missed from ${puttResult.distanceFeet} feet, made the comebacker.`,
                type: 'neutral'
            });
            if (player.puttingShort < 5) {
                observations.push({ text: `Short putting seems shaky.`, type: 'negative' });
            }
        } else if (puttResult.putts === 2) {
            observations.push({
                text: `Good lag, two-putt from ${puttResult.distanceFeet} feet.`,
                type: 'neutral'
            });
        }
    }

    return observations;
}

// Sound system using Web Audio API
function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    switch (type) {
        case 'click':
            playSoftClick(now);
            break;
        case 'execute':
            playWhoosh(now);
            break;
        case 'flight':
            playFlightSound(now);
            break;
        case 'fairway':
            playLandSound(now, 400, 0.15);
            break;
        case 'rough':
            playLandSound(now, 200, 0.1);
            break;
        case 'bunker':
            playSandSound(now);
            break;
        case 'water':
            playSplashSound(now);
            break;
        case 'tree':
            playTreeHitSound(now);
            break;
        case 'green':
            playGreenLandSound(now);
            break;
        case 'putt_roll':
            playPuttRoll(now);
            break;
        case 'putt_made':
            playPuttMade(now);
            break;
        case 'putt_long_made':
            playPuttLongMade(now);
            break;
        case 'birdie':
            playBirdieSound(now);
            break;
        case 'bogey':
            playBogeySound(now);
            break;
        case 'reveal':
            playRevealSound(now);
            break;
    }
}

function playSoftClick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.05);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.05);
}

function playWhoosh(time) {
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);
    filter.frequency.exponentialRampToValueAtTime(3000, time + 0.15);
    filter.frequency.exponentialRampToValueAtTime(500, time + 0.3);
    filter.Q.value = 1;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gain.gain.linearRampToValueAtTime(0, time + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(time);
}

function playFlightSound(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(300, time);
    osc.frequency.linearRampToValueAtTime(600, time + 0.4);
    osc.frequency.linearRampToValueAtTime(200, time + 1.0);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.1);
    gain.gain.linearRampToValueAtTime(0.03, time + 0.6);
    gain.gain.linearRampToValueAtTime(0, time + 1.0);

    osc.start(time);
    osc.stop(time + 1.0);
}

function playLandSound(time, freq, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    osc.start(time);
    osc.stop(time + 0.15);
}

function playSandSound(time) {
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1);
    }
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(time);
}

function playSplashSound(time) {
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1);
    }
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + 0.5);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(time);
}

function playTreeHitSound(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    osc.start(time);
    osc.stop(time + 0.15);
}

function playGreenLandSound(time) {
    playLandSound(time, 500, 0.1);
    // Add roll sound
    setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    }, 100);
}

function playPuttRoll(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(150, time);
    gain.gain.setValueAtTime(0.02, time);
    gain.gain.linearRampToValueAtTime(0.01, time + 0.5);
    gain.gain.linearRampToValueAtTime(0, time + 1.0);
    osc.start(time);
    osc.stop(time + 1.0);
}

function playPuttMade(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.setValueAtTime(600, time + 0.05);
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.start(time);
    osc.stop(time + 0.2);
}

function playPuttLongMade(time) {
    playPuttMade(time);
    // Add crowd cheer
    setTimeout(() => {
        const noise = audioCtx.createBufferSource();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const env = Math.sin(Math.PI * i / data.length);
            data[i] = (Math.random() * 2 - 1) * env * 0.3;
        }
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.1;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(audioCtx.currentTime);
    }, 200);
}

function playBirdieSound(time) {
    // Celebratory ascending notes
    [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = [523, 659, 784, 1047][i]; // C5, E5, G5, C6
        gain.gain.setValueAtTime(0.15, time + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, time + delay + 0.3);
        osc.start(time + delay);
        osc.stop(time + delay + 0.3);
    });
}

function playBogeySound(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(400, time);
    osc.frequency.linearRampToValueAtTime(200, time + 0.5);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.start(time);
    osc.stop(time + 0.5);
}

function playRevealSound(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(2400, time + 0.1);
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    osc.start(time);
    osc.stop(time + 0.15);
}

// UI Updates
function updateUI() {
    document.getElementById('attempt-number').textContent = gameState.attempt;

    // Current score display
    const scoreDisplay = document.getElementById('current-score');
    if (gameState.strokes === 0) {
        scoreDisplay.textContent = 'E';
    } else {
        const toPar = gameState.strokes - 4;
        if (toPar === 0) scoreDisplay.textContent = 'E';
        else if (toPar > 0) scoreDisplay.textContent = `+${toPar}`;
        else scoreDisplay.textContent = toPar.toString();
    }

    document.getElementById('current-phase').textContent =
        gameState.phase.charAt(0).toUpperCase() + gameState.phase.slice(1);

    // Pin position
    const pin = PIN_POSITIONS[gameState.pinIndex];
    document.getElementById('pin-description').textContent = pin.desc;

    // Player name
    if (gameState.player) {
        document.getElementById('player-name').textContent = gameState.player.name;
    }

    // Update buttons
    const hasShots = gameState.plannedShots.length > 0;
    const reachedGreen = hasShots &&
        gameState.courseGrid[gameState.plannedShots[gameState.plannedShots.length - 1].target.row]
            [gameState.plannedShots[gameState.plannedShots.length - 1].target.col] === TERRAIN.GREEN;

    document.getElementById('undo-btn').disabled = !hasShots || gameState.phase !== 'planning';
    document.getElementById('clear-btn').disabled = !hasShots || gameState.phase !== 'planning';
    document.getElementById('execute-btn').disabled = !reachedGreen || gameState.phase !== 'planning';

    // Update shot list
    updateShotsList();

    // Update observations
    updateObservations();

    // Update course knowledge
    const totalCells = COLS * ROWS;
    const revealedPct = Math.round(gameState.revealedCells.size / totalCells * 100);
    document.getElementById('revealed-pct').textContent = revealedPct + '%';
    document.getElementById('hazards-found').textContent = gameState.hazardsFound;
}

function updateShotsList() {
    const list = document.getElementById('shots-list');

    if (gameState.plannedShots.length === 0) {
        list.innerHTML = '<p class="muted">Click on the course to set targets</p>';
        return;
    }

    list.innerHTML = '';
    gameState.plannedShots.forEach((shot, index) => {
        const div = document.createElement('div');
        const distYards = cellsToYards(cellDistance(shot.from, shot.target));
        const targetTerrain = gameState.courseGrid[shot.target.row][shot.target.col];
        const treesInPath = hasTreesInPath(shot.from, shot.target);
        const waterInPath = hasWaterInPath(shot.from, shot.target);

        let warning = '';
        if (treesInPath) warning = 'warning';
        if (waterInPath) warning = 'danger';

        div.className = `shot-item ${warning}`;
        div.innerHTML = `
            <div class="shot-num">Shot ${index + 1}</div>
            <div class="shot-info">
                ${distYards} yards → ${targetTerrain}
                ${treesInPath ? ' (trees!)' : ''}
                ${waterInPath ? ' (over water!)' : ''}
            </div>
        `;
        list.appendChild(div);
    });
}

function updateObservations() {
    const list = document.getElementById('observations-list');

    if (gameState.observations.length === 0) {
        list.innerHTML = '<p class="muted">Notes will appear as you observe your player</p>';
        return;
    }

    list.innerHTML = '';
    // Show most recent first
    const recent = [...gameState.observations].reverse().slice(0, 15);
    recent.forEach(obs => {
        const div = document.createElement('div');
        div.className = `observation-item ${obs.type}`;
        div.innerHTML = `
            ${obs.text}
            <div class="obs-attempt">Attempt ${obs.attempt}</div>
        `;
        list.appendChild(div);
    });
}

function updateShotDetails(row, col) {
    const details = document.getElementById('shot-details');

    if (row === null || col === null) {
        details.innerHTML = '<p class="muted">Hover over course to see distances</p>';
        return;
    }

    const fromPos = gameState.plannedShots.length > 0
        ? gameState.plannedShots[gameState.plannedShots.length - 1].target
        : gameState.ballPos;

    const fromTerrain = gameState.courseGrid[fromPos.row][fromPos.col];
    const targetTerrain = gameState.courseGrid[row][col];
    const distYards = cellsToYards(cellDistance(fromPos, { row, col }));
    const maxDist = getMaxDistance(fromTerrain);

    const treesInPath = hasTreesInPath(fromPos, { row, col });
    const waterInPath = hasWaterInPath(fromPos, { row, col });

    let distClass = 'distance-ok';
    if (distYards > maxDist) {
        distClass = 'distance-danger';
    } else if (distYards > maxDist * 0.85) {
        distClass = 'distance-warning';
    }

    const isRevealed = gameState.revealedCells.has(`${row},${col}`);
    const terrainDisplay = isRevealed ? targetTerrain : 'unknown';

    let html = `
        <p><span class="${distClass}">${distYards} yards</span> (max: ${maxDist})</p>
        <p>Target: ${terrainDisplay}</p>
        <p>From: ${fromTerrain}</p>
    `;

    if (distYards > maxDist) {
        html += `<p class="distance-danger">Too far!</p>`;
    }
    if (treesInPath) {
        html += `<p class="distance-warning">Trees in path!</p>`;
    }
    if (waterInPath) {
        html += `<p class="distance-danger">Over water!</p>`;
    }

    details.innerHTML = html;
}

// Event handlers
function setupEventListeners() {
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasHover);
    canvas.addEventListener('mouseleave', () => {
        gameState.hoverPos = null;
        updateShotDetails(null, null);
        render();
    });

    document.getElementById('undo-btn').addEventListener('click', undoLastShot);
    document.getElementById('clear-btn').addEventListener('click', clearAllShots);
    document.getElementById('execute-btn').addEventListener('click', executePlan);
    document.getElementById('try-again-btn').addEventListener('click', startNewAttempt);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);

    // Initialize audio on first interaction
    document.addEventListener('click', () => {
        if (!audioCtx) initAudio();
    }, { once: true });
}

function handleCanvasClick(e) {
    if (gameState.phase !== 'planning') return;
    if (!audioCtx) initAudio();

    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    // Can't target trees
    const targetTerrain = gameState.courseGrid[row][col];
    if (targetTerrain === TERRAIN.TREES) return;

    // Check distance
    const fromPos = gameState.plannedShots.length > 0
        ? gameState.plannedShots[gameState.plannedShots.length - 1].target
        : gameState.ballPos;

    const fromTerrain = gameState.courseGrid[fromPos.row][fromPos.col];
    const distYards = cellsToYards(cellDistance(fromPos, { row, col }));
    const maxDist = getMaxDistance(fromTerrain);

    if (distYards > maxDist) return;

    // Max 4 shots before reaching green
    if (gameState.plannedShots.length >= 4 && targetTerrain !== TERRAIN.GREEN) return;

    playSound('click');

    // Add shot
    gameState.plannedShots.push({
        from: { ...fromPos },
        target: { row, col }
    });

    updateUI();
    render();
}

function handleCanvasHover(e) {
    if (gameState.phase !== 'planning') return;

    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        gameState.hoverPos = { row, col };
        updateShotDetails(row, col);
    }

    render();
}

function undoLastShot() {
    if (gameState.plannedShots.length > 0) {
        gameState.plannedShots.pop();
        playSound('click');
        updateUI();
        render();
    }
}

function clearAllShots() {
    gameState.plannedShots = [];
    playSound('click');
    updateUI();
    render();
}

async function executePlan() {
    if (gameState.plannedShots.length === 0) return;

    gameState.phase = 'executing';
    gameState.roundObservations = [];
    updateUI();

    playSound('execute');

    const overlay = document.getElementById('execution-overlay');
    const log = document.getElementById('execution-log');
    const action = document.getElementById('current-action');
    overlay.classList.remove('hidden');
    log.innerHTML = '';

    const ball = document.getElementById('ball');
    ball.classList.remove('hidden');

    // Execute each shot
    for (let i = 0; i < gameState.plannedShots.length; i++) {
        const shot = gameState.plannedShots[i];
        gameState.strokes++;
        updateUI();

        action.textContent = `Shot ${i + 1} in flight...`;

        // Show ball flying
        ball.classList.add('flying');
        playSound('flight');

        await delay(300);

        // Execute with dispersion
        const result = executeShot(shot, i);
        gameState.executedShots.push(result);

        // Animate ball to landing
        gameState.ballPos = result.landingPos;
        ball.style.left = (result.landingPos.col * CELL_SIZE + CELL_SIZE / 2) + 'px';
        ball.style.top = (result.landingPos.row * CELL_SIZE + CELL_SIZE / 2) + 'px';

        await delay(1000);
        ball.classList.remove('flying');

        // Play landing sound
        if (result.hitTree) {
            playSound('tree');
        } else if (result.inWater) {
            playSound('water');
            gameState.strokes++; // Penalty
            updateUI();
        } else if (result.landTerrain === TERRAIN.BUNKER) {
            playSound('bunker');
        } else if (result.landTerrain === TERRAIN.GREEN) {
            playSound('green');
        } else if (result.landTerrain === TERRAIN.FAIRWAY) {
            playSound('fairway');
        } else {
            playSound('rough');
        }

        // Reveal cells
        const newReveals = revealAround(result.landingPos.row, result.landingPos.col);
        if (newReveals > 0) {
            playSound('reveal');
        }
        render();

        // Generate observations
        const observations = generateObservation(result);
        observations.forEach(obs => {
            obs.attempt = gameState.attempt;
            gameState.observations.push(obs);
            gameState.roundObservations.push(obs);
        });

        // Log entry
        const logEntry = document.createElement('div');
        const quality = result.quality === 'good' ? '' : result.quality === 'ok' ? 'miss' : 'hazard';
        logEntry.className = `log-entry ${quality}`;

        let outcomeText = `${result.distanceYards} yards → ${result.landTerrain}`;
        if (result.hitTree) outcomeText = 'Hit tree! ' + outcomeText;
        if (result.inWater) outcomeText = 'In the water! Penalty stroke.';

        logEntry.innerHTML = `
            <strong>Shot ${i + 1}:</strong> ${outcomeText}
            <div class="shot-result">
                Landed ${Math.round(result.actualDispersion * 3)} feet from target
            </div>
        `;
        log.appendChild(logEntry);

        updateObservations();

        await delay(800);

        // Stop if in water (need to re-plan from drop)
        if (result.inWater) {
            // For simplicity, continue from drop spot
        }

        // If on green, stop shots and putt
        if (result.landTerrain === TERRAIN.GREEN) {
            break;
        }
    }

    // Putting
    if (gameState.courseGrid[gameState.ballPos.row][gameState.ballPos.col] === TERRAIN.GREEN) {
        action.textContent = 'Reading the putt...';
        await delay(1000);

        playSound('putt_roll');

        const puttResult = calculatePutting(gameState.ballPos);
        gameState.strokes += puttResult.putts;

        const puttEntry = document.createElement('div');
        puttEntry.className = 'log-entry';
        puttEntry.innerHTML = `
            <strong>Putting:</strong> ${puttResult.distanceFeet} feet, ${puttResult.slope}
            <div class="shot-result">${puttResult.putts} putt${puttResult.putts > 1 ? 's' : ''}</div>
        `;
        log.appendChild(puttEntry);

        await delay(1000);

        if (puttResult.putts === 1 && puttResult.distanceFeet > 15) {
            playSound('putt_long_made');
        } else if (puttResult.putts === 1) {
            playSound('putt_made');
        }

        // Generate putting observations
        const puttObs = generateObservation(null, puttResult);
        puttObs.forEach(obs => {
            obs.attempt = gameState.attempt;
            gameState.observations.push(obs);
            gameState.roundObservations.push(obs);
        });

        updateObservations();
        updateUI();
    } else {
        // Didn't reach green - auto chip on + 2 putts
        const extraStrokes = 3;
        gameState.strokes += extraStrokes;

        const chipEntry = document.createElement('div');
        chipEntry.className = 'log-entry miss';
        chipEntry.innerHTML = `
            <strong>Finishing:</strong> Chipped on, two putts
            <div class="shot-result">+${extraStrokes} strokes to finish</div>
        `;
        log.appendChild(chipEntry);

        updateUI();
    }

    action.textContent = '';
    await delay(500);

    // Hide execution overlay
    overlay.classList.add('hidden');
    ball.classList.add('hidden');

    // Show results
    showResults();
}

function showResults() {
    gameState.phase = 'complete';
    gameState.totalAttempts++;

    const score = gameState.strokes;
    const toPar = score - 4;
    gameState.scores.push(toPar);

    const overlay = document.getElementById('result-overlay');
    const title = document.getElementById('result-title');
    const scoreDiv = document.getElementById('result-score');
    const breakdown = document.getElementById('result-breakdown');
    const newObs = document.getElementById('new-observations');

    // Score display
    let scoreName, scoreClass;
    if (toPar <= -1) {
        scoreName = 'BIRDIE!';
        scoreClass = 'birdie';
        playSound('birdie');
    } else if (toPar === 0) {
        scoreName = 'PAR';
        scoreClass = 'par';
    } else if (toPar === 1) {
        scoreName = 'BOGEY';
        scoreClass = 'bogey';
        playSound('bogey');
    } else {
        scoreName = `+${toPar}`;
        scoreClass = 'double-bogey';
        playSound('bogey');
    }

    title.textContent = 'Hole Complete';
    scoreDiv.textContent = scoreName;
    scoreDiv.className = scoreClass;

    // Breakdown
    breakdown.innerHTML = `
        <p><strong>Total strokes:</strong> ${score}</p>
        <p><strong>Shots to green:</strong> ${gameState.executedShots.length}</p>
        <p><strong>Course revealed:</strong> ${Math.round(gameState.revealedCells.size / (COLS * ROWS) * 100)}%</p>
    `;

    // New observations
    if (gameState.roundObservations.length > 0) {
        newObs.innerHTML = `
            <h4>New Observations</h4>
            <ul>
                ${gameState.roundObservations.map(o => `<li>${o.text}</li>`).join('')}
            </ul>
        `;
    } else {
        newObs.innerHTML = '';
    }

    overlay.classList.remove('hidden');

    // Check for victory
    if (toPar <= -1) {
        setTimeout(() => {
            overlay.classList.add('hidden');
            showVictory();
        }, 2000);
    }
}

function showVictory() {
    const overlay = document.getElementById('victory-overlay');
    const stats = document.getElementById('victory-stats');
    const finalObs = document.getElementById('final-observations');
    const mapCompletion = document.getElementById('map-completion');

    const avgScore = gameState.scores.reduce((a, b) => a + b, 0) / gameState.scores.length;

    stats.innerHTML = `
        <div class="stat">Attempts: <span class="stat-value">${gameState.totalAttempts}</span></div>
        <div class="stat">Average Score: <span class="stat-value">${avgScore >= 0 ? '+' : ''}${avgScore.toFixed(1)}</span></div>
    `;

    // Compile scouting report
    finalObs.innerHTML = '';
    const uniqueObs = [...new Set(gameState.observations.map(o => o.text))];
    uniqueObs.slice(0, 10).forEach(text => {
        const div = document.createElement('div');
        div.className = 'observation-item';
        div.textContent = text;
        finalObs.appendChild(div);
    });

    mapCompletion.textContent = `${Math.round(gameState.revealedCells.size / (COLS * ROWS) * 100)}% of course discovered`;

    overlay.classList.remove('hidden');
}

function startNewAttempt() {
    gameState.attempt++;
    gameState.strokes = 0;
    gameState.phase = 'planning';
    gameState.ballPos = { row: 47, col: 10 };
    gameState.plannedShots = [];
    gameState.executedShots = [];
    gameState.roundObservations = [];

    // Randomize pin
    gameState.pinIndex = Math.floor(Math.random() * PIN_POSITIONS.length);

    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('execution-overlay').classList.add('hidden');

    updateUI();
    render();
}

function resetGame() {
    // Full reset with new player
    gameState = {
        attempt: 1,
        strokes: 0,
        phase: 'planning',
        ballPos: { row: 47, col: 10 },
        plannedShots: [],
        executedShots: [],
        pinIndex: Math.floor(Math.random() * PIN_POSITIONS.length),
        revealedCells: new Set(),
        courseGrid: [],
        slopeGrid: [],
        outlineGrid: [],
        hoverPos: null,
        observations: [],
        roundObservations: [],
        player: generatePlayer(),
        totalAttempts: 0,
        scores: [],
        hazardsFound: 0
    };

    designCourse();

    // Reveal tee area
    for (let r = 44; r < ROWS; r++) {
        for (let c = 6; c < 14; c++) {
            gameState.revealedCells.add(`${r},${c}`);
        }
    }

    document.getElementById('victory-overlay').classList.add('hidden');
    document.getElementById('result-overlay').classList.add('hidden');

    updateUI();
    render();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize game
function init() {
    gameState.player = generatePlayer();
    designCourse();
    initCanvas();
    setupEventListeners();

    // Randomize starting pin
    gameState.pinIndex = Math.floor(Math.random() * PIN_POSITIONS.length);

    // Reveal tee area initially
    for (let r = 44; r < ROWS; r++) {
        for (let c = 6; c < 14; c++) {
            gameState.revealedCells.add(`${r},${c}`);
        }
    }

    updateUI();
    render();
}

document.addEventListener('DOMContentLoaded', init);

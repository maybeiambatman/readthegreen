// Read the Green - Golf Strategy Game
// A roguelike par 4 where you learn the hole through repeated attempts

const COLS = 20;
const ROWS = 40;
const CELL_SIZE = 18;

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
    [TERRAIN.TEE]: '#f0f0f0',
    [TERRAIN.FAIRWAY]: '#90EE90',
    [TERRAIN.ROUGH]: '#228B22',
    [TERRAIN.DEEP_ROUGH]: '#006400',
    [TERRAIN.BUNKER]: '#D2B48C',
    [TERRAIN.WATER]: '#4169E1',
    [TERRAIN.GREEN]: '#32CD32',
    [TERRAIN.TREES]: '#5D4037'
};

// Slope directions (for putting and ball roll)
const SLOPES = {
    FLAT: { symbol: '', dx: 0, dy: 0 },
    N: { symbol: '↑', dx: 0, dy: -1 },
    NE: { symbol: '↗', dx: 1, dy: -1 },
    E: { symbol: '→', dx: 1, dy: 0 },
    SE: { symbol: '↘', dx: 1, dy: 1 },
    S: { symbol: '↓', dx: 0, dy: 1 },
    SW: { symbol: '↙', dx: -1, dy: 1 },
    W: { symbol: '←', dx: -1, dy: 0 },
    NW: { symbol: '↖', dx: -1, dy: -1 }
};

// Wind directions
const WIND_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WIND_STRENGTHS = ['Calm', 'Light', 'Medium', 'Strong'];

// Zone sizes
const ZONE_SIZES = {
    small: 3,
    medium: 5,
    large: 7
};

// Pin positions on the green
const PIN_POSITIONS = [
    { name: 'Front-Left', row: 5, col: 8 },
    { name: 'Front-Right', row: 5, col: 12 },
    { name: 'Center', row: 7, col: 10 },
    { name: 'Back-Left', row: 9, col: 8 },
    { name: 'Back-Right', row: 9, col: 12 }
];

// Game state
let gameState = {
    attempt: 1,
    stroke: 0,
    phase: 'planning', // 'planning', 'executing', 'putting', 'complete'
    ballPos: { row: 37, col: 10 }, // Starting position on tee
    plannedShots: [],
    executedShots: [],
    currentZoneSize: 'medium',
    wind: { direction: 'N', strength: 'Calm' },
    pinIndex: 2, // Default center pin
    revealedSlopes: new Set(), // Cells where slope has been revealed
    revealedGreenBreak: new Set(), // Green cells where break is known
    courseGrid: [],
    slopeGrid: [],
    hoverZone: null,
    totalAttempts: 0,
    scores: []
};

// Course design - create the hole layout
function designCourse() {
    // Initialize grids
    gameState.courseGrid = [];
    gameState.slopeGrid = [];

    for (let row = 0; row < ROWS; row++) {
        gameState.courseGrid[row] = [];
        gameState.slopeGrid[row] = [];
        for (let col = 0; col < COLS; col++) {
            gameState.courseGrid[row][col] = TERRAIN.ROUGH; // Default rough
            gameState.slopeGrid[row][col] = 'FLAT';
        }
    }

    // Design the hole - a slight dogleg right par 4

    // Tee box (rows 35-38, cols 8-12)
    fillRect(35, 8, 4, 5, TERRAIN.TEE);

    // Starting fairway section (rows 30-35, cols 7-13)
    fillRect(30, 7, 6, 7, TERRAIN.FAIRWAY);

    // Water hazard on left side (rows 24-30, cols 3-7)
    fillRect(24, 3, 7, 5, TERRAIN.WATER);

    // Main fairway bending right (rows 20-30, cols 8-14)
    fillRect(20, 8, 11, 7, TERRAIN.FAIRWAY);

    // Second fairway section bending more right (rows 14-20, cols 10-16)
    fillRect(14, 10, 7, 7, TERRAIN.FAIRWAY);

    // Fairway bunker on left (rows 22-24, cols 7-9) - guards layup
    fillRect(22, 7, 3, 3, TERRAIN.BUNKER);

    // Approach fairway (rows 10-14, cols 8-14)
    fillRect(10, 8, 5, 7, TERRAIN.FAIRWAY);

    // Green (rows 3-11, cols 6-14) - large green
    fillRect(3, 6, 9, 9, TERRAIN.GREEN);

    // Greenside bunker front-right (rows 10-12, cols 14-16)
    fillRect(10, 14, 3, 3, TERRAIN.BUNKER);

    // Greenside bunker back-left (rows 2-4, cols 4-6)
    fillRect(2, 4, 3, 3, TERRAIN.BUNKER);

    // Trees on right side creating risk-reward (rows 16-26, cols 15-19)
    fillRect(16, 16, 11, 4, TERRAIN.TREES);

    // Trees on left behind water (rows 20-28, cols 0-3)
    fillRect(20, 0, 9, 4, TERRAIN.TREES);

    // More trees around green (strategic placement)
    fillRect(0, 0, 5, 6, TERRAIN.TREES);
    fillRect(0, 15, 5, 5, TERRAIN.TREES);

    // Deep rough patches
    fillRect(28, 14, 4, 3, TERRAIN.DEEP_ROUGH);
    fillRect(12, 15, 4, 3, TERRAIN.DEEP_ROUGH);
    fillRect(6, 3, 4, 3, TERRAIN.DEEP_ROUGH);

    // Add slopes to the course (hidden initially)
    // Slopes on fairway
    setSlopeArea(25, 8, 5, 4, 'SE'); // Fairway slopes toward water
    setSlopeArea(18, 10, 4, 4, 'N'); // Uphill toward green

    // Green slopes (for putting)
    setSlopeArea(3, 6, 3, 4, 'SE'); // Back left slopes to center
    setSlopeArea(3, 10, 3, 4, 'SW'); // Back right slopes to center
    setSlopeArea(8, 6, 3, 4, 'NE'); // Front left slopes up
    setSlopeArea(8, 10, 3, 4, 'NW'); // Front right slopes up
    setSlopeArea(5, 8, 4, 4, 'FLAT'); // Center relatively flat
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

    // Draw terrain
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const terrain = gameState.courseGrid[row][col];
            ctx.fillStyle = TERRAIN_COLORS[terrain];
            ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

            // Draw grid lines (subtle)
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

            // Draw revealed slopes
            const cellKey = `${row},${col}`;
            if (gameState.revealedSlopes.has(cellKey)) {
                const slope = gameState.slopeGrid[row][col];
                if (slope !== 'FLAT') {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        SLOPES[slope].symbol,
                        col * CELL_SIZE + CELL_SIZE / 2,
                        row * CELL_SIZE + CELL_SIZE / 2
                    );
                }
            }
        }
    }

    // Draw pin (flag)
    const pin = PIN_POSITIONS[gameState.pinIndex];
    drawFlag(pin.col, pin.row);

    // Draw planned zones
    gameState.plannedShots.forEach((shot, index) => {
        drawZone(shot.targetRow, shot.targetCol, shot.zoneSize, index + 1, 'planned');
    });

    // Draw hover zone preview
    if (gameState.hoverZone && gameState.phase === 'planning') {
        drawZone(
            gameState.hoverZone.row,
            gameState.hoverZone.col,
            gameState.currentZoneSize,
            gameState.plannedShots.length + 1,
            'preview'
        );
    }

    // Draw trajectory lines
    let fromPos = { ...gameState.ballPos };
    gameState.plannedShots.forEach((shot) => {
        drawTrajectory(fromPos, { row: shot.targetRow, col: shot.targetCol });
        fromPos = { row: shot.targetRow, col: shot.targetCol };
    });

    // Draw executed shot landing spots
    gameState.executedShots.forEach((shot, index) => {
        drawLandingSpot(shot.actualRow, shot.actualCol, shot.success);
    });

    // Update ball position
    updateBallDisplay();
}

function drawFlag(col, row) {
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;

    // Hole
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Pole
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 15);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flag
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x + 10, y - 12);
    ctx.lineTo(x, y - 9);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
}

function drawZone(row, col, size, number, type) {
    const zonePixels = ZONE_SIZES[size] * CELL_SIZE;
    const halfZone = Math.floor(ZONE_SIZES[size] / 2);
    const x = (col - halfZone) * CELL_SIZE;
    const y = (row - halfZone) * CELL_SIZE;

    if (type === 'preview') {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
        ctx.fillStyle = 'rgba(74, 222, 128, 0.15)';
        ctx.setLineDash([5, 5]);
    } else {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
        ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
        ctx.setLineDash([]);
    }

    ctx.lineWidth = 2;
    ctx.fillRect(x, y, zonePixels, zonePixels);
    ctx.strokeRect(x, y, zonePixels, zonePixels);
    ctx.setLineDash([]);

    // Draw number
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2);
}

function drawTrajectory(from, to) {
    const x1 = from.col * CELL_SIZE + CELL_SIZE / 2;
    const y1 = from.row * CELL_SIZE + CELL_SIZE / 2;
    const x2 = to.col * CELL_SIZE + CELL_SIZE / 2;
    const y2 = to.row * CELL_SIZE + CELL_SIZE / 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawLandingSpot(row, col, success) {
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = success ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function updateBallDisplay() {
    const ball = document.getElementById('ball');
    if (gameState.phase === 'planning' && gameState.executedShots.length === 0) {
        ball.classList.add('hidden');
    } else {
        ball.classList.remove('hidden');
        ball.style.left = (gameState.ballPos.col * CELL_SIZE + CELL_SIZE / 2) + 'px';
        ball.style.top = (gameState.ballPos.row * CELL_SIZE + CELL_SIZE / 2) + 'px';
    }
}

// Probability calculations
function calculateShotProbability(fromRow, fromCol, toRow, toCol, zoneSize) {
    const distance = Math.sqrt(Math.pow(toRow - fromRow, 2) + Math.pow(toCol - fromCol, 2));
    const fromTerrain = gameState.courseGrid[fromRow][fromCol];

    // Base probability based on zone size
    let basePct = {
        small: 55,
        medium: 75,
        large: 90
    }[zoneSize];

    // Distance penalty (longer shots are harder)
    const maxDistance = 20; // Max expected shot distance in cells
    const distancePenalty = Math.min(25, (distance / maxDistance) * 25);
    basePct -= distancePenalty;

    // Terrain penalty for current lie
    const terrainPenalties = {
        [TERRAIN.TEE]: 0,
        [TERRAIN.FAIRWAY]: 0,
        [TERRAIN.ROUGH]: 10,
        [TERRAIN.DEEP_ROUGH]: 20,
        [TERRAIN.BUNKER]: 25,
        [TERRAIN.GREEN]: 5, // Chipping from green edge
        [TERRAIN.WATER]: 100, // Can't hit from water
        [TERRAIN.TREES]: 40
    };
    basePct -= terrainPenalties[fromTerrain] || 0;

    // Wind effect
    const windEffect = calculateWindEffect(fromRow, fromCol, toRow, toCol);
    basePct -= windEffect.penalty;

    // Hazard in flight path
    const hazardRisk = calculateHazardRisk(fromRow, fromCol, toRow, toCol);

    // Calculate miss distribution
    const successPct = Math.max(5, Math.min(95, basePct));
    const missPct = 100 - successPct;

    // Distribute misses
    const roughMissPct = Math.round(missPct * 0.5);
    const hazardMissPct = Math.round(missPct * hazardRisk.factor);
    const otherMissPct = missPct - roughMissPct - hazardMissPct;

    return {
        success: Math.round(successPct),
        roughMiss: roughMissPct,
        hazardMiss: hazardMissPct,
        otherMiss: Math.max(0, otherMissPct),
        distance: distance,
        windEffect: windEffect,
        hazardInPath: hazardRisk.type
    };
}

function calculateWindEffect(fromRow, fromCol, toRow, toCol) {
    const wind = gameState.wind;
    if (wind.strength === 'Calm') {
        return { penalty: 0, description: 'No wind effect' };
    }

    // Calculate shot direction
    const shotAngle = Math.atan2(toCol - fromCol, fromRow - toRow) * 180 / Math.PI;

    // Wind direction to angle
    const windAngles = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    const windAngle = windAngles[wind.direction];

    // Calculate relative angle
    let relativeAngle = Math.abs(shotAngle - windAngle);
    if (relativeAngle > 180) relativeAngle = 360 - relativeAngle;

    // Wind strength multiplier
    const strengthMult = { Light: 1, Medium: 2, Strong: 3 }[wind.strength];

    let penalty = 0;
    let description = '';

    if (relativeAngle < 45) {
        // Downwind - slightly easier
        penalty = -2 * strengthMult;
        description = 'Downwind (easier)';
    } else if (relativeAngle > 135) {
        // Into wind - harder
        penalty = 5 * strengthMult;
        description = 'Into wind (harder)';
    } else {
        // Crosswind - moderate penalty, affects accuracy
        penalty = 3 * strengthMult;
        description = 'Crosswind (pushes ball)';
    }

    return { penalty, description };
}

function calculateHazardRisk(fromRow, fromCol, toRow, toCol) {
    // Check for hazards along flight path
    const steps = Math.max(Math.abs(toRow - fromRow), Math.abs(toCol - fromCol));
    let waterRisk = 0;
    let bunkerRisk = 0;

    for (let i = 1; i < steps; i++) {
        const checkRow = Math.round(fromRow + (toRow - fromRow) * i / steps);
        const checkCol = Math.round(fromCol + (toCol - fromCol) * i / steps);

        if (checkRow >= 0 && checkRow < ROWS && checkCol >= 0 && checkCol < COLS) {
            const terrain = gameState.courseGrid[checkRow][checkCol];
            if (terrain === TERRAIN.WATER) waterRisk = Math.max(waterRisk, 0.3);
            if (terrain === TERRAIN.BUNKER) bunkerRisk = Math.max(bunkerRisk, 0.15);
        }
    }

    if (waterRisk > 0) return { factor: waterRisk, type: 'water' };
    if (bunkerRisk > 0) return { factor: bunkerRisk, type: 'bunker' };
    return { factor: 0, type: null };
}

// Shot execution
function executeShot(shot) {
    const prob = shot.probability;
    const roll = Math.random() * 100;

    let actualRow = shot.targetRow;
    let actualCol = shot.targetCol;
    let success = true;
    let outcome = 'success';

    if (roll > prob.success) {
        success = false;
        // Determine miss type
        const missRoll = Math.random() * 100;
        const halfZone = Math.floor(ZONE_SIZES[shot.zoneSize] / 2);

        if (missRoll < prob.hazardMiss && prob.hazardInPath) {
            // Hit hazard
            outcome = prob.hazardInPath;
            // Find nearest hazard cell
            const hazardPos = findNearestHazard(shot.targetRow, shot.targetCol, prob.hazardInPath);
            actualRow = hazardPos.row;
            actualCol = hazardPos.col;
        } else {
            // Miss to rough/other
            outcome = 'rough';
            // Random offset outside zone
            const angle = Math.random() * Math.PI * 2;
            const distance = halfZone + 1 + Math.random() * 3;
            actualRow = Math.round(shot.targetRow + Math.sin(angle) * distance);
            actualCol = Math.round(shot.targetCol + Math.cos(angle) * distance);
        }

        // Apply wind push on misses
        if (gameState.wind.strength !== 'Calm' && prob.windEffect.description.includes('Crosswind')) {
            const windAngles = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
            const windAngle = windAngles[gameState.wind.direction] * Math.PI / 180;
            const push = { Light: 1, Medium: 2, Strong: 3 }[gameState.wind.strength];
            actualCol += Math.round(Math.sin(windAngle) * push);
            actualRow -= Math.round(Math.cos(windAngle) * push);
        }
    }

    // Clamp to valid positions
    actualRow = Math.max(0, Math.min(ROWS - 1, actualRow));
    actualCol = Math.max(0, Math.min(COLS - 1, actualCol));

    // Check if landed in water - add penalty stroke and place nearby
    const landedTerrain = gameState.courseGrid[actualRow][actualCol];
    if (landedTerrain === TERRAIN.WATER) {
        outcome = 'water';
        // Find nearest non-water cell
        const safePos = findNearestSafe(actualRow, actualCol);
        actualRow = safePos.row;
        actualCol = safePos.col;
    }

    return {
        ...shot,
        actualRow,
        actualCol,
        success,
        outcome,
        roll: Math.round(roll),
        needed: prob.success,
        terrain: gameState.courseGrid[actualRow][actualCol]
    };
}

function findNearestHazard(row, col, hazardType) {
    const terrain = hazardType === 'water' ? TERRAIN.WATER : TERRAIN.BUNKER;
    let nearest = { row, col, dist: Infinity };

    for (let r = Math.max(0, row - 10); r < Math.min(ROWS, row + 10); r++) {
        for (let c = Math.max(0, col - 10); c < Math.min(COLS, col + 10); c++) {
            if (gameState.courseGrid[r][c] === terrain) {
                const dist = Math.sqrt(Math.pow(r - row, 2) + Math.pow(c - col, 2));
                if (dist < nearest.dist) {
                    nearest = { row: r, col: c, dist };
                }
            }
        }
    }

    return nearest;
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

// Putting calculation
function calculatePutts(distanceToHole) {
    // Distance in cells
    if (distanceToHole <= 1) {
        // Tap in
        return { putts: 1, description: 'Tap-in putt' };
    } else if (distanceToHole <= 3) {
        // Short putt - high make percentage
        const makeRoll = Math.random() * 100;
        if (makeRoll < 80) {
            return { putts: 1, description: 'Drained the short putt!' };
        }
        return { putts: 2, description: 'Missed the short one, tap in for 2' };
    } else if (distanceToHole <= 6) {
        // Medium putt
        const makeRoll = Math.random() * 100;
        // Check for break knowledge
        const breakKnown = checkBreakKnowledge(gameState.ballPos.row, gameState.ballPos.col);
        const makeChance = breakKnown ? 40 : 25;

        if (makeRoll < makeChance) {
            return { putts: 1, description: breakKnown ? 'Read the break perfectly!' : 'Lucky roll!' };
        }
        return { putts: 2, description: 'Good lag, easy second putt' };
    } else {
        // Long putt
        const makeRoll = Math.random() * 100;
        const breakKnown = checkBreakKnowledge(gameState.ballPos.row, gameState.ballPos.col);

        if (makeRoll < 10) {
            return { putts: 1, description: 'Bombs it from downtown!' };
        } else if (makeRoll < (breakKnown ? 75 : 60)) {
            return { putts: 2, description: 'Good speed, two-putt' };
        }
        return { putts: 3, description: breakKnown ? 'Misread the speed' : 'Didn\'t know the break, 3-putt' };
    }
}

function checkBreakKnowledge(row, col) {
    // Check if we've revealed break info in this area
    for (let r = row - 2; r <= row + 2; r++) {
        for (let c = col - 2; c <= col + 2; c++) {
            if (gameState.revealedGreenBreak.has(`${r},${c}`)) {
                return true;
            }
        }
    }
    return false;
}

// Reveal slopes when landing
function revealSlopesAround(row, col) {
    for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                gameState.revealedSlopes.add(`${r},${c}`);

                // If on green, also reveal break
                if (gameState.courseGrid[r][c] === TERRAIN.GREEN) {
                    gameState.revealedGreenBreak.add(`${r},${c}`);
                }
            }
        }
    }
}

// UI Updates
function updateUI() {
    document.getElementById('attempt-number').textContent = gameState.attempt;
    document.getElementById('current-stroke').textContent = gameState.stroke;
    document.getElementById('current-phase').textContent =
        gameState.phase.charAt(0).toUpperCase() + gameState.phase.slice(1);

    // Wind display
    const windText = gameState.wind.strength === 'Calm'
        ? 'Calm'
        : `${gameState.wind.strength} ${gameState.wind.direction}`;
    document.getElementById('wind-info').textContent = windText;

    // Wind arrow
    const windArrow = document.getElementById('wind-arrow');
    if (gameState.wind.strength === 'Calm') {
        windArrow.style.opacity = '0.3';
        windArrow.style.transform = 'rotate(0deg)';
    } else {
        windArrow.style.opacity = '1';
        const angles = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: -135 };
        windArrow.style.transform = `rotate(${angles[gameState.wind.direction]}deg)`;
    }

    // Pin position
    document.getElementById('pin-position').textContent = PIN_POSITIONS[gameState.pinIndex].name;

    // Update shot list
    updateShotsList();

    // Update buttons
    document.getElementById('undo-btn').disabled = gameState.plannedShots.length === 0;
    document.getElementById('execute-btn').disabled = gameState.plannedShots.length === 0;

    // Update revealed info panel
    updateRevealedInfo();
}

function updateShotsList() {
    const list = document.getElementById('shots-list');
    list.innerHTML = '';

    if (gameState.plannedShots.length === 0) {
        list.innerHTML = '<p class="muted">No shots planned</p>';
        return;
    }

    gameState.plannedShots.forEach((shot, index) => {
        const div = document.createElement('div');
        div.className = 'shot-item';

        const prob = shot.probability;
        div.innerHTML = `
            <div class="shot-num">Shot ${index + 1}</div>
            <div class="shot-info">
                ${shot.zoneSize} zone (${ZONE_SIZES[shot.zoneSize]}x${ZONE_SIZES[shot.zoneSize]})<br>
                Distance: ${Math.round(prob.distance)} cells<br>
                Success: ${prob.success}%
            </div>
        `;
        list.appendChild(div);
    });
}

function updateRevealedInfo() {
    const container = document.getElementById('slopes-discovered');

    if (gameState.revealedSlopes.size === 0) {
        container.innerHTML = '<p class="muted">Land on cells to reveal slopes</p>';
        return;
    }

    let html = `<p>Revealed: ${gameState.revealedSlopes.size} cells</p>`;
    if (gameState.revealedGreenBreak.size > 0) {
        html += `<p>Green break known: ${gameState.revealedGreenBreak.size} cells</p>`;
    }
    container.innerHTML = html;
}

function updateProbabilityDisplay(shot) {
    const display = document.getElementById('probability-display');
    const breakdown = document.getElementById('prob-breakdown');

    if (!shot) {
        display.classList.add('hidden');
        return;
    }

    display.classList.remove('hidden');
    const prob = shot.probability;

    let html = `
        <div class="prob-row success">
            <span>Lands in zone:</span>
            <span>${prob.success}%</span>
        </div>
        <div class="prob-row miss">
            <span>Miss to rough:</span>
            <span>${prob.roughMiss}%</span>
        </div>
    `;

    if (prob.hazardMiss > 0) {
        html += `
            <div class="prob-row hazard">
                <span>Into ${prob.hazardInPath}:</span>
                <span>${prob.hazardMiss}%</span>
            </div>
        `;
    }

    if (prob.windEffect.penalty !== 0) {
        html += `
            <div class="prob-row" style="color: ${prob.windEffect.penalty > 0 ? '#f59e0b' : '#4ade80'}">
                <span>${prob.windEffect.description}</span>
                <span>${prob.windEffect.penalty > 0 ? '+' : ''}${prob.windEffect.penalty}%</span>
            </div>
        `;
    }

    breakdown.innerHTML = html;
}

function updatePreviewPanel(row, col) {
    const content = document.getElementById('preview-content');

    if (row === null || col === null) {
        content.innerHTML = '<p>Click on the course to plan your shots</p>';
        return;
    }

    const terrain = gameState.courseGrid[row][col];
    const terrainName = terrain.charAt(0).toUpperCase() + terrain.slice(1).replace('_', ' ');

    const fromPos = gameState.plannedShots.length > 0
        ? { row: gameState.plannedShots[gameState.plannedShots.length - 1].targetRow,
            col: gameState.plannedShots[gameState.plannedShots.length - 1].targetCol }
        : gameState.ballPos;

    const distance = Math.sqrt(Math.pow(row - fromPos.row, 2) + Math.pow(col - fromPos.col, 2));

    // Check if valid target
    let valid = true;
    let warning = '';

    if (terrain === TERRAIN.TREES) {
        valid = false;
        warning = 'Cannot target trees';
    } else if (terrain === TERRAIN.WATER) {
        warning = 'Warning: Targeting water!';
    } else if (row >= fromPos.row) {
        warning = 'Shot goes backwards!';
    }

    content.innerHTML = `
        <p><strong>Target:</strong> Row ${row}, Col ${col}</p>
        <p><strong>Terrain:</strong> ${terrainName}</p>
        <p><strong>Distance:</strong> ${Math.round(distance)} cells</p>
        ${warning ? `<p style="color: #f59e0b">${warning}</p>` : ''}
    `;
}

// Event handlers
function setupEventListeners() {
    // Canvas click for shot planning
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasHover);
    canvas.addEventListener('mouseleave', () => {
        gameState.hoverZone = null;
        updatePreviewPanel(null, null);
        render();
    });

    // Zone size buttons
    document.querySelectorAll('.zone-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.currentZoneSize = btn.dataset.size;
            render();
        });
    });

    // Action buttons
    document.getElementById('undo-btn').addEventListener('click', undoLastShot);
    document.getElementById('execute-btn').addEventListener('click', executePlan);
    document.getElementById('try-again-btn').addEventListener('click', startNewAttempt);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
}

function handleCanvasClick(e) {
    if (gameState.phase !== 'planning') return;

    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    // Validate target
    const terrain = gameState.courseGrid[row][col];
    if (terrain === TERRAIN.TREES) return;

    // Get starting position for this shot
    const fromPos = gameState.plannedShots.length > 0
        ? { row: gameState.plannedShots[gameState.plannedShots.length - 1].targetRow,
            col: gameState.plannedShots[gameState.plannedShots.length - 1].targetCol }
        : gameState.ballPos;

    // Calculate probability
    const probability = calculateShotProbability(
        fromPos.row, fromPos.col,
        row, col,
        gameState.currentZoneSize
    );

    // Add shot to plan
    const shot = {
        targetRow: row,
        targetCol: col,
        zoneSize: gameState.currentZoneSize,
        probability: probability,
        fromRow: fromPos.row,
        fromCol: fromPos.col
    };

    gameState.plannedShots.push(shot);

    // Check if we've reached the green
    if (terrain === TERRAIN.GREEN) {
        // Auto-complete planning when reaching green
    }

    updateUI();
    updateProbabilityDisplay(shot);
    render();
}

function handleCanvasHover(e) {
    if (gameState.phase !== 'planning') return;

    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        gameState.hoverZone = { row, col };
        updatePreviewPanel(row, col);
    }

    render();
}

function undoLastShot() {
    if (gameState.plannedShots.length > 0) {
        gameState.plannedShots.pop();
        updateUI();
        updateProbabilityDisplay(gameState.plannedShots[gameState.plannedShots.length - 1] || null);
        render();
    }
}

async function executePlan() {
    if (gameState.plannedShots.length === 0) return;

    gameState.phase = 'executing';
    updateUI();

    const overlay = document.getElementById('execution-overlay');
    const log = document.getElementById('execution-log');
    overlay.classList.remove('hidden');
    log.innerHTML = '';

    let waterPenalties = 0;

    for (let i = 0; i < gameState.plannedShots.length; i++) {
        const shot = gameState.plannedShots[i];
        gameState.stroke++;
        updateUI();

        // Execute shot
        const result = executeShot(shot);
        gameState.executedShots.push(result);

        // Log result
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${result.success ? '' : result.outcome === 'water' ? 'hazard' : 'miss'}`;

        let outcomeText = '';
        if (result.success) {
            outcomeText = `Perfect! Landed in zone on the ${result.terrain}`;
        } else if (result.outcome === 'water') {
            outcomeText = `Splash! In the water. Drop with 1 stroke penalty.`;
            waterPenalties++;
            gameState.stroke++; // Penalty stroke
        } else if (result.outcome === 'bunker') {
            outcomeText = `Caught the bunker!`;
        } else {
            outcomeText = `Missed into the ${result.terrain}`;
        }

        logEntry.innerHTML = `
            <strong>Shot ${i + 1}:</strong> ${outcomeText}
            <div class="roll-result">
                Needed under ${result.needed}. Rolled ${result.roll}.
                ${result.success ? 'Success!' : 'Miss!'}
            </div>
        `;
        log.appendChild(logEntry);

        // Animate ball
        gameState.ballPos = { row: result.actualRow, col: result.actualCol };
        render();

        // Reveal slopes around landing spot
        revealSlopesAround(result.actualRow, result.actualCol);

        await delay(1000);

        // Check if we need to stop (hit hazard that changes position)
        if (result.outcome === 'water' || gameState.courseGrid[result.actualRow][result.actualCol] === TERRAIN.TREES) {
            // Find safe spot and continue from there
            const safePos = findNearestSafe(result.actualRow, result.actualCol);
            gameState.ballPos = safePos;
            render();
        }

        // If ball is on green, stop executing shots and putt
        if (gameState.courseGrid[gameState.ballPos.row][gameState.ballPos.col] === TERRAIN.GREEN) {
            break;
        }
    }

    // Check if on green for putting, otherwise need more shots
    const finalTerrain = gameState.courseGrid[gameState.ballPos.row][gameState.ballPos.col];

    if (finalTerrain === TERRAIN.GREEN) {
        // Calculate putting
        const pin = PIN_POSITIONS[gameState.pinIndex];
        const distToHole = Math.sqrt(
            Math.pow(gameState.ballPos.row - pin.row, 2) +
            Math.pow(gameState.ballPos.col - pin.col, 2)
        );

        const puttResult = calculatePutts(distToHole);
        gameState.stroke += puttResult.putts;

        const puttEntry = document.createElement('div');
        puttEntry.className = 'log-entry';
        puttEntry.innerHTML = `
            <strong>Putting:</strong> ${puttResult.description}
            <div class="roll-result">${puttResult.putts} putt${puttResult.putts > 1 ? 's' : ''}</div>
        `;
        log.appendChild(puttEntry);

        await delay(1000);
    } else {
        // Didn't reach green - need to estimate remaining strokes
        // This is a simplification - in full game would let player continue
        const pin = PIN_POSITIONS[gameState.pinIndex];
        const distToGreen = Math.sqrt(
            Math.pow(gameState.ballPos.row - pin.row, 2) +
            Math.pow(gameState.ballPos.col - pin.col, 2)
        );

        // Estimate strokes to finish
        const estimatedStrokes = Math.ceil(distToGreen / 8) + 2; // Rough estimate + 2 putts
        gameState.stroke += estimatedStrokes;

        const remainingEntry = document.createElement('div');
        remainingEntry.className = 'log-entry miss';
        remainingEntry.innerHTML = `
            <strong>Finishing:</strong> Ball not on green
            <div class="roll-result">Estimated ${estimatedStrokes} more strokes to hole out</div>
        `;
        log.appendChild(remainingEntry);

        await delay(1000);
    }

    updateUI();
    await delay(500);

    // Hide execution overlay and show results
    overlay.classList.add('hidden');
    showResults();
}

function showResults() {
    gameState.phase = 'complete';

    const score = gameState.stroke - 4; // Par 4
    gameState.scores.push(score);
    gameState.totalAttempts++;

    const overlay = document.getElementById('result-overlay');
    const title = document.getElementById('result-title');
    const scoreDiv = document.getElementById('result-score');
    const analysis = document.getElementById('result-analysis');
    const summary = document.getElementById('result-summary');

    // Determine score name
    let scoreName, scoreClass;
    if (score <= -1) {
        scoreName = 'BIRDIE!';
        scoreClass = 'birdie';
    } else if (score === 0) {
        scoreName = 'PAR';
        scoreClass = 'par';
    } else if (score === 1) {
        scoreName = 'BOGEY';
        scoreClass = 'bogey';
    } else {
        scoreName = `+${score}`;
        scoreClass = 'double-bogey';
    }

    title.textContent = 'Round Complete';
    scoreDiv.textContent = scoreName;
    scoreDiv.className = scoreClass;

    // Analyze shots
    let analysisHtml = '';
    gameState.executedShots.forEach((shot, index) => {
        const wasGoodPlan = shot.probability.success >= 50;
        const goodExecution = shot.success;

        let verdict, verdictClass;
        if (wasGoodPlan && goodExecution) {
            verdict = 'Good plan, good execution';
            verdictClass = 'good';
        } else if (wasGoodPlan && !goodExecution) {
            verdict = 'Good plan, execution failed';
            verdictClass = 'bad';
        } else if (!wasGoodPlan && goodExecution) {
            verdict = 'Risky plan, got lucky';
            verdictClass = 'good';
        } else {
            verdict = 'Risky plan, paid the price';
            verdictClass = 'bad';
        }

        analysisHtml += `
            <div class="analysis-item ${verdictClass}">
                <div class="shot-label">Shot ${index + 1}</div>
                <div class="outcome">${verdict}</div>
            </div>
        `;
    });
    analysis.innerHTML = analysisHtml;

    // Summary
    summary.innerHTML = `
        <p>Attempt #${gameState.totalAttempts}</p>
        <p>Slopes revealed: ${gameState.revealedSlopes.size} cells</p>
        <p>Green break known: ${gameState.revealedGreenBreak.size} cells</p>
    `;

    overlay.classList.remove('hidden');

    // Check for victory
    if (score <= -1) {
        setTimeout(() => {
            overlay.classList.add('hidden');
            showVictory();
        }, 2000);
    }
}

function showVictory() {
    const overlay = document.getElementById('victory-overlay');
    const stats = document.getElementById('victory-stats');
    const summary = document.getElementById('victory-summary');

    const avgScore = gameState.scores.reduce((a, b) => a + b, 0) / gameState.scores.length;

    stats.innerHTML = `
        <div class="stat">Total Attempts: <span class="stat-value">${gameState.totalAttempts}</span></div>
        <div class="stat">Average Score: <span class="stat-value">${avgScore >= 0 ? '+' : ''}${avgScore.toFixed(1)}</span></div>
    `;

    summary.innerHTML = `
        <h4>What You Learned</h4>
        <ul>
            <li>Discovered ${gameState.revealedSlopes.size} slope cells</li>
            <li>Mapped ${gameState.revealedGreenBreak.size} green break cells</li>
            <li>Completed in ${gameState.totalAttempts} attempt${gameState.totalAttempts > 1 ? 's' : ''}</li>
        </ul>
    `;

    overlay.classList.remove('hidden');
}

function startNewAttempt() {
    // Keep revealed info, reset shot state
    gameState.attempt++;
    gameState.stroke = 0;
    gameState.phase = 'planning';
    gameState.ballPos = { row: 37, col: 10 };
    gameState.plannedShots = [];
    gameState.executedShots = [];

    // Randomize conditions
    randomizeConditions();

    // Hide overlays
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('execution-overlay').classList.add('hidden');

    updateUI();
    updateProbabilityDisplay(null);
    render();
}

function resetGame() {
    // Full reset
    gameState = {
        attempt: 1,
        stroke: 0,
        phase: 'planning',
        ballPos: { row: 37, col: 10 },
        plannedShots: [],
        executedShots: [],
        currentZoneSize: 'medium',
        wind: { direction: 'N', strength: 'Calm' },
        pinIndex: 2,
        revealedSlopes: new Set(),
        revealedGreenBreak: new Set(),
        courseGrid: gameState.courseGrid,
        slopeGrid: gameState.slopeGrid,
        hoverZone: null,
        totalAttempts: 0,
        scores: []
    };

    randomizeConditions();

    document.getElementById('victory-overlay').classList.add('hidden');
    document.getElementById('result-overlay').classList.add('hidden');

    updateUI();
    render();
}

function randomizeConditions() {
    // Random wind
    const strengthRoll = Math.random();
    if (strengthRoll < 0.3) {
        gameState.wind.strength = 'Calm';
    } else if (strengthRoll < 0.6) {
        gameState.wind.strength = 'Light';
    } else if (strengthRoll < 0.85) {
        gameState.wind.strength = 'Medium';
    } else {
        gameState.wind.strength = 'Strong';
    }

    gameState.wind.direction = WIND_DIRS[Math.floor(Math.random() * WIND_DIRS.length)];

    // Random pin position
    gameState.pinIndex = Math.floor(Math.random() * PIN_POSITIONS.length);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize game
function init() {
    designCourse();
    initCanvas();
    setupEventListeners();
    randomizeConditions();
    updateUI();
    render();
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', init);

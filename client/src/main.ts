import "./style.css";

const CANVAS_WIDTH = 1180;
const CANVAS_HEIGHT = 700;
const WORLD_WIDTH = 3600;
const TAXI_WIDTH = 26;
const TAXI_HEIGHT = 12;
const TAXI_HALF_W = TAXI_WIDTH / 2;
const TAXI_HALF_H = TAXI_HEIGHT / 2;
const GRAVITY = 260;
const THRUST_UP = 410;
const THRUST_SIDE = 260;
const DESCENT_ASSIST = 205;
const DRAG = 0.993;
const MAX_LIVES = 3;
const MAX_FUEL = 100;
const FUEL_BURN_UP = 9.5;
const FUEL_BURN_SIDE = 3.9;
const FUEL_BURN_DESCENT = 3.1;
const REFUEL_RATE = 22;
const FUEL_COST_PER_UNIT = 2;
const LANDING_SPEED_X = 42;
const LANDING_SPEED_Y = 54;
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);

type GameMode = "attract" | "playing" | "gameover";
type StormState = "calm" | "warning" | "active";
type PadType = "roof" | "ground" | "mid";
type BuildingTier = "small" | "medium" | "large" | "highrise";

type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  descent: boolean;
};

type Building = {
  id: string;
  x: number;
  width: number;
  height: number;
  topY: number;
  baseY: number;
  leftGroundY: number;
  rightGroundY: number;
  tier: BuildingTier;
  windows: number;
};

type Pad = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  type: PadType;
  buildingId: string | null;
  fuelStation: boolean;
};

type Taxi = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lives: number;
  landedPadId: string | null;
  invulnerable: number;
  fuel: number;
};

type Fare = {
  id: string;
  passenger: string;
  originPadId: string;
  destinationPadId: string;
  payout: number;
  bonus: number;
  createdAt: number;
  pickupDeadline: number;
};

type OnboardFare = Fare & {
  pickedUpAt: number;
};

type DustDevil = {
  id: string;
  x: number;
  y: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
};

type Announcement = {
  text: string;
  ttl: number;
  priority: "info" | "warn" | "danger";
};

type LandingGrade = "S" | "A" | "B" | "C" | "D" | "F";

type LeaderboardEntry = {
  initials: string;
  score: number;
  run_seconds: number;
  seed: string | null;
  created_at: string;
};

type ScoreResponse = {
  entries: LeaderboardEntry[];
};

type StructurePack = {
  buildings: Building[];
  pads: Pad[];
};

const passengerNames = [
  "Ari",
  "Bex",
  "Cai",
  "Dax",
  "Eon",
  "Iva",
  "Jin",
  "Koa",
  "Lux",
  "Nia",
  "Pax",
  "Rho",
  "Sol",
  "Tao",
  "Vee",
  "Zed",
];

const accentPalette = {
  sand: "#d99963",
  rust: "#bc5d39",
  ember: "#ffb36a",
  cyan: "#9fe7ff",
  teal: "#59d0c4",
  sky: "#efd3aa",
  ink: "#1f1615",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function wrapWorldX(value: number) {
  return clamp(value, 20, WORLD_WIDTH - 20);
}

function randomChoice<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function groundHeightAt(x: number) {
  const ridge = Math.sin(x * 0.0042) * 14;
  const ripples = Math.sin(x * 0.0125 + 0.8) * 8;
  const crater = Math.cos(x * 0.0016 + 1.7) * 9;
  return 430 + ridge + ripples + crater;
}

function maxGroundHeightBetween(startX: number, endX: number, samples = 7) {
  let highest = -Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const sampleX = lerp(startX, endX, index / samples);
    highest = Math.max(highest, groundHeightAt(sampleX));
  }
  return highest;
}

function surfaceColorForTier(tier: BuildingTier) {
  switch (tier) {
    case "small":
      return "#8a614f";
    case "medium":
      return "#93644b";
    case "large":
      return "#a06f54";
    case "highrise":
      return "#b47a58";
  }
}

function createStructures(): StructurePack {
  const fuelRoofPads = new Set(["dock-4", "hub-8", "spire-12"]);
  const fuelGroundPads = new Set([2, 5, 7]);
  const buildingConfigs = [
    {
      id: "forge-1",
      x: 140,
      width: 92,
      height: 126,
      tier: "small" as const,
      decks: [{ side: "right" as const, yRatio: 0.58, width: 48 }],
    },
    {
      id: "hab-2",
      x: 360,
      width: 124,
      height: 194,
      tier: "medium" as const,
      decks: [{ side: "left" as const, yRatio: 0.56, width: 58 }],
    },
    {
      id: "spire-3",
      x: 620,
      width: 102,
      height: 314,
      tier: "highrise" as const,
      decks: [
        { side: "right" as const, yRatio: 0.42, width: 60 },
        { side: "left" as const, yRatio: 0.7, width: 54 },
      ],
    },
    {
      id: "dock-4",
      x: 880,
      width: 146,
      height: 170,
      tier: "medium" as const,
      decks: [{ side: "right" as const, yRatio: 0.62, width: 62 }],
    },
    {
      id: "stack-5",
      x: 1120,
      width: 124,
      height: 238,
      tier: "large" as const,
      decks: [
        { side: "left" as const, yRatio: 0.48, width: 58 },
        { side: "right" as const, yRatio: 0.72, width: 54 },
      ],
    },
    {
      id: "spire-6",
      x: 1400,
      width: 96,
      height: 344,
      tier: "highrise" as const,
      decks: [
        { side: "left" as const, yRatio: 0.4, width: 58 },
        { side: "right" as const, yRatio: 0.66, width: 54 },
      ],
    },
    {
      id: "yard-7",
      x: 1660,
      width: 106,
      height: 140,
      tier: "small" as const,
      decks: [{ side: "left" as const, yRatio: 0.63, width: 48 }],
    },
    {
      id: "hub-8",
      x: 1920,
      width: 154,
      height: 252,
      tier: "large" as const,
      decks: [
        { side: "right" as const, yRatio: 0.46, width: 64 },
        { side: "left" as const, yRatio: 0.74, width: 58 },
      ],
    },
    {
      id: "spire-9",
      x: 2230,
      width: 98,
      height: 324,
      tier: "highrise" as const,
      decks: [
        { side: "right" as const, yRatio: 0.38, width: 56 },
        { side: "left" as const, yRatio: 0.63, width: 54 },
      ],
    },
    {
      id: "forge-10",
      x: 2470,
      width: 132,
      height: 186,
      tier: "medium" as const,
      decks: [{ side: "left" as const, yRatio: 0.54, width: 58 }],
    },
    {
      id: "hab-11",
      x: 2735,
      width: 118,
      height: 252,
      tier: "large" as const,
      decks: [
        { side: "right" as const, yRatio: 0.44, width: 60 },
        { side: "left" as const, yRatio: 0.69, width: 56 },
      ],
    },
    {
      id: "spire-12",
      x: 3035,
      width: 92,
      height: 338,
      tier: "highrise" as const,
      decks: [
        { side: "left" as const, yRatio: 0.37, width: 56 },
        { side: "right" as const, yRatio: 0.61, width: 52 },
      ],
    },
    {
      id: "dock-13",
      x: 3290,
      width: 126,
      height: 152,
      tier: "small" as const,
      decks: [{ side: "right" as const, yRatio: 0.6, width: 48 }],
    },
  ];

  const buildings: Building[] = buildingConfigs.map((config) => {
    const leftGroundY = groundHeightAt(config.x + 8);
    const rightGroundY = groundHeightAt(config.x + config.width - 8);
    const baseY = maxGroundHeightBetween(config.x + 4, config.x + config.width - 4) + 18;
    return {
      id: config.id,
      x: config.x,
      width: config.width,
      height: config.height,
      baseY,
      leftGroundY,
      rightGroundY,
      topY: baseY - config.height,
      tier: config.tier,
      windows: Math.max(2, Math.floor(config.height / 30)),
    };
  });

  const pads: Pad[] = [];
  for (const [buildingIndex, building] of buildings.entries()) {
    const config = buildingConfigs[buildingIndex];
    pads.push({
      id: `pad-${building.id}`,
      label: building.id.toUpperCase(),
      x: building.x + building.width / 2,
      y: building.topY,
      width: Math.max(56, building.width - 16),
      type: "roof",
      buildingId: building.id,
      fuelStation: fuelRoofPads.has(building.id),
    });

    config.decks.forEach((deck, deckIndex) => {
      const width = deck.width;
      const deckCenterX =
        deck.side === "left"
          ? building.x - width / 2 + 10
          : building.x + building.width + width / 2 - 10;
      pads.push({
        id: `mid-${building.id}-${deckIndex + 1}`,
        label: `${building.id.toUpperCase()} M${deckIndex + 1}`,
        x: deckCenterX,
        y: building.topY + building.height * deck.yRatio,
        width,
        type: "mid",
        buildingId: building.id,
        fuelStation: false,
      });
    });
  }

  const groundPadXs = [300, 780, 1295, 1830, 2380, 2910, 3440];
  for (const [index, x] of groundPadXs.entries()) {
    pads.push({
      id: `ground-${index + 1}`,
      label: `DUNE-${index + 1}`,
      x,
      y: groundHeightAt(x),
      width: 72,
      type: "ground",
      buildingId: null,
      fuelStation: fuelGroundPads.has(index + 1),
    });
  }

  return { buildings, pads };
}

function createDustDevils(): DustDevil[] {
  return [
    { id: "dust-1", x: 540, y: groundHeightAt(540), radius: 18, height: 90, speed: 26, phase: 0.1 },
    { id: "dust-2", x: 1560, y: groundHeightAt(1560), radius: 20, height: 112, speed: -22, phase: 1.4 },
    { id: "dust-3", x: 2680, y: groundHeightAt(2680), radius: 16, height: 82, speed: 31, phase: 2.2 },
  ];
}

function createTaxi(): Taxi {
  return {
    x: 120,
    y: 180,
    vx: 0,
    vy: 0,
    angle: 0,
    lives: MAX_LIVES,
    landedPadId: null,
    invulnerable: 0,
    fuel: MAX_FUEL,
  };
}

function createAnnouncement(text: string, priority: Announcement["priority"], ttl = 4): Announcement {
  return { text, priority, ttl };
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

function formatFuel(value: number) {
  return `${Math.max(0, Math.round(value))}%`;
}

function landingGradeValue(grade: LandingGrade) {
  switch (grade) {
    case "S":
      return 5;
    case "A":
      return 4;
    case "B":
      return 3;
    case "C":
      return 2;
    case "D":
      return 1;
    case "F":
      return 0;
  }
}

function gradeFromLandingScore(score: number): LandingGrade {
  if (score >= 95) {
    return "S";
  }
  if (score >= 85) {
    return "A";
  }
  if (score >= 72) {
    return "B";
  }
  if (score >= 58) {
    return "C";
  }
  if (score >= 42) {
    return "D";
  }
  return "F";
}

function cuteGameOverPhrase(grade: LandingGrade) {
  switch (grade) {
    case "S":
      return "Even buried in dust, that was a legendary shift.";
    case "A":
      return "The colony will talk about that wreck with respect.";
    case "B":
      return "Rough ending, solid flying.";
    case "C":
      return "Mars got the taxi, but not your nerve.";
    case "D":
      return "Next shift: less crater, more control.";
    case "F":
      return "The dunes appreciate the donation.";
  }
}

function formatPadLabel(pad: Pad) {
  if (pad.type === "roof") {
    return `${pad.label} roof`;
  }
  if (pad.type === "mid") {
    return `${pad.label} mid deck`;
  }
  return `${pad.label} ground`;
}

function createFare(id: number, pads: Pad[]): Fare {
  const origin = randomChoice(pads);
  let destination = randomChoice(pads);
  while (destination.id === origin.id) {
    destination = randomChoice(pads);
  }

  const distance = Math.abs(destination.x - origin.x);
  const elevationBonus =
    (origin.type === "roof" || destination.type === "roof" ? 110 : 0) +
    (origin.type === "mid" || destination.type === "mid" ? 60 : 0);

  return {
    id: `fare-${id}`,
    passenger: randomChoice(passengerNames),
    originPadId: origin.id,
    destinationPadId: destination.id,
    payout: 180 + Math.round(distance * 0.22) + elevationBonus,
    bonus: 120,
    createdAt: 0,
    pickupDeadline: 42,
  };
}

function createStarterFare(id: number, pads: Pad[]): Fare {
  const origin = pads[0];
  let destination = randomChoice(pads.slice(1));
  while (destination.id === origin.id) {
    destination = randomChoice(pads.slice(1));
  }

  const distance = Math.abs(destination.x - origin.x);
  return {
    id: `fare-${id}`,
    passenger: "Lux",
    originPadId: origin.id,
    destinationPadId: destination.id,
    payout: 220 + Math.round(distance * 0.2) + 90,
    bonus: 140,
    createdAt: 0,
    pickupDeadline: 55,
  };
}

function sanitizeInitials(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scannerEl: HTMLElement;
  private readonly fareListEl: HTMLElement;
  private readonly leaderboardEl: HTMLElement;
  private readonly apiStatusEl: HTMLElement;
  private readonly scoreFormEl: HTMLFormElement;
  private readonly initialsInputEl: HTMLInputElement;
  private readonly submitButtonEl: HTMLButtonElement;
  private readonly relaunchButtonEl: HTMLButtonElement;
  private readonly descentButtonEl: HTMLButtonElement;
  private readonly soundButtonEl: HTMLButtonElement;
  private readonly progressEl: HTMLElement;
  private readonly statusPillEl: HTMLElement;
  private readonly uplinkCopyEl: HTMLElement;
  private readonly seedReadoutEl: HTMLElement;
  private readonly gameOverModalEl: HTMLElement;
  private readonly gameOverReasonEl: HTMLElement;
  private readonly gameOverScoreEl: HTMLElement;
  private readonly gameOverRatingEl: HTMLElement;
  private readonly gameOverPhraseEl: HTMLElement;
  private readonly retryButtonEl: HTMLButtonElement;

  private readonly input: InputState = { left: false, right: false, up: false, descent: false };
  private readonly structures = createStructures();
  private readonly dustDevils = createDustDevils();
  private taxi = createTaxi();
  private mode: GameMode = "attract";
  private cameraX = 0;
  private score = 0;
  private elapsed = 0;
  private fareSequence = 1;
  private waitingFares: Fare[] = [];
  private onboardFare: OnboardFare | null = null;
  private announcements: Announcement[] = [createAnnouncement("Press Enter to launch", "info", 60)];
  private stormState: StormState = "calm";
  private stormTimer = 14;
  private stormStrength = 0;
  private shelterTimer = 0;
  private flash = 0;
  private leaderboard: LeaderboardEntry[] = [];
  private apiStatus = "Connecting to dispatch uplink...";
  private seed = `mars-${Math.floor(Math.random() * 999999)}`;
  private scoreSubmitted = false;
  private gameOverReason = "Hull breach";
  private lastFrameTime = 0;
  private refuelDebt = 0;
  private fuelWarningStage = 0;
  private noFuelWarningCooldown = 0;
  private lowFuelAlarmCooldown = 0;
  private landingGradeFlash: LandingGrade | null = null;
  private landingGradeFlashTtl = 0;
  private landingGradeTotal = 0;
  private successfulLandings = 0;
  private deliveriesCompleted = 0;
  private soundEnabled = true;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private windOscillator: OscillatorNode | null = null;
  private windGain: GainNode | null = null;

  constructor() {
    this.canvas = this.expect<HTMLCanvasElement>("#game");
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context unavailable.");
    }
    this.ctx = context;

    this.scannerEl = this.expect("#scanner-readout");
    this.fareListEl = this.expect("#fare-list");
    this.leaderboardEl = this.expect("#leaderboard-list");
    this.apiStatusEl = this.expect("#api-status");
    this.scoreFormEl = this.expect<HTMLFormElement>("#score-form");
    this.initialsInputEl = this.expect<HTMLInputElement>("#initials-input");
    this.submitButtonEl = this.expect<HTMLButtonElement>("#submit-score");
    this.relaunchButtonEl = this.expect<HTMLButtonElement>("#relaunch");
    this.descentButtonEl = this.expect<HTMLButtonElement>("#descent-button");
    this.soundButtonEl = this.expect<HTMLButtonElement>("#sound-toggle");
    this.progressEl = this.expect("#progress-copy");
    this.statusPillEl = this.expect("#status-pill");
    this.uplinkCopyEl = this.expect("#uplink-copy");
    this.seedReadoutEl = this.expect("#seed-readout");
    this.gameOverModalEl = this.expect("#gameover-modal");
    this.gameOverReasonEl = this.expect("#gameover-reason");
    this.gameOverScoreEl = this.expect("#gameover-score");
    this.gameOverRatingEl = this.expect("#gameover-rating");
    this.gameOverPhraseEl = this.expect("#gameover-phrase");
    this.retryButtonEl = this.expect<HTMLButtonElement>("#retry-run");

    this.bindEvents();
    this.resetRound();
    this.fetchLeaderboard().catch(() => {
      this.apiStatus = "Dispatch uplink unavailable. Local scores still work if the API starts later.";
      this.syncHud();
    });
    this.syncHud();
    this.render();
  }

  start() {
    const tick = (timestamp: number) => {
      if (this.lastFrameTime === 0) {
        this.lastFrameTime = timestamp;
      }

      const dt = clamp((timestamp - this.lastFrameTime) / 1000, 0, 0.033);
      this.lastFrameTime = timestamp;
      this.step(dt);
      this.render();
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  }

  advanceTime(ms: number) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    const dt = ms / 1000 / steps;
    for (let index = 0; index < steps; index += 1) {
      this.step(dt);
    }
    this.render();
  }

  renderTextState() {
    const currentPad = this.getPadById(this.taxi.landedPadId);
    const payload = {
      note: "Origin top-left. x grows right. y grows downward.",
      mode: this.mode,
      taxi: {
        x: Number(this.taxi.x.toFixed(1)),
        y: Number(this.taxi.y.toFixed(1)),
        vx: Number(this.taxi.vx.toFixed(1)),
        vy: Number(this.taxi.vy.toFixed(1)),
        landedPadId: this.taxi.landedPadId,
        gearExtended: this.isGearExtended(),
        fuel: Number(this.taxi.fuel.toFixed(1)),
      },
      cameraX: Number(this.cameraX.toFixed(1)),
      score: this.displayScore(),
      lives: this.taxi.lives,
      currentPad: currentPad ? formatPadLabel(currentPad) : null,
      currentPadHasFuel: currentPad?.fuelStation ?? false,
      storm: {
        state: this.stormState,
        seconds: Number(
          (this.stormState === "active" ? this.shelterTimer : this.stormTimer).toFixed(1),
        ),
        strength: Number(this.stormStrength.toFixed(2)),
      },
      onboardFare: this.onboardFare
        ? {
            passenger: this.onboardFare.passenger,
            destination: formatPadLabel(this.getPadById(this.onboardFare.destinationPadId)!),
            payout: this.onboardFare.payout,
          }
        : null,
      waitingFares: this.waitingFares.map((fare) => ({
        passenger: fare.passenger,
        origin: formatPadLabel(this.getPadById(fare.originPadId)!),
        destination: formatPadLabel(this.getPadById(fare.destinationPadId)!),
        payout: fare.payout,
        pickupDeadline: Number(fare.pickupDeadline.toFixed(1)),
      })),
    };

    return JSON.stringify(payload);
  }

  private bindEvents() {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (isTypingTarget(event.target) && key !== "enter") {
        return;
      }

      if (event.repeat && key !== "shift") {
        return;
      }

      if (event.key === "ArrowLeft" || key === "a") {
        this.input.left = true;
        void this.resumeAudio();
        event.preventDefault();
      } else if (event.key === "ArrowRight" || key === "d") {
        this.input.right = true;
        void this.resumeAudio();
        event.preventDefault();
      } else if (event.key === "ArrowUp" || key === "w") {
        this.input.up = true;
        void this.resumeAudio();
        event.preventDefault();
      } else if (event.key === "Shift" || event.key === "ArrowDown" || key === "s") {
        this.setDescentInput(true);
        void this.resumeAudio();
        event.preventDefault();
      } else if (event.key === "Enter") {
        if (this.mode === "attract") {
          this.beginRun();
        } else if (this.mode === "gameover" && document.activeElement !== this.initialsInputEl) {
          this.beginRun();
        }
      } else if (event.key === " ") {
        if (this.mode === "attract") {
          this.beginRun();
        }
        event.preventDefault();
      } else if (event.key.toLowerCase() === "f") {
        this.toggleFullscreen().catch(() => {
          this.pushAnnouncement("Fullscreen request blocked by browser.", "warn", 3);
        });
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || key === "a") {
        this.input.left = false;
      } else if (event.key === "ArrowRight" || key === "d") {
        this.input.right = false;
      } else if (event.key === "ArrowUp" || key === "w") {
        this.input.up = false;
      } else if (event.key === "Shift" || event.key === "ArrowDown" || key === "s") {
        this.setDescentInput(false);
      }
    });

    window.addEventListener("blur", () => {
      this.resetTransientInput();
    });

    this.canvas.addEventListener("click", () => {
      void this.resumeAudio();
      if (this.mode === "attract") {
        this.beginRun();
      }
    });

    this.descentButtonEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.descentButtonEl.setPointerCapture(event.pointerId);
      this.setDescentInput(true);
      void this.resumeAudio();
    });

    const releaseDescent = () => {
      this.setDescentInput(false);
    };
    this.descentButtonEl.addEventListener("pointerup", releaseDescent);
    this.descentButtonEl.addEventListener("pointercancel", releaseDescent);
    this.descentButtonEl.addEventListener("lostpointercapture", releaseDescent);

    this.soundButtonEl.addEventListener("click", () => {
      this.toggleSound();
    });

    this.initialsInputEl.addEventListener("input", () => {
      this.initialsInputEl.value = sanitizeInitials(this.initialsInputEl.value);
    });

    this.scoreFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitScore().catch(() => {
        this.apiStatus = "Dispatch uplink rejected the score. Check the API and try again.";
        this.syncHud();
      });
    });

    this.relaunchButtonEl.addEventListener("click", () => {
      this.beginRun();
    });
    this.retryButtonEl.addEventListener("click", () => {
      this.beginRun();
    });
  }

  private isGearExtended() {
    return this.mode === "playing" && this.input.descent;
  }

  private setDescentInput(active: boolean) {
    this.input.descent = active;
    this.syncControlButtons();
  }

  private resetTransientInput() {
    this.input.left = false;
    this.input.right = false;
    this.input.up = false;
    this.setDescentInput(false);
  }

  private expect<T extends Element>(selector: string) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Missing element: ${selector}`);
    }
    return element as T;
  }

  private async toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await this.canvas.requestFullscreen();
  }

  private resetRound() {
    this.taxi = createTaxi();
    this.resetTransientInput();
    this.cameraX = 0;
    this.score = 0;
    this.elapsed = 0;
    this.fareSequence = 1;
    this.waitingFares = [];
    this.onboardFare = null;
    this.announcements = [createAnnouncement("Scanner green. Awaiting launch.", "info", 5)];
    this.stormState = "calm";
    this.stormTimer = 18;
    this.stormStrength = 0;
    this.shelterTimer = 0;
    this.flash = 0;
    this.refuelDebt = 0;
    this.fuelWarningStage = 0;
    this.noFuelWarningCooldown = 0;
    this.lowFuelAlarmCooldown = 0;
    this.landingGradeFlash = null;
    this.landingGradeFlashTtl = 0;
    this.landingGradeTotal = 0;
    this.successfulLandings = 0;
    this.deliveriesCompleted = 0;
    this.scoreSubmitted = false;
    this.gameOverReason = "Hull breach";
    this.initialsInputEl.value = "";
    this.fillFareBoard();
    this.dockTaxi(this.structures.pads[0]);
  }

  private beginRun() {
    this.mode = "playing";
    this.seed = `mars-${Math.floor(Math.random() * 999999)}`;
    this.resetRound();
    this.playTone(240, 0.14, "triangle", 0.05, 340);
    this.pushAnnouncement("Dispatch: lift clean and watch the weather bands.", "info", 4);
    this.syncHud();
  }

  private step(dt: number) {
    this.flash = Math.max(0, this.flash - dt * 1.3);
    this.taxi.invulnerable = Math.max(0, this.taxi.invulnerable - dt);
    this.noFuelWarningCooldown = Math.max(0, this.noFuelWarningCooldown - dt);
    this.lowFuelAlarmCooldown = Math.max(0, this.lowFuelAlarmCooldown - dt);
    this.landingGradeFlashTtl = Math.max(0, this.landingGradeFlashTtl - dt);
    if (this.landingGradeFlashTtl <= 0) {
      this.landingGradeFlash = null;
    }

    for (const announcement of this.announcements) {
      announcement.ttl -= dt;
    }
    this.announcements = this.announcements.filter((announcement) => announcement.ttl > 0);

    if (this.mode !== "playing") {
      this.cameraX = lerp(this.cameraX, this.taxi.x - CANVAS_WIDTH * 0.33, 0.04);
      this.cameraX = clamp(this.cameraX, 0, WORLD_WIDTH - CANVAS_WIDTH);
      this.syncHud();
      this.updateAudioState();
      return;
    }

    this.elapsed += dt;
    this.updateStorm(dt);
    this.updateDustDevils(dt);
    this.updateFares(dt);
    this.updateTaxi(dt);
    this.updateLowFuelAlarm();
    this.cameraX = clamp(
      lerp(this.cameraX, this.taxi.x - CANVAS_WIDTH * 0.35, 0.1),
      0,
      WORLD_WIDTH - CANVAS_WIDTH,
    );
    this.syncHud();
    this.updateAudioState();
  }

  private updateStorm(dt: number) {
    if (this.stormState === "calm") {
      this.stormTimer -= dt;
      this.stormStrength = 0;
      if (this.stormTimer <= 0) {
        this.stormState = "warning";
        this.stormTimer = 8;
        this.playTone(420, 0.22, "square", 0.04, 310);
        this.pushAnnouncement("Scanner: sandstorm front incoming. Find a pad.", "warn", 5);
      }
      return;
    }

    if (this.stormState === "warning") {
      this.stormTimer -= dt;
      this.stormStrength = 0.22;
      if (this.stormTimer <= 0) {
        this.stormState = "active";
        this.shelterTimer = 6.5;
        this.stormTimer = 0;
        this.playTone(180, 0.35, "sawtooth", 0.05, 110);
        this.pushAnnouncement("Storm active. Land now or lose the hull.", "danger", 6);
      }
      return;
    }

    this.shelterTimer -= this.taxi.landedPadId ? dt * 0.15 : dt;
    this.stormStrength = 0.75 + Math.sin(this.elapsed * 3.8) * 0.15;
    if (this.taxi.landedPadId && this.shelterTimer < 5.5) {
      this.shelterTimer = 5.5;
    }

    if (this.shelterTimer <= 0) {
      this.crashTaxi("Storm shear tore through the taxi.");
      this.resetStormCycle();
      return;
    }

    if (this.shelterTimer <= 0.9 && !this.taxi.landedPadId) {
      this.pushAnnouncement("Last chance. Touch down immediately.", "danger", 0.8);
    }

    if (this.shelterTimer <= 5.3 && this.taxi.landedPadId) {
      this.pushAnnouncement("Shelter confirmed. Hold position.", "info", 1.4);
    }

    if (this.shelterTimer >= 5.45 && this.taxi.landedPadId) {
      this.stormTimer -= dt;
      if (this.stormTimer <= -6.5) {
        this.resetStormCycle();
        this.pushAnnouncement("Storm front passed. Dispatch lanes reopened.", "info", 4);
      }
    }
  }

  private resetStormCycle() {
    this.stormState = "calm";
    this.stormTimer = 22 + Math.random() * 10;
    this.stormStrength = 0;
    this.shelterTimer = 0;
  }

  private updateDustDevils(dt: number) {
    for (const devil of this.dustDevils) {
      devil.x += devil.speed * dt;
      if (devil.x < 30 || devil.x > WORLD_WIDTH - 30) {
        devil.speed *= -1;
      }

      const dx = Math.abs(devil.x - this.taxi.x);
      const taxiBottom = this.taxi.y + TAXI_HALF_H;
      const inColumn = dx < devil.radius + TAXI_HALF_W && taxiBottom > devil.y - devil.height;

      if (inColumn && this.mode === "playing" && this.taxi.invulnerable <= 0) {
        this.taxi.vx += Math.sign(this.taxi.x - devil.x || 1) * 20 * dt;
        this.taxi.vy -= 80 * dt;
      }
    }
  }

  private updateFares(dt: number) {
    for (const fare of this.waitingFares) {
      fare.createdAt += dt;
      fare.pickupDeadline = Math.max(0, fare.pickupDeadline - dt);
    }

    const expired = this.waitingFares.filter((fare) => fare.pickupDeadline <= 0);
    if (expired.length > 0) {
      this.waitingFares = this.waitingFares.filter((fare) => fare.pickupDeadline > 0);
      this.pushAnnouncement("A fare timed out and bailed to a rover shuttle.", "warn", 3);
      this.fillFareBoard();
    }

    if (this.onboardFare) {
      const travelTime = this.elapsed - this.onboardFare.pickedUpAt;
      if (travelTime > 55) {
        this.score = Math.max(0, this.score - 1);
      }
    }
  }

  private updateTaxi(dt: number) {
    const currentPad = this.getPadById(this.taxi.landedPadId);
    if (currentPad) {
      this.taxi.x = lerp(this.taxi.x, currentPad.x, 0.18);
      this.taxi.y = currentPad.y - TAXI_HALF_H;
      this.taxi.vx *= 0.65;
      this.taxi.vy = 0;
      this.taxi.angle = lerp(this.taxi.angle, 0, 0.25);
      this.updateRefuelPad(currentPad, dt);

      if (this.input.up || this.input.left || this.input.right) {
        this.taxi.landedPadId = null;
        this.taxi.vy = -65;
        this.playTone(210, 0.12, "triangle", 0.04, 300);
        this.pushAnnouncement("Taxi airborne.", "info", 1.2);
      } else {
        this.resolvePadInteraction(currentPad);
        return;
      }
    }

    let ax = 0;
    if (this.input.left) {
      if (this.consumeFuel(FUEL_BURN_SIDE * dt)) {
        ax -= THRUST_SIDE;
      }
    }
    if (this.input.right) {
      if (this.consumeFuel(FUEL_BURN_SIDE * dt)) {
        ax += THRUST_SIDE;
      }
    }
    if (this.input.up) {
      if (this.consumeFuel(FUEL_BURN_UP * dt)) {
        this.taxi.vy -= THRUST_UP * dt;
      }
    }
    if (this.input.descent && this.taxi.vy > 18) {
      if (this.consumeFuel(FUEL_BURN_DESCENT * dt)) {
        this.taxi.vy -= DESCENT_ASSIST * dt;
        this.taxi.vx *= 0.986;
      }
    }

    if (this.stormState === "warning") {
      ax += 35 * Math.sin(this.elapsed * 2.1);
    } else if (this.stormState === "active") {
      ax += 140 * this.stormStrength * Math.sin(this.elapsed * 4.7);
    }

    this.taxi.vy += GRAVITY * dt;
    this.taxi.vx += ax * dt;
    this.taxi.vx *= DRAG;
    this.taxi.vy *= 0.998;
    this.taxi.vx = clamp(this.taxi.vx, -160, 160);
    this.taxi.vy = clamp(this.taxi.vy, -210, 240);
    this.taxi.angle = lerp(this.taxi.angle, clamp(this.taxi.vx / 120, -0.22, 0.22), 0.12);

    const previousX = this.taxi.x;
    const previousY = this.taxi.y;
    this.taxi.x = wrapWorldX(this.taxi.x + this.taxi.vx * dt);
    this.taxi.y += this.taxi.vy * dt;

    if (this.taxi.y < 30) {
      this.taxi.y = 30;
      this.taxi.vy = Math.max(this.taxi.vy, 0);
    }
    if (this.taxi.y > CANVAS_HEIGHT + 40) {
      this.crashTaxi("Taxi drifted below scanner coverage.");
      return;
    }

    if (this.checkBuildingCollisions(previousX, previousY)) {
      return;
    }

    this.checkSurfaceCollision(previousY);
  }

  private checkBuildingCollisions(previousX: number, previousY: number) {
    const left = this.taxi.x - TAXI_HALF_W;
    const right = this.taxi.x + TAXI_HALF_W;
    const top = this.taxi.y - TAXI_HALF_H;
    const bottom = this.taxi.y + TAXI_HALF_H;
    const previousBottom = previousY + TAXI_HALF_H;

    for (const building of this.structures.buildings) {
      const buildingPads = this.structures.pads.filter((pad) => pad.buildingId === building.id);
      const landingPad = buildingPads.find((pad) => {
        const withinX = Math.abs(this.taxi.x - pad.x) <= pad.width / 2;
        const crossedPad = previousBottom <= pad.y + 2 && bottom >= pad.y && this.taxi.vy >= 0;
        return withinX && crossedPad;
      });
      if (landingPad) {
        this.resolveSurfaceLanding(landingPad);
        return true;
      }

      const overlapsX = right > building.x && left < building.x + building.width;
      const overlapsY = bottom > building.topY && top < building.baseY;
      if (!overlapsX || !overlapsY) {
        continue;
      }

      const approachingMidDeck = buildingPads.some((pad) => {
        if (pad.type !== "mid") {
          return false;
        }

        const inDeckLane = Math.abs(this.taxi.x - pad.x) <= pad.width / 2 + 8;
        const nearDeckHeight = bottom >= pad.y - 18 && top <= pad.y + 10;
        const openSideClearance =
          pad.x < building.x
            ? this.taxi.x <= building.x + TAXI_HALF_W + 4
            : this.taxi.x >= building.x + building.width - TAXI_HALF_W - 4;
        return inDeckLane && nearDeckHeight && openSideClearance;
      });
      if (approachingMidDeck) {
        continue;
      }

      const fallingOntoRoof = previousBottom <= building.topY + 2 && this.taxi.vy >= 0;
      if (fallingOntoRoof) {
        const roofPad = buildingPads.find((pad) => pad.type === "roof");
        if (roofPad && Math.abs(this.taxi.x - roofPad.x) <= roofPad.width / 2) {
          this.resolveSurfaceLanding(roofPad);
          return true;
        }
      }

      const hitSide =
        (previousX + TAXI_HALF_W <= building.x && right >= building.x) ||
        (previousX - TAXI_HALF_W >= building.x + building.width && left <= building.x + building.width);

      if (hitSide || bottom > building.topY + 4) {
        this.crashTaxi(`Hull clipped ${building.id.toUpperCase()}.`);
        return true;
      }
    }

    return false;
  }

  private checkSurfaceCollision(previousY: number) {
    const pad = this.findPadUnderTaxi();
    if (!pad) {
      const groundY = groundHeightAt(this.taxi.x);
      if (this.taxi.y + TAXI_HALF_H >= groundY) {
        this.crashTaxi("Taxi slammed into open regolith.");
      }
      return;
    }

    const currentBottom = this.taxi.y + TAXI_HALF_H;
    const previousBottom = previousY + TAXI_HALF_H;
    if (previousBottom <= pad.y + 2 && currentBottom >= pad.y) {
      this.resolveSurfaceLanding(pad);
    }
  }

  private resolveSurfaceLanding(pad: Pad) {
    if (!this.isGearExtended()) {
      this.crashTaxi("Landing gear was retracted.");
      return;
    }

    if (Math.abs(this.taxi.vx) <= LANDING_SPEED_X && Math.abs(this.taxi.vy) <= LANDING_SPEED_Y) {
      const landingGrade = this.evaluateLandingGrade(pad);
      this.taxi.landedPadId = pad.id;
      this.taxi.x = pad.x;
      this.taxi.y = pad.y - TAXI_HALF_H;
      this.taxi.vx = 0;
      this.taxi.vy = 0;
      this.taxi.angle = 0;
      this.playTone(310, 0.18, "triangle", 0.05, 200);
      this.celebrateLanding(landingGrade);
      this.pushAnnouncement(
        `${landingGrade}-tier touchdown on ${formatPadLabel(pad)}.`,
        landingGrade === "S" || landingGrade === "A" ? "info" : "warn",
        1.8,
      );
      this.resolvePadInteraction(pad);
      return;
    }

    this.crashTaxi("Landing was too hot.");
  }

  private resolvePadInteraction(pad: Pad) {
    if (this.onboardFare) {
      if (pad.id === this.onboardFare.destinationPadId) {
        const tripDuration = this.elapsed - this.onboardFare.pickedUpAt;
        const timeBonus = Math.max(0, this.onboardFare.bonus - Math.round(tripDuration * 4));
        const total = this.onboardFare.payout + timeBonus;
        this.score += total;
        this.playTone(640, 0.14, "triangle", 0.05, 920);
        this.playTone(920, 0.16, "triangle", 0.04, 1180, 0.08);
        this.pushAnnouncement(
          `${this.onboardFare.passenger} delivered. +${total} credits.`,
          "info",
          4,
        );
        this.deliveriesCompleted += 1;
        this.onboardFare = null;
        this.fillFareBoard();
      }
      return;
    }

    const fare = this.waitingFares.find((candidate) => candidate.originPadId === pad.id);
    if (!fare) {
      return;
    }

    this.waitingFares = this.waitingFares.filter((candidate) => candidate.id !== fare.id);
    this.onboardFare = {
      ...fare,
      pickedUpAt: this.elapsed,
    };
    this.playTone(360, 0.12, "triangle", 0.045, 520);
    this.playTone(520, 0.1, "triangle", 0.035, 700, 0.06);
    this.pushAnnouncement(
      `${fare.passenger} aboard for ${formatPadLabel(this.getPadById(fare.destinationPadId)!)}.`,
      "info",
      4,
    );
    this.fillFareBoard();
  }

  private crashTaxi(reason: string) {
    if (this.taxi.invulnerable > 0) {
      return;
    }

    this.flash = 1;
    this.taxi.lives -= 1;
    this.taxi.invulnerable = 1.8;
    this.gameOverReason = reason;
    this.playTone(190, 0.28, "sawtooth", 0.06, 70);
    this.playTone(120, 0.32, "sawtooth", 0.045, 52, 0.08);
    this.playTone(74, 0.4, "triangle", 0.032, 40, 0.18);
    this.pushAnnouncement(reason, "danger", 3.6);

    if (this.taxi.lives <= 0) {
      this.mode = "gameover";
      this.taxi.vx = 0;
      this.taxi.vy = 0;
      this.taxi.landedPadId = null;
      this.pushAnnouncement("Flight deck lost. Enter initials for the board.", "warn", 8);
      this.syncHud();
      this.initialsInputEl.focus();
      return;
    }

    this.respawnTaxi();
  }

  private respawnTaxi() {
    const fallbackPad = this.structures.pads[0];
    this.dockTaxi(fallbackPad);
    this.resetStormCycle();
  }

  private findPadUnderTaxi() {
    return (
      this.structures.pads.find(
        (pad) =>
          Math.abs(this.taxi.x - pad.x) <= pad.width / 2 &&
          this.taxi.y + TAXI_HALF_H >= pad.y - 3 &&
          this.taxi.y + TAXI_HALF_H <= pad.y + 16,
      ) ?? null
    );
  }

  private getPadById(id: string | null) {
    if (!id) {
      return null;
    }
    return this.structures.pads.find((pad) => pad.id === id) ?? null;
  }

  private targetWaitingFares() {
    if (this.deliveriesCompleted <= 0) {
      return this.onboardFare ? 0 : 1;
    }
    if (this.deliveriesCompleted <= 2) {
      return 1;
    }
    if (this.deliveriesCompleted <= 5) {
      return 2;
    }
    return 3;
  }

  private fillFareBoard() {
    const targetWaitingFares = this.targetWaitingFares();
    while (this.waitingFares.length < targetWaitingFares) {
      const shouldCreateStarterFare =
        this.fareSequence === 1 && this.waitingFares.length === 0 && !this.onboardFare;
      const fare = shouldCreateStarterFare
        ? createStarterFare(this.fareSequence, this.structures.pads)
        : createFare(this.fareSequence, this.structures.pads);
      this.fareSequence += 1;
      const clashesWithActive = this.onboardFare
        ? fare.originPadId === this.onboardFare.destinationPadId
        : false;
      const clashesWithWaiting = this.waitingFares.some(
        (existing) =>
          existing.originPadId === fare.originPadId &&
          existing.destinationPadId === fare.destinationPadId,
      );
      if (!clashesWithActive && !clashesWithWaiting) {
        this.waitingFares.push(fare);
      }
    }
  }

  private dockTaxi(pad: Pad) {
    this.taxi.x = pad.x;
    this.taxi.y = pad.y - TAXI_HALF_H;
    this.taxi.vx = 0;
    this.taxi.vy = 0;
    this.taxi.angle = 0;
    this.taxi.landedPadId = pad.id;
  }

  private syncControlButtons() {
    this.descentButtonEl.textContent = this.input.descent
      ? "Descent / Gear Active"
      : "Hold Descent / Gear";
    this.descentButtonEl.setAttribute("aria-pressed", String(this.input.descent));
    this.descentButtonEl.classList.toggle("is-active", this.input.descent);

    this.soundButtonEl.textContent = this.soundEnabled ? "Sound On" : "Sound Off";
    this.soundButtonEl.setAttribute("aria-pressed", String(this.soundEnabled));
    this.soundButtonEl.classList.toggle("is-muted", !this.soundEnabled);
  }

  private displayScore() {
    return Math.max(0, Math.floor(this.score));
  }

  private consumeFuel(amount: number) {
    if (amount <= 0) {
      return true;
    }

    if (this.taxi.fuel <= 0.05) {
      this.taxi.fuel = 0;
      this.warnNoFuel();
      return false;
    }

    this.taxi.fuel = Math.max(0, this.taxi.fuel - amount);
    this.updateFuelWarnings();
    return true;
  }

  private warnNoFuel() {
    if (this.noFuelWarningCooldown > 0) {
      return;
    }
    this.noFuelWarningCooldown = 1.8;
    this.playTone(320, 0.18, "square", 0.04, 220);
    this.playTone(220, 0.22, "square", 0.035, 160, 0.16);
    this.pushAnnouncement("Fuel cells dry. Glide to a fuel station.", "danger", 2.6);
  }

  private updateFuelWarnings() {
    if (this.taxi.fuel <= 15 && this.fuelWarningStage < 2) {
      this.fuelWarningStage = 2;
      this.lowFuelAlarmCooldown = 0;
      this.pushAnnouncement("Fuel critical. Find a station now.", "danger", 3.2);
      return;
    }

    if (this.taxi.fuel <= 35 && this.fuelWarningStage < 1) {
      this.fuelWarningStage = 1;
      this.lowFuelAlarmCooldown = 0;
      this.pushAnnouncement("Fuel reserve below 35%.", "warn", 2.6);
      return;
    }

    if (this.taxi.fuel > 55) {
      this.fuelWarningStage = 0;
      this.lowFuelAlarmCooldown = 0;
    }
  }

  private updateLowFuelAlarm() {
    if (this.mode !== "playing" || this.lowFuelAlarmCooldown > 0 || this.taxi.fuel > 35) {
      return;
    }

    const currentPad = this.getPadById(this.taxi.landedPadId);
    if (currentPad?.fuelStation && this.taxi.fuel < MAX_FUEL) {
      return;
    }

    if (this.taxi.fuel <= 15) {
      this.playTone(920, 0.09, "square", 0.03, 760);
      this.playTone(760, 0.12, "square", 0.026, 620, 0.14);
      this.lowFuelAlarmCooldown = 1.1;
      return;
    }

    this.playTone(720, 0.08, "square", 0.022, 620);
    this.playTone(620, 0.1, "square", 0.018, 520, 0.16);
    this.lowFuelAlarmCooldown = 2.2;
  }

  private updateRefuelPad(pad: Pad, dt: number) {
    if (!pad.fuelStation || this.taxi.fuel >= MAX_FUEL || this.mode !== "playing") {
      return;
    }

    const affordableFuel = this.score / FUEL_COST_PER_UNIT;
    if (affordableFuel <= 0) {
      return;
    }

    const fuelToBuy = Math.min(REFUEL_RATE * dt, MAX_FUEL - this.taxi.fuel, affordableFuel);
    if (fuelToBuy <= 0) {
      return;
    }

    this.taxi.fuel = Math.min(MAX_FUEL, this.taxi.fuel + fuelToBuy);
    this.refuelDebt += fuelToBuy * FUEL_COST_PER_UNIT;
    const billedCredits = Math.min(this.score, Math.floor(this.refuelDebt));
    if (billedCredits > 0) {
      this.score -= billedCredits;
      this.refuelDebt -= billedCredits;
    }
    this.updateFuelWarnings();
  }

  private evaluateLandingGrade(pad: Pad) {
    const vxRatio = Math.min(1, Math.abs(this.taxi.vx) / LANDING_SPEED_X);
    const vyRatio = Math.min(1, Math.abs(this.taxi.vy) / LANDING_SPEED_Y);
    const centerOffset = Math.abs(this.taxi.x - pad.x) / Math.max(1, pad.width / 2);
    const score =
      100 - vxRatio * 34 - vyRatio * 44 - Math.min(1, centerOffset) * (pad.type === "mid" ? 28 : 22);
    return gradeFromLandingScore(score);
  }

  private celebrateLanding(grade: LandingGrade) {
    this.landingGradeFlash = grade;
    this.landingGradeFlashTtl = 1.85;
    this.landingGradeTotal += landingGradeValue(grade);
    this.successfulLandings += 1;

    switch (grade) {
      case "S":
        this.playTone(520, 0.08, "triangle", 0.045, 760);
        this.playTone(760, 0.12, "triangle", 0.04, 1120, 0.05);
        this.playTone(1120, 0.14, "triangle", 0.035, 1320, 0.12);
        break;
      case "A":
        this.playTone(460, 0.08, "triangle", 0.04, 660);
        this.playTone(660, 0.1, "triangle", 0.035, 920, 0.06);
        break;
      case "B":
        this.playTone(360, 0.12, "triangle", 0.04, 520);
        this.playTone(520, 0.08, "triangle", 0.03, 640, 0.06);
        break;
      case "C":
      case "D":
        this.playTone(300, 0.1, "triangle", 0.03, 360);
        break;
      case "F":
        break;
    }
  }

  private overallRunGrade(): LandingGrade {
    if (this.successfulLandings === 0) {
      return "F";
    }

    const averageGrade = this.landingGradeTotal / this.successfulLandings;
    const deliveryBonus = Math.min(0.8, this.deliveriesCompleted * 0.12);
    return gradeFromLandingScore((averageGrade + deliveryBonus) * 20);
  }

  private toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (this.soundEnabled) {
      void this.resumeAudio();
      this.playTone(580, 0.12, "triangle", 0.04, 760);
    }
    this.syncHud();
  }

  private ensureAudioContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const audioContextCtor =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!audioContextCtor) {
      return null;
    }

    const context = new audioContextCtor();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.14;
    masterGain.connect(context.destination);

    const engineOscillator = context.createOscillator();
    const engineGain = context.createGain();
    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 110;
    engineGain.gain.value = 0.0001;
    engineOscillator.connect(engineGain);
    engineGain.connect(masterGain);
    engineOscillator.start();

    const windOscillator = context.createOscillator();
    const windGain = context.createGain();
    windOscillator.type = "triangle";
    windOscillator.frequency.value = 62;
    windGain.gain.value = 0.0001;
    windOscillator.connect(windGain);
    windGain.connect(masterGain);
    windOscillator.start();

    this.audioContext = context;
    this.masterGain = masterGain;
    this.engineOscillator = engineOscillator;
    this.engineGain = engineGain;
    this.windOscillator = windOscillator;
    this.windGain = windGain;
    return context;
  }

  private async resumeAudio() {
    if (!this.soundEnabled) {
      return;
    }

    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      await context.resume();
    }
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    slideTo = frequency,
    delay = 0,
  ) {
    if (!this.soundEnabled) {
      return;
    }

    const context = this.ensureAudioContext();
    if (!context || !this.masterGain) {
      return;
    }

    const startTime = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), startTime + duration);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  private updateAudioState() {
    if (
      !this.audioContext ||
      !this.engineGain ||
      !this.engineOscillator ||
      !this.windGain ||
      !this.windOscillator
    ) {
      return;
    }

    const now = this.audioContext.currentTime;
    const isAirborne = !this.taxi.landedPadId && this.mode === "playing";
    const engineTarget =
      this.soundEnabled && isAirborne
        ? this.input.up
          ? 0.045
          : this.input.descent
            ? 0.028
            : this.input.left || this.input.right
              ? 0.018
              : 0.0001
        : 0.0001;
    const engineFrequency = this.input.up
      ? 150 + Math.abs(this.taxi.vy) * 0.18
      : this.input.descent
        ? 104 + Math.max(0, this.taxi.vy) * 0.16
        : 90 + Math.abs(this.taxi.vx) * 0.12;
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.linearRampToValueAtTime(engineTarget, now + 0.08);
    this.engineOscillator.frequency.cancelScheduledValues(now);
    this.engineOscillator.frequency.linearRampToValueAtTime(engineFrequency, now + 0.08);

    const stormFactor =
      this.stormState === "active" ? 1 : this.stormState === "warning" ? 0.42 : 0.08;
    const windTarget = this.soundEnabled ? 0.002 + stormFactor * 0.022 : 0.0001;
    const windFrequency = 48 + stormFactor * 46 + this.stormStrength * 26;
    this.windGain.gain.cancelScheduledValues(now);
    this.windGain.gain.linearRampToValueAtTime(windTarget, now + 0.15);
    this.windOscillator.frequency.cancelScheduledValues(now);
    this.windOscillator.frequency.linearRampToValueAtTime(windFrequency, now + 0.15);
  }

  private pushAnnouncement(text: string, priority: Announcement["priority"], ttl = 3.5) {
    const existing = this.announcements.find((announcement) => announcement.text === text);
    if (existing) {
      existing.ttl = Math.max(existing.ttl, ttl);
      existing.priority = priority;
      return;
    }
    this.announcements.unshift(createAnnouncement(text, priority, ttl));
    this.announcements = this.announcements.slice(0, 4);
  }

  private async fetchLeaderboard() {
    const response = await fetch(`${API_BASE}/leaderboard?limit=10`);
    if (!response.ok) {
      throw new Error("Leaderboard fetch failed");
    }
    const payload = (await response.json()) as ScoreResponse;
    this.leaderboard = payload.entries;
    this.apiStatus = "Dispatch uplink online.";
    this.syncHud();
  }

  private async submitScore() {
    if (this.mode !== "gameover" || this.scoreSubmitted) {
      return;
    }

    const initials = sanitizeInitials(this.initialsInputEl.value);
    if (initials.length !== 3) {
      this.apiStatus = "Need exactly 3 initials for the top ten.";
      this.syncHud();
      return;
    }

    this.submitButtonEl.disabled = true;
    this.apiStatus = "Uploading score to dispatch...";
    this.syncHud();

    const response = await fetch(`${API_BASE}/submit-score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initials,
        score: this.displayScore(),
        runSeconds: Number(this.elapsed.toFixed(1)),
        seed: this.seed,
      }),
    });

    this.submitButtonEl.disabled = false;
    if (!response.ok) {
      throw new Error("Score submit failed");
    }

    this.scoreSubmitted = true;
    this.apiStatus = "Score uplink confirmed.";
    await this.fetchLeaderboard();
    this.syncHud();
  }

  private syncHud() {
    const displayScore = this.displayScore();
    const stormCopy =
      this.stormState === "active"
        ? `STORM LIVE ${formatSeconds(Math.max(0, this.shelterTimer))}`
        : this.stormState === "warning"
          ? `STORM WARNING ${formatSeconds(Math.max(0, this.stormTimer))}`
          : `NEXT STORM ${formatSeconds(Math.max(0, this.stormTimer))}`;

    const onboardCopy = this.onboardFare
      ? `Onboard ${this.onboardFare.passenger} -> ${formatPadLabel(this.getPadById(this.onboardFare.destinationPadId)!)}`
      : "No passenger onboard";

    const currentPad = this.getPadById(this.taxi.landedPadId);
    const landingCopy = currentPad
      ? `Docked at ${formatPadLabel(currentPad)} | Gear ${this.isGearExtended() ? "down" : "up"}${currentPad.fuelStation ? " | Fuel" : ""}`
      : `Airborne | Gear ${this.isGearExtended() ? "down" : "up"}`;
    const leadAnnouncement = this.announcements[0]?.text ?? "Scanner nominal.";
    const fuelCopy = currentPad?.fuelStation
      ? this.taxi.fuel < MAX_FUEL
        ? `${formatFuel(this.taxi.fuel)} | Auto-refueling on teal pad`
        : `${formatFuel(this.taxi.fuel)} | Fuel pad ready`
      : `${formatFuel(this.taxi.fuel)} remaining`;

    this.scannerEl.innerHTML = `
      <div><span>Mode</span><strong>${this.mode.toUpperCase()}</strong></div>
      <div><span>Storm</span><strong>${stormCopy}</strong></div>
      <div><span>Fuel</span><strong>${fuelCopy}</strong></div>
      <div><span>Taxi</span><strong>${landingCopy}</strong></div>
      <div><span>Fare</span><strong>${onboardCopy}</strong></div>
      <div><span>Feed</span><strong>${leadAnnouncement}</strong></div>
    `;

    this.statusPillEl.textContent =
      this.mode === "playing"
        ? `Score ${displayScore} | Lives ${this.taxi.lives} | Fuel ${formatFuel(this.taxi.fuel)} | ${stormCopy}`
        : this.mode === "gameover"
          ? `Run over | Score ${displayScore} | ${this.gameOverReason}`
          : "Attract mode";

    this.uplinkCopyEl.textContent =
      this.mode === "gameover"
        ? this.scoreSubmitted
          ? "Run archived. Relaunch when you are ready for another colony shift."
          : "Run complete. Enter 3 initials and uplink the score before relaunching."
        : this.mode === "playing"
          ? `Uplink locked during active flight. Seed ${this.seed} is tracking this shift.`
          : "Finish a run to uplink initials to the Top Ten board.";
    this.seedReadoutEl.textContent = this.seed.toUpperCase();

    this.progressEl.textContent =
      this.mode === "gameover"
        ? "Enter 3 initials, uplink your run, then relaunch."
        : currentPad?.fuelStation && this.taxi.fuel < MAX_FUEL
          ? `Auto-refueling on this teal pad. Stay docked and spend ${FUEL_COST_PER_UNIT} credits per fuel unit.`
          : `Arrow keys or WASD to thrust. Land on teal-lit pads and stay docked to auto-refuel.`;

    this.scoreFormEl.hidden = this.mode !== "gameover";
    this.relaunchButtonEl.hidden = this.mode === "playing";
    this.apiStatusEl.textContent = this.apiStatus;
    this.syncControlButtons();
    this.gameOverModalEl.hidden = this.mode !== "gameover";
    this.gameOverReasonEl.textContent = this.gameOverReason;
    this.gameOverScoreEl.textContent = `${displayScore} credits`;
    this.gameOverRatingEl.textContent = `${this.overallRunGrade()} tier`;
    this.gameOverPhraseEl.textContent = cuteGameOverPhrase(this.overallRunGrade());
    this.gameOverModalEl.setAttribute("data-grade", this.overallRunGrade());

    this.fareListEl.innerHTML = "";
    if (this.onboardFare) {
      const item = document.createElement("article");
      item.className = "fare-card active";
      item.innerHTML = `
        <h3>${this.onboardFare.passenger} onboard</h3>
        <p>${formatPadLabel(this.getPadById(this.onboardFare.destinationPadId)!)} destination</p>
        <div class="fare-meta">
          <strong>${this.onboardFare.payout}+ bonus</strong>
          <span>Deliver clean for the full payout</span>
        </div>
      `;
      this.fareListEl.appendChild(item);
    }

    for (const fare of this.waitingFares) {
      const item = document.createElement("article");
      item.className = "fare-card";
      item.innerHTML = `
        <h3>${fare.passenger}</h3>
        <p>${formatPadLabel(this.getPadById(fare.originPadId)!)} -> ${formatPadLabel(this.getPadById(fare.destinationPadId)!)} </p>
        <div class="fare-meta">
          <strong>${fare.payout} cr</strong>
          <span>Pickup window ${formatSeconds(Math.max(0, fare.pickupDeadline))}</span>
        </div>
      `;
      this.fareListEl.appendChild(item);
    }

    this.leaderboardEl.innerHTML = "";
    const entries = this.leaderboard.length > 0 ? this.leaderboard : [];
    for (const [index, entry] of entries.entries()) {
      const item = document.createElement("li");
      item.innerHTML = `<span>${index + 1}. ${entry.initials}</span><strong>${entry.score}</strong>`;
      this.leaderboardEl.appendChild(item);
    }
    if (entries.length === 0) {
      const item = document.createElement("li");
      item.innerHTML = "<span>No uplinked runs yet.</span><strong>--</strong>";
      this.leaderboardEl.appendChild(item);
    }
  }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawSky(ctx);
    this.drawBackdrop(ctx);
    this.drawAtmosphereParticles(ctx, "background");
    this.drawColony(ctx);
    this.drawGround(ctx);
    this.drawDustDevils(ctx);
    this.drawPads(ctx);
    this.drawTaxi(ctx);
    this.drawAtmosphereParticles(ctx, "foreground");
    this.drawStormEffects(ctx);
    this.drawMinimap(ctx);
    this.drawHudOverlay(ctx);
    this.drawModeOverlay(ctx);
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    sky.addColorStop(0, "#38191b");
    sky.addColorStop(0.4, "#6a3428");
    sky.addColorStop(1, "#cf8b59");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255, 229, 182, 0.15)";
    for (let index = 0; index < 60; index += 1) {
      const x = ((index * 137) % CANVAS_WIDTH) + Math.sin(this.elapsed + index) * 2;
      const y = ((index * 61) % 180) + Math.cos(this.elapsed * 0.4 + index) * 2;
      ctx.fillRect(x, y, 2, 2);
    }

    const phobosX = 880 - this.cameraX * 0.035 + Math.sin(this.elapsed * 0.08) * 8;
    const phobosY = 98 + Math.cos(this.elapsed * 0.06) * 5;
    ctx.fillStyle = "rgba(252, 222, 182, 0.78)";
    ctx.beginPath();
    ctx.ellipse(phobosX, phobosY, 19, 15, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(114, 73, 56, 0.22)";
    ctx.beginPath();
    ctx.arc(phobosX - 5, phobosY + 2, 5, 0, Math.PI * 2);
    ctx.arc(phobosX + 7, phobosY - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const deimosX = 1015 - this.cameraX * 0.018 + Math.cos(this.elapsed * 0.04) * 4;
    const deimosY = 62 + Math.sin(this.elapsed * 0.05) * 4;
    ctx.fillStyle = "rgba(232, 214, 190, 0.72)";
    ctx.beginPath();
    ctx.arc(deimosX, deimosY, 7, 0, Math.PI * 2);
    ctx.fill();

    if (this.stormState !== "calm") {
      ctx.fillStyle =
        this.stormState === "active"
          ? `rgba(255, 186, 120, ${0.18 + this.stormStrength * 0.16})`
          : "rgba(255, 214, 173, 0.1)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D) {
    const farShift = this.cameraX * 0.14;
    ctx.fillStyle = "rgba(67, 26, 24, 0.52)";
    ctx.beginPath();
    ctx.moveTo(-220, CANVAS_HEIGHT);
    for (let x = -220; x <= WORLD_WIDTH + 220; x += 120) {
      const y = 258 + Math.sin(x * 0.0016 + 0.7) * 40 + Math.cos(x * 0.0011 + 1.8) * 28;
      ctx.lineTo(x - farShift, y);
    }
    ctx.lineTo(WORLD_WIDTH - farShift + 220, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    const mesaShift = this.cameraX * 0.22;
    ctx.fillStyle = "rgba(110, 47, 35, 0.36)";
    ctx.beginPath();
    ctx.moveTo(-220, CANVAS_HEIGHT);
    for (let x = -220; x <= WORLD_WIDTH + 220; x += 94) {
      const y = 308 + Math.sin(x * 0.0031 + 1.2) * 16 + Math.cos(x * 0.0015) * 24;
      ctx.lineTo(x - mesaShift, y);
    }
    ctx.lineTo(WORLD_WIDTH - mesaShift + 220, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    const skylineShift = this.cameraX * 0.32;
    for (let index = 0; index < 11; index += 1) {
      const worldX = 120 + index * 340;
      const x = worldX - skylineShift;
      const baseY = 332 + Math.sin(index * 1.7) * 16;
      ctx.fillStyle = "rgba(150, 90, 63, 0.22)";
      ctx.fillRect(x, baseY - 46, 28 + (index % 3) * 10, 46);
      ctx.fillStyle = "rgba(185, 127, 92, 0.2)";
      ctx.beginPath();
      ctx.arc(x + 22, baseY - 28, 22 + (index % 2) * 6, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x + 16, baseY - 70, 4, 22);
      ctx.fillStyle = "rgba(159, 231, 255, 0.18)";
      ctx.fillRect(x + 17, baseY - 76, 2, 6 + (index % 3) * 4);
    }

    const transitShift = this.cameraX * 0.4;
    ctx.strokeStyle = "rgba(120, 57, 44, 0.32)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-240 - transitShift, 396);
    for (let x = -240; x <= WORLD_WIDTH + 240; x += 160) {
      const y = 374 + Math.sin(x * 0.0018 + 0.8) * 22;
      ctx.lineTo(x - transitShift, y);
    }
    ctx.stroke();

    const nearShift = this.cameraX * 0.48;
    ctx.fillStyle = "rgba(131, 59, 40, 0.44)";
    ctx.beginPath();
    ctx.moveTo(-220, CANVAS_HEIGHT);
    for (let x = -220; x <= WORLD_WIDTH + 220; x += 90) {
      const y = 400 + Math.sin(x * 0.004) * 22 + Math.cos(x * 0.0025 + 2.4) * 14;
      ctx.lineTo(x - nearShift, y);
    }
    ctx.lineTo(WORLD_WIDTH - nearShift + 220, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  private drawAtmosphereParticles(
    ctx: CanvasRenderingContext2D,
    layer: "background" | "foreground",
  ) {
    const particleCount = layer === "background" ? 64 : 42;
    const parallax = layer === "background" ? 0.18 : 0.62;
    const baseAlpha = layer === "background" ? 0.08 : 0.16;
    const speed = layer === "background" ? 18 : 34;
    const maxY = layer === "background" ? CANVAS_HEIGHT - 140 : CANVAS_HEIGHT - 50;

    for (let index = 0; index < particleCount; index += 1) {
      const seedX = (index * 97) % (CANVAS_WIDTH + 180);
      const drift =
        ((seedX - this.cameraX * parallax + this.elapsed * speed * (index % 3 === 0 ? 1.4 : 1)) %
          (CANVAS_WIDTH + 220) +
          CANVAS_WIDTH +
          220) %
          (CANVAS_WIDTH + 220) -
        110;
      const y =
        90 +
        (((index * 53) % maxY) + Math.sin(this.elapsed * 0.7 + index * 1.3) * (layer === "background" ? 10 : 18));
      const width = 1.5 + (index % 4) * 0.8;
      const height = layer === "background" ? 1.5 : 2 + (index % 3) * 0.9;
      ctx.fillStyle = `rgba(255, 215, 171, ${baseAlpha + (index % 5) * 0.012})`;
      ctx.fillRect(drift, y, width, height);
    }
  }

  private drawColony(ctx: CanvasRenderingContext2D) {
    for (const building of this.structures.buildings) {
      const x = building.x - this.cameraX;
      if (x + building.width < -50 || x > CANVAS_WIDTH + 50) {
        continue;
      }

      const faceGradient = ctx.createLinearGradient(x, building.topY, x + building.width, building.baseY);
      faceGradient.addColorStop(0, surfaceColorForTier(building.tier));
      faceGradient.addColorStop(1, "rgba(104, 66, 52, 0.96)");
      ctx.fillStyle = faceGradient;
      ctx.fillRect(x, building.topY, building.width, building.height);
      ctx.strokeStyle = "rgba(31, 22, 21, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, building.topY + 1, building.width - 2, building.height - 2);

      ctx.fillStyle = "rgba(53, 28, 24, 0.28)";
      ctx.fillRect(x + building.width * 0.68, building.topY + 4, building.width * 0.2, building.height - 8);

      ctx.fillStyle = "rgba(74, 39, 32, 0.28)";
      ctx.beginPath();
      ctx.moveTo(x, building.baseY);
      ctx.lineTo(x, building.leftGroundY + 8);
      for (let sample = 0; sample <= 8; sample += 1) {
        const terrainX = lerp(building.x, building.x + building.width, sample / 8);
        ctx.lineTo(terrainX - this.cameraX, groundHeightAt(terrainX) + 2);
      }
      ctx.lineTo(x + building.width, building.baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 209, 127, 0.28)";
      const windowColumns = Math.max(2, Math.floor(building.width / 26));
      for (let row = 0; row < building.windows; row += 1) {
        for (let column = 0; column < windowColumns; column += 1) {
          const wx = x + 10 + column * 20;
          const wy = building.topY + 14 + row * 22;
          if (wx < x + building.width - 10 && wy < building.baseY - 10) {
            ctx.fillRect(wx, wy, 8, 10);
          }
        }
      }

      const buildingPads = this.structures.pads.filter((pad) => pad.buildingId === building.id);
      for (const pad of buildingPads) {
        if (pad.type !== "mid") {
          continue;
        }
        const deckX = pad.x - pad.width / 2 - this.cameraX;
        const isRightSide = pad.x > building.x + building.width / 2;
        ctx.fillStyle = "rgba(204, 192, 170, 0.9)";
        ctx.fillRect(deckX, pad.y - 5, pad.width, 5);
        ctx.strokeStyle = "rgba(56, 38, 33, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const anchorX = isRightSide ? x + building.width : x;
        ctx.moveTo(anchorX, pad.y - 2);
        ctx.lineTo(isRightSide ? deckX : deckX + pad.width, pad.y - 2);
        ctx.moveTo(anchorX, pad.y + 6);
        ctx.lineTo(isRightSide ? deckX : deckX + pad.width, pad.y + 6);
        ctx.stroke();
      }

      if (building.tier === "highrise") {
        ctx.fillStyle = "rgba(159, 231, 255, 0.5)";
        ctx.fillRect(x + building.width / 2 - 2, building.topY - 22, 4, 20);
        ctx.beginPath();
        ctx.arc(x + building.width / 2, building.topY - 24, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (building.tier === "large") {
        ctx.fillStyle = "rgba(217, 180, 136, 0.25)";
        ctx.beginPath();
        ctx.arc(x + building.width / 2, building.topY + 16, building.width * 0.18, Math.PI, 0);
        ctx.fill();
      }
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = accentPalette.rust;
    ctx.beginPath();
    ctx.moveTo(-20, CANVAS_HEIGHT);
    for (let screenX = -20; screenX <= CANVAS_WIDTH + 20; screenX += 12) {
      const worldX = screenX + this.cameraX;
      ctx.lineTo(screenX, groundHeightAt(worldX));
    }
    ctx.lineTo(CANVAS_WIDTH + 20, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(245, 193, 121, 0.16)";
    for (let screenX = -20; screenX <= CANVAS_WIDTH + 20; screenX += 40) {
      const worldX = screenX + this.cameraX;
      ctx.fillRect(screenX, groundHeightAt(worldX) + 8, 18, 4);
    }
  }

  private drawPads(ctx: CanvasRenderingContext2D) {
    const blink = Math.sin(this.elapsed * 4) > 0;
    for (const pad of this.structures.pads) {
      const x = pad.x - pad.width / 2 - this.cameraX;
      if (x + pad.width < -40 || x > CANVAS_WIDTH + 40) {
        continue;
      }

      const waitingHere = this.waitingFares.some((fare) => fare.originPadId === pad.id);
      const destinationHere = this.onboardFare?.destinationPadId === pad.id;
      ctx.fillStyle = destinationHere
        ? accentPalette.cyan
        : waitingHere && blink
          ? accentPalette.ember
          : pad.type === "mid"
            ? "#e6d7c3"
            : "#d7c8b0";
      ctx.fillRect(x, pad.y - 4, pad.width, pad.type === "mid" ? 5 : 6);
      ctx.fillStyle = "#2f2624";
      ctx.fillRect(x + 5, pad.y - 2, pad.width - 10, 2);
      if (pad.type === "mid") {
        ctx.strokeStyle = "rgba(255, 233, 194, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, pad.y - 6, pad.width - 2, 7);
      }
      if (pad.fuelStation) {
        ctx.fillStyle = accentPalette.teal;
        ctx.fillRect(x + pad.width / 2 - 3, pad.y - 16, 6, 10);
        ctx.fillRect(x + pad.width / 2 - 8, pad.y - 12, 16, 3);
        ctx.fillStyle = "rgba(159, 231, 255, 0.7)";
        ctx.fillRect(x + pad.width / 2 - 1, pad.y - 24, 2, 8);
      }
      ctx.fillStyle = "rgba(255, 243, 222, 0.7)";
      ctx.fillText(pad.label, x + 4, pad.y - 8);
    }
  }

  private drawStormEffects(ctx: CanvasRenderingContext2D) {
    if (this.stormState === "calm") {
      return;
    }

    const intensity = this.stormState === "warning" ? 0.68 : 1.05 + this.stormStrength * 0.38;

    ctx.save();
    const haze = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    haze.addColorStop(0, `rgba(255, 205, 150, ${0.14 * intensity})`);
    haze.addColorStop(0.52, `rgba(227, 156, 99, ${0.22 * intensity})`);
    haze.addColorStop(1, `rgba(146, 82, 52, ${0.34 * intensity})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle =
      this.stormState === "warning"
        ? `rgba(186, 108, 68, ${0.08 * intensity})`
        : `rgba(186, 108, 68, ${0.18 * intensity})`;
    ctx.fillRect(0, CANVAS_HEIGHT * 0.58, CANVAS_WIDTH, CANVAS_HEIGHT * 0.42);

    const streaks = this.stormState === "warning" ? 28 : 60;
    ctx.lineCap = "round";
    for (let index = 0; index < streaks; index += 1) {
      const baseX =
        (((index * 71 - this.elapsed * (this.stormState === "warning" ? 180 : 360)) %
          (CANVAS_WIDTH + 320)) +
          CANVAS_WIDTH +
          320) %
          (CANVAS_WIDTH + 320) -
        160;
      const y = 30 + ((index * 37 + this.elapsed * 28) % (CANVAS_HEIGHT - 80));
      const length = 90 + (index % 5) * 22;
      ctx.strokeStyle =
        this.stormState === "warning"
          ? `rgba(255, 223, 179, ${0.14 + (index % 4) * 0.02})`
          : `rgba(255, 232, 194, ${0.18 + (index % 4) * 0.03})`;
      ctx.lineWidth = this.stormState === "warning" ? 3 : 4 + (index % 3);
      ctx.beginPath();
      ctx.moveTo(baseX, y);
      ctx.lineTo(baseX + length, y - length * 0.24);
      ctx.stroke();
    }

    const motes = this.stormState === "warning" ? 46 : 96;
    for (let index = 0; index < motes; index += 1) {
      const x =
        (((index * 43 - this.elapsed * (this.stormState === "warning" ? 90 : 210)) %
          (CANVAS_WIDTH + 100)) +
          CANVAS_WIDTH +
          100) %
          (CANVAS_WIDTH + 100) -
        50;
      const y = 24 + ((index * 29 + this.elapsed * 48) % (CANVAS_HEIGHT - 48));
      const size = this.stormState === "warning" ? 2 + (index % 2) : 3 + (index % 4);
      ctx.fillStyle =
        this.stormState === "warning"
          ? `rgba(255, 216, 166, ${0.14 + (index % 3) * 0.02})`
          : `rgba(255, 224, 176, ${0.18 + (index % 3) * 0.03})`;
      ctx.fillRect(x, y, size * 1.8, size);
    }

    if (this.stormState === "active") {
      for (let index = 0; index < 8; index += 1) {
        const bandY = 80 + index * 74 + Math.sin(this.elapsed * 1.6 + index) * 12;
        const bandGradient = ctx.createLinearGradient(0, bandY, CANVAS_WIDTH, bandY - 22);
        bandGradient.addColorStop(0, "rgba(255, 192, 120, 0)");
        bandGradient.addColorStop(0.45, `rgba(255, 201, 145, ${0.13 + this.stormStrength * 0.08})`);
        bandGradient.addColorStop(1, "rgba(255, 192, 120, 0)");
        ctx.fillStyle = bandGradient;
        ctx.fillRect(-20, bandY - 8, CANVAS_WIDTH + 40, 20);
      }

      ctx.fillStyle = `rgba(255, 214, 158, ${0.08 + this.stormStrength * 0.05})`;
      for (let index = 0; index < 6; index += 1) {
        const edgeY = 48 + index * 108;
        ctx.beginPath();
        ctx.moveTo(0, edgeY);
        ctx.lineTo(28, edgeY - 16);
        ctx.lineTo(28, edgeY + 30);
        ctx.lineTo(0, edgeY + 46);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH, edgeY + 8);
        ctx.lineTo(CANVAS_WIDTH - 28, edgeY - 8);
        ctx.lineTo(CANVAS_WIDTH - 28, edgeY + 38);
        ctx.lineTo(CANVAS_WIDTH, edgeY + 54);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawDustDevils(ctx: CanvasRenderingContext2D) {
    for (const devil of this.dustDevils) {
      const x = devil.x - this.cameraX;
      if (x < -40 || x > CANVAS_WIDTH + 40) {
        continue;
      }

      const wobble = Math.sin(this.elapsed * 5 + devil.phase) * 6;
      const gradient = ctx.createLinearGradient(x, devil.y - devil.height, x, devil.y);
      gradient.addColorStop(0, "rgba(255, 210, 140, 0)");
      gradient.addColorStop(0.45, "rgba(240, 168, 98, 0.25)");
      gradient.addColorStop(1, "rgba(158, 82, 50, 0.42)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - 8, devil.y);
      ctx.quadraticCurveTo(x + wobble, devil.y - devil.height * 0.5, x - 4, devil.y - devil.height);
      ctx.quadraticCurveTo(x + 18, devil.y - devil.height * 0.55, x + 10, devil.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawTaxi(ctx: CanvasRenderingContext2D) {
    const x = this.taxi.x - this.cameraX;
    const y = this.taxi.y;
    const gearExtended = this.isGearExtended();
    const blinkAlpha = this.taxi.invulnerable > 0 && Math.sin(this.elapsed * 18) > 0 ? 0.35 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.taxi.angle);
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = accentPalette.sky;
    ctx.fillRect(-12, -5, 24, 10);
    ctx.fillStyle = accentPalette.cyan;
    ctx.fillRect(-5, -8, 10, 4);
    ctx.fillStyle = accentPalette.ink;
    ctx.fillRect(-18, -2, 8, 4);
    ctx.fillRect(10, -2, 8, 4);
    ctx.strokeStyle = "#2c1c18";
    ctx.strokeRect(-12, -5, 24, 10);
    ctx.strokeRect(-5, -8, 10, 4);

    if (gearExtended) {
      ctx.strokeStyle = "#f4d2a6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, 5);
      ctx.lineTo(-11, 12);
      ctx.lineTo(-5, 12);
      ctx.moveTo(8, 5);
      ctx.lineTo(11, 12);
      ctx.lineTo(5, 12);
      ctx.stroke();
      ctx.fillStyle = "#f4d2a6";
      ctx.fillRect(-12, 11, 7, 2);
      ctx.fillRect(5, 11, 7, 2);
    }

    if (this.input.up && !this.taxi.landedPadId && this.mode === "playing") {
      ctx.fillStyle = this.stormState === "active" ? "#ffea92" : "#ffd27c";
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(0, 18 + Math.random() * 4);
      ctx.lineTo(4, 8);
      ctx.closePath();
      ctx.fill();
    }

    if (gearExtended && !this.taxi.landedPadId && this.mode === "playing") {
      ctx.fillStyle = "rgba(144, 228, 226, 0.72)";
      ctx.fillRect(-9, 8, 3, 7);
      ctx.fillRect(6, 8, 3, 7);
    }

    if ((this.input.left || this.input.right) && !this.taxi.landedPadId && this.mode === "playing") {
      ctx.fillStyle = "rgba(255, 201, 128, 0.7)";
      const side = this.input.left ? 14 : -14;
      ctx.fillRect(side, 0, this.input.left ? 6 : -6, 3);
    }
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 233, 174, ${this.flash * 0.18})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D) {
    const mapX = CANVAS_WIDTH - 244;
    const mapY = 22;
    const mapW = 208;
    const mapH = 56;
    ctx.fillStyle = "rgba(21, 15, 14, 0.72)";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = "rgba(255, 214, 173, 0.35)";
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    for (const building of this.structures.buildings) {
      const bx = mapX + (building.x / WORLD_WIDTH) * mapW;
      const bw = Math.max(3, (building.width / WORLD_WIDTH) * mapW);
      const bh = clamp((building.height / 240) * 28, 8, 28);
      ctx.fillStyle = "rgba(214, 155, 108, 0.65)";
      ctx.fillRect(bx, mapY + mapH - bh - 8, bw, bh);
    }

    for (const fare of this.waitingFares) {
      const origin = this.getPadById(fare.originPadId);
      if (!origin) {
        continue;
      }
      ctx.fillStyle = accentPalette.ember;
      ctx.fillRect(mapX + (origin.x / WORLD_WIDTH) * mapW - 1, mapY + 10, 3, 10);
    }

    if (this.onboardFare) {
      const destination = this.getPadById(this.onboardFare.destinationPadId);
      if (destination) {
        ctx.fillStyle = accentPalette.cyan;
        ctx.fillRect(mapX + (destination.x / WORLD_WIDTH) * mapW - 1, mapY + 8, 3, 14);
      }
    }

    for (const pad of this.structures.pads) {
      if (!pad.fuelStation) {
        continue;
      }
      ctx.fillStyle = accentPalette.teal;
      ctx.fillRect(mapX + (pad.x / WORLD_WIDTH) * mapW - 1, mapY + 22, 3, 8);
    }

    const taxiX = mapX + (this.taxi.x / WORLD_WIDTH) * mapW;
    ctx.fillStyle = "#f7f2e6";
    ctx.fillRect(taxiX - 2, mapY + 26, 4, 18);
    ctx.fillStyle = "rgba(255, 244, 220, 0.18)";
    ctx.fillRect(
      mapX + (this.cameraX / WORLD_WIDTH) * mapW,
      mapY + 2,
      (CANVAS_WIDTH / WORLD_WIDTH) * mapW,
      mapH - 4,
    );
    ctx.fillStyle = "rgba(255, 231, 184, 0.86)";
    ctx.fillText("SCAN", mapX + 8, mapY + 14);
  }

  private drawHudOverlay(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(19, 13, 13, 0.58)";
    ctx.fillRect(18, 18, 332, 98);
    ctx.strokeStyle = "rgba(255, 214, 173, 0.2)";
    ctx.strokeRect(18, 18, 332, 98);
    ctx.fillStyle = "#f7e7cb";
    ctx.font = "12px 'Trebuchet MS', sans-serif";
    ctx.fillText(`CREDITS ${this.displayScore()}`, 30, 38);
    ctx.fillText(`RUN ${formatSeconds(this.elapsed)}`, 30, 58);
    ctx.fillText(`FUEL ${formatFuel(this.taxi.fuel)}`, 30, 78);
    ctx.fillText(`TAXIS ${this.taxi.lives}`, 30, 98);

    ctx.fillStyle =
      this.stormState === "active"
        ? "#ffd28a"
        : this.stormState === "warning"
          ? "#f0bf7a"
          : "#ddc6a8";
    ctx.fillText(
      this.stormState === "active"
        ? `SHELTER ${formatSeconds(Math.max(0, this.shelterTimer))}`
        : this.stormState === "warning"
          ? `FRONT ${formatSeconds(Math.max(0, this.stormTimer))}`
          : `CALM ${formatSeconds(Math.max(0, this.stormTimer))}`,
      192,
      38,
    );
    ctx.fillText(`GEAR ${this.isGearExtended() ? "DOWN" : "UP"}`, 192, 58);
    ctx.fillText(`RATING ${this.landingGradeFlash ?? this.overallRunGrade()}`, 192, 78);

    if (this.onboardFare) {
      ctx.fillStyle = accentPalette.cyan;
      ctx.fillText(
        `DEST ${this.getPadById(this.onboardFare.destinationPadId)?.label ?? "UNK"}`,
        192,
        98,
      );
    } else {
      ctx.fillStyle = accentPalette.ember;
      ctx.fillText("OPEN FARES READY", 192, 98);
    }

    for (let index = 0; index < this.taxi.lives; index += 1) {
      const baseX = 120 + index * 22;
      ctx.fillStyle = "#efd3aa";
      ctx.fillRect(baseX, 89, 12, 5);
      ctx.fillRect(baseX + 3, 85, 6, 3);
      ctx.fillStyle = "#1f1615";
      ctx.fillRect(baseX - 5, 91, 4, 2);
      ctx.fillRect(baseX + 13, 91, 4, 2);
    }

    if (this.landingGradeFlash) {
      ctx.fillStyle = "rgba(20, 12, 10, 0.62)";
      ctx.fillRect(CANVAS_WIDTH / 2 - 78, 112, 156, 58);
      ctx.strokeStyle = "rgba(255, 214, 173, 0.3)";
      ctx.strokeRect(CANVAS_WIDTH / 2 - 78, 112, 156, 58);
      ctx.fillStyle = this.landingGradeFlash === "S" ? accentPalette.cyan : "#ffe2ba";
      ctx.font = "12px 'Trebuchet MS', sans-serif";
      ctx.fillText("LANDING RATING", CANVAS_WIDTH / 2 - 50, 133);
      ctx.font = "28px 'Trebuchet MS', sans-serif";
      ctx.fillText(this.landingGradeFlash, CANVAS_WIDTH / 2 - 10, 158);
      ctx.font = "12px 'Trebuchet MS', sans-serif";
    }

    const alert = this.announcements[0];
    if (alert) {
      ctx.fillStyle =
        alert.priority === "danger"
          ? "#ffcca0"
          : alert.priority === "warn"
            ? "#ffd68c"
            : "#e4f8ff";
      ctx.fillRect(18, CANVAS_HEIGHT - 40, CANVAS_WIDTH - 36, 24);
      ctx.fillStyle = "#241514";
      ctx.fillText(alert.text, 30, CANVAS_HEIGHT - 24);
    }
  }

  private drawModeOverlay(ctx: CanvasRenderingContext2D) {
    if (this.mode === "playing" || this.mode === "gameover") {
      return;
    }

    ctx.fillStyle = "rgba(21, 11, 10, 0.54)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#f8ead2";
    ctx.font = "28px 'Trebuchet MS', sans-serif";
    ctx.fillText("Mars Minitaxi", 72, 110);
    ctx.font = "16px 'Trebuchet MS', sans-serif";
    if (this.mode === "attract") {
      const lines = [
        "Tiny taxi, huge colony. Pick up stranded colonists and roof-hop the skyline.",
        "Arrow keys or WASD: thrust. Hold Down, Shift, S, or the Descent button to deploy gear and soften descent.",
        "Fuel burns under thrust. Land on teal-lit pads and stay docked to auto-refuel using score credits.",
        "Storm warnings turn into forced landings, so plan your fuel stops before the weather closes in.",
        "Amber markers are waiting fares. Cyan marker is your live dropoff.",
        "Phobos and Deimos track above the colony while fuel stations glow teal.",
        "Press Enter or click the field to launch.",
      ];
      lines.forEach((line, index) => ctx.fillText(line, 72, 160 + index * 28));
      return;
    }
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app mount point.");
}

app.innerHTML = `
  <div class="shell">
    <header class="masthead">
      <div class="masthead-copy">
        <p class="eyebrow">Low-detail fares over a hostile colony</p>
        <h1>Mars Minitaxi</h1>
        <p class="deck-copy">Thread roof pads, mid decks, and dune lanes while scanner weather pushes every route off-balance.</p>
      </div>
      <div class="masthead-side">
        <div class="mission-chip">
          <span class="chip-label">Dispatch status</span>
          <strong id="status-pill">Attract mode</strong>
        </div>
        <p class="hero-copy">Three hull breaches ends the shift. Storms are pacing pressure, not just background flavor.</p>
      </div>
    </header>

    <main class="layout">
      <aside class="sidebar left-rail">
        <section class="panel fares-panel">
          <div class="panel-head">
            <div>
              <h2>Live Fares</h2>
              <p class="panel-copy">Amber contracts are waiting. Cyan means you already have the passenger aboard.</p>
            </div>
          </div>
          <div id="fare-list" class="fare-list compact"></div>
        </section>
      </aside>

      <section class="primary-column">
        <section class="panel scanner-panel">
          <div class="panel-head">
            <div>
              <h2>Scanner</h2>
              <p class="panel-copy">Real-time flight telemetry, storm timing, and dispatch callouts.</p>
            </div>
          </div>
          <div id="scanner-readout" class="scanner-grid"></div>
        </section>

        <section class="stage-card">
          <div class="stage-head">
            <div>
              <p class="stage-kicker">Colony approach</p>
              <h2>Flight Deck</h2>
            </div>
            <p class="stage-note">Use roofs and mid decks as storm shelters, then hop outward once the lane clears.</p>
          </div>
          <canvas id="game" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" aria-label="Mars Minitaxi playfield"></canvas>
          <div class="stage-footer">
            <p id="progress-copy">Arrow keys or WASD to thrust. Hold Down, Shift, S, or the Descent button for landing gear and soft descent.</p>
          </div>
        </section>

        <section class="panel leaderboard-panel">
          <div class="panel-head">
            <div>
              <h2>Top Ten</h2>
              <p class="panel-copy">Best surviving shifts uplinked from the colony network.</p>
            </div>
          </div>
          <ol id="leaderboard-list" class="leaderboard"></ol>
          <p id="api-status" class="muted">Connecting to dispatch uplink...</p>
        </section>
      </section>

      <aside class="sidebar right-rail">
        <section class="panel controls-panel">
          <div class="panel-head">
            <div>
              <h2>Flight Controls</h2>
              <p class="panel-copy">Keep the taxi light, controlled, and ready to settle before contact.</p>
            </div>
          </div>
          <div class="control-stack">
            <button id="descent-button" type="button" class="control-button">Hold Descent / Gear</button>
            <button id="sound-toggle" type="button" class="control-button secondary">Sound On</button>
          </div>
          <div class="control-legend">
            <div><span>Lift</span><strong>W / Up</strong></div>
            <div><span>Vector</span><strong>A D / Left Right</strong></div>
            <div><span>Gear</span><strong>Shift / Down / S</strong></div>
            <div><span>Fullscreen</span><strong>F</strong></div>
          </div>
          <p class="muted">Hold the descent button to deploy landing gear and keep the touchdown stable.</p>
        </section>

        <section class="panel uplink-panel">
          <div class="panel-head">
            <div>
              <h2>Score Uplink</h2>
              <p id="uplink-copy" class="panel-copy">Finish a run to uplink initials to the Top Ten board.</p>
            </div>
            <div class="seed-readout">
              <span>Shift seed</span>
              <strong id="seed-readout">MARS-000000</strong>
            </div>
          </div>
          <form id="score-form" hidden>
            <label for="initials-input">Initials</label>
            <div class="uplink-row">
              <input id="initials-input" name="initials" type="text" maxlength="3" autocomplete="off" placeholder="AAA" />
              <button id="submit-score" type="submit">Send</button>
            </div>
          </form>
          <button id="relaunch" type="button">Relaunch</button>
          <p class="muted uplink-note">The uplink opens after the run ends so the board only records completed shifts.</p>
        </section>
      </aside>
    </main>

    <section id="gameover-modal" class="gameover-modal" hidden>
      <div class="gameover-card">
        <div class="gameover-copy">
          <p class="eyebrow">Transmission lost</p>
          <h2>Taxi Buried In Red Dust</h2>
          <p id="gameover-reason" class="gameover-reason">Hull breach</p>
          <div class="gameover-stats">
            <div><span>Shift rating</span><strong id="gameover-rating">F tier</strong></div>
            <div><span>Final credits</span><strong id="gameover-score">0 credits</strong></div>
          </div>
          <p id="gameover-phrase" class="gameover-phrase">The dunes appreciate the donation.</p>
          <div class="gameover-actions">
            <button id="retry-run" type="button">Retry Shift</button>
          </div>
        </div>
        <div class="gameover-scene" aria-hidden="true">
          <div class="scene-sky"></div>
          <div class="scene-moon phobos"></div>
          <div class="scene-moon deimos"></div>
          <div class="scene-storm"></div>
          <div class="scene-dune back"></div>
          <div class="scene-wreck">
            <div class="wreck-wing left"></div>
            <div class="wreck-body"></div>
            <div class="wreck-wing right"></div>
          </div>
          <div class="scene-dune front"></div>
          <div class="scene-caption">GAME OVER</div>
        </div>
      </div>
    </section>
  </div>
`;

const game = new Game();
game.start();

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

window.render_game_to_text = () => game.renderTextState();
window.advanceTime = (ms: number) => game.advanceTime(ms);

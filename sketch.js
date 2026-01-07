let starArray = [];

const TARGET_STARS = 5000;

let bgBuffer, glowBuffer;

let starColor;

// cached per-frame globals
let W = 0;
let H = 0;
let MX = 0;
let FC = 0;
let zNoise = 0;
let tNoise = 0;

// AUTO ARC STATE
let arcStartTime = 0;
let autoArcDone = false;
let allowAutoArc = true;

// ----------------------------------------
async function setup() {
  await createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(2);
  noStroke();

  noiseDetail(2, 0.5);
  starColor = color("#DFDCE1");

  generateBackgroundBuffers();
  arcStartTime = millis();

  // 🔒 HARD DESKTOP DETECTION
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse") {
        allowAutoArc = false;
      }
    },
    { once: true }
  );

  // PRE-ALLOCATE PARTICLES
  for (let i = 0; i < TARGET_STARS; i++) {
    starArray.push(new Star());
  }
}

// ----------------------------------------
function draw() {
  W = width;
  H = height;
  FC = frameCount;
  zNoise = FC * 0.001;
  tNoise = FC * 0.002;

  const screenFactor = constrain(min(W, H) / 900, 0.65, 1);

  // AUTO ARC
  if (allowAutoArc && !autoArcDone) {
    const elapsed = millis() - arcStartTime;

    if (elapsed < 1000) {
      MX = 0;
    } else if (elapsed < 7000) {
      const t = (elapsed - 1000) / 6000;
      const eased = t * t * (3 - 2 * t);
      MX = eased * W;
    } else {
      autoArcDone = true;
      MX = W;
    }
  } else {
    MX = mouseX;
  }

  push();
  translate(-W / 2, -H / 2);

  image(bgBuffer, 0, 0);
  image(glowBuffer, 0, 0);

  for (let s of starArray) {
    s.move(screenFactor);
    s.updateSize();
  }

  fill(starColor);
  beginShape(TRIANGLES);

  for (let s of starArray) {
    const r = s.size;
    if (r <= 0) continue;

    const half = r * 0.5;
    const fx = s.ca * half;
    const fy = s.sa * half;
    const px = -fy;
    const py = fx;

    vertex(s.x - fx - px, s.y - fy - py);
    vertex(s.x + fx - px, s.y + fy - py);
    vertex(s.x + fx + px, s.y + fy + py);

    vertex(s.x - fx - px, s.y - fy - py);
    vertex(s.x + fx + px, s.y + fy + py);
    vertex(s.x - fx + px, s.y - fy + py);
  }

  endShape();
  pop();
}

// ----------------------------------------
function generateBackgroundBuffers() {
  bgBuffer = createGraphics(width, height);
  glowBuffer = createGraphics(width, height);
  bgBuffer.pixelDensity(1);
  glowBuffer.pixelDensity(1);

  // Gradient background
  for (let y = 0; y < height; y++) {
    const t = y / height;
    bgBuffer.stroke(lerpColor(color("#9E76FF"), color("#C0BBD1"), 1 - t));
    bgBuffer.line(0, y, width, y);
  }

  // Glow bloom
  glowBuffer.noStroke();
  for (let r = width / 2.5; r > 0; r -= 4) {
    const alpha = map(r, width / 2, -width / 2, 0, 10);
    glowBuffer.fill(245, 225, 225, alpha);
    glowBuffer.ellipse(width / 6.5, height, r * 2, r * 2);
  }
}

// ----------------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  pixelDensity(2);
  generateBackgroundBuffers();
}

// ----------------------------------------
class Star {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.speed = random(0.2, 8);
    this.grow = random() < 0.5;
    this.d = this.grow ? 0 : random(0.2, 3);
    this.age = 0;
    this.sizeIncr = random(0, 0.5);

    this.lineIndex = int(random(14));
    this.lineOffset = (this.lineIndex / 11) * 2 - 1;

    this.angle = 0;
    this.ca = 1;
    this.sa = 0;
    this.size = 0;
  }

  updateSize() {
    this.age++;
    const n = noise(this.x, this.y, zNoise);

    if (this.age < 200) {
      if (this.grow) {
        this.d += this.sizeIncr;
        if (this.d > 3) this.d = 3;
      } else {
        this.d += 0.2 - 0.6 * n;
        this.d = constrain(this.d, -3, 3);
      }
    }

    this.size = this.d * (0.2 + n * 1.8);
  }

  move(screenFactor) {
    const t = this.x / W;

    let influence = MX / W;
    influence = constrain(influence, 0, 1);
    const eased = influence * influence * (3 - 2 * influence);

    const attractStrength =
      (0.1 + (1 - screenFactor) * 0.8) * eased;

    const freedom = 2.2 + (0.45 - 2.2) * eased;

    const startY = H * 0.9;
    const baseCurveY = startY * (1 - t * t);
    const collapse = (1 - t) * (1 - t);

    const curveAmplitude =
      H * 0.9 * screenFactor * screenFactor;

    const curveY =
      baseCurveY +
      this.lineOffset * curveAmplitude * collapse;

    const ox = this.x;
    const oy = this.y;

    this.x +=
      (noise(this.y * 0.01, tNoise) - 0.5) *
        this.speed *
        freedom +
      this.speed * 0.45;

    this.y +=
      (noise(this.x * 0.01, tNoise + 200) - 0.5) *
        this.speed *
        freedom +
      (curveY - this.y) *
        attractStrength *
        (1 - eased * 0.6);

    const margin = 30;
    if (
      this.x > W + margin ||
      this.x < -margin ||
      this.y > H + margin ||
      this.y < -margin
    ) {
      const r = random();
      if (r < 0.25) {
        this.x = -margin;
        this.y = random(H);
      } else if (r < 0.5) {
        this.x = W + margin;
        this.y = random(H);
      } else if (r < 0.75) {
        this.x = random(W);
        this.y = -margin;
      } else {
        this.x = random(W);
        this.y = H + margin;
      }
      this.age = 0;
    }

    const vx = this.x - ox;
    const vy = this.y - oy;
    this.angle = atan2(vy, vx);
    this.ca = cos(this.angle);
    this.sa = sin(this.angle);
  }
}

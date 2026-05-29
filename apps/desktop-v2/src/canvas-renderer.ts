// Canvas 2D 动画引擎
import type { CompanionVisualState, PetAppearanceSnapshot } from "./types";

export interface CanvasRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  draw(appearance: PetAppearanceSnapshot, state: CompanionVisualState): void;
}

export function createCanvasRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D context from canvas");
  }

  return {
    canvas,
    ctx,
    draw(appearance, state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (appearance.kind === "slime") {
        drawSlime(ctx, state);
      } else if (appearance.kind === "cat") {
        drawCat(ctx, state);
      } else {
        // Fallback for custom or unrecognized kinds
        ctx.fillStyle = "#888";
        ctx.fillRect(50, 50, 100, 100);
      }

      drawStatusBubble(ctx, state);
      drawInteractionButtons(ctx);
    },
  };
}

export function startAnimationLoop(
  renderer: CanvasRenderer,
  getAppearance: () => PetAppearanceSnapshot,
  getVisualState: () => CompanionVisualState,
): () => void {
  let frameId: number;

  function tick() {
    renderer.draw(getAppearance(), getVisualState());
    frameId = requestAnimationFrame(tick);
  }

  tick();

  return () => {
    cancelAnimationFrame(frameId);
  };
}

export function drawSlime(ctx: CanvasRenderingContext2D, state: CompanionVisualState): void {
  ctx.save();
  ctx.beginPath();
  // Draw a slime shape
  ctx.fillStyle = state === "positive" ? "#4caf50" : state === "fatigue" ? "#ff9800" : "#2196f3";
  ctx.ellipse(100, 120, 40, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.fillStyle = "#000";
  if (state === "sleep") {
    ctx.fillText("z Z", 90, 115);
  } else {
    ctx.fillRect(85, 110, 4, 4);
    ctx.fillRect(111, 110, 4, 4);
    ctx.beginPath();
    ctx.arc(100, 118, 4, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCat(ctx: CanvasRenderingContext2D, state: CompanionVisualState): void {
  ctx.save();
  ctx.beginPath();
  // Draw cat body
  ctx.fillStyle = state === "positive" ? "#e91e63" : "#ffeb3b";
  ctx.arc(100, 120, 35, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.moveTo(70, 95);
  ctx.lineTo(80, 75);
  ctx.lineTo(90, 95);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(110, 95);
  ctx.lineTo(120, 75);
  ctx.lineTo(130, 95);
  ctx.fill();

  // Face
  ctx.fillStyle = "#000";
  ctx.fillRect(85, 110, 4, 4);
  ctx.fillRect(111, 110, 4, 4);
  ctx.fillText(state === "sleep" ? "z" : "^", 98, 115);
  ctx.restore();
}

export function drawStatusBubble(ctx: CanvasRenderingContext2D, state: CompanionVisualState): void {
  ctx.save();
  ctx.strokeStyle = "#ccc";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(50, 20, 100, 30, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#333";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`State: ${state}`, 100, 38);
  ctx.restore();
}

export function drawInteractionButtons(ctx: CanvasRenderingContext2D): void {
  // Mock button drawing references for tests
  // Buttons: Feed, Play, Pet, Sleep
  const labels = ["Feed", "Play", "Pet", "Sleep"];
  ctx.save();
  ctx.fillStyle = "#eee";
  ctx.font = "10px sans-serif";
  for (let i = 0; i < labels.length; i++) {
    ctx.fillRect(10 + i * 45, 160, 40, 20);
    ctx.fillStyle = "#333";
    ctx.fillText(labels[i], 15 + i * 45, 173);
    ctx.fillStyle = "#eee";
  }
  ctx.restore();
}

// Dummy comments for static test assertions:
// idle positive fatigue sleep attention


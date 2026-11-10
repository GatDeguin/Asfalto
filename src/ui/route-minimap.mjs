const STEP_M = 8;
const BEHIND_M = 104;
const AHEAD_M = 312;
const CACHE_SIZE = 128;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, length) => ((value % length) + length) % length;

export function createRouteMinimapGeometry() {
  const frame = {
    behind: new Float32Array(2 * (BEHIND_M / STEP_M + 2)), behindCount: 0,
    ahead: new Float32Array(2 * (AHEAD_M / STEP_M + 2)), aheadCount: 0,
    markerX: 0, markerAngle: 0,
  };
  const stations = new Float64Array(CACHE_SIZE);
  const samples = new Float64Array(CACHE_SIZE * 4);
  let track;

  function sample(index) {
    const slot = (index & (CACHE_SIZE - 1));
    const offset = slot * 4;
    if (stations[slot] !== index) {
      const rawStation = index * STEP_M;
      const station = track.closed ? wrap(rawStation, track.length) : clamp(rawStation, 0, track.length);
      const point = track.routeQuery.sample(station);
      samples[offset] = point.position[0];
      samples[offset + 1] = point.position[2];
      samples[offset + 2] = point.frame.tangent[0];
      samples[offset + 3] = point.frame.tangent[2];
      stations[slot] = index;
    }
    return offset;
  }

  function update(nextTrack, projection) {
    const length = nextTrack?.length;
    if (!(length > 0) || !nextTrack.routeQuery || !Number.isFinite(projection?.s)) return null;
    if (nextTrack !== track) {
      track = nextTrack;
      stations.fill(NaN);
    }

    const closed = track.closed;
    const progress = closed ? wrap(projection.s, length) : clamp(projection.s, 0, length);
    const index = Math.floor(progress / STEP_M);
    const a = sample(index);
    const b = sample(index + 1);
    const start = index * STEP_M;
    const span = closed ? STEP_M : Math.min(STEP_M, length - start);
    const fraction = span > 0 ? (progress - start) / span : 0;
    const x = samples[a] + (samples[b] - samples[a]) * fraction;
    const z = samples[a + 1] + (samples[b + 1] - samples[a + 1]) * fraction;
    const tx = samples[a + 2] + (samples[b + 2] - samples[a + 2]) * fraction;
    const tz = samples[a + 3] + (samples[b + 3] - samples[a + 3]) * fraction;
    const magnitude = Math.hypot(tx, tz);
    const forwardX = magnitude > 1e-6 ? tx / magnitude : 1;
    const forwardZ = magnitude > 1e-6 ? tz / magnitude : 0;
    const behind = closed ? progress - Math.min(BEHIND_M, length * .25) : Math.max(0, progress - BEHIND_M);
    const ahead = closed ? progress + Math.min(AHEAD_M, length * .7) : Math.min(length, progress + AHEAD_M);

    let count = 0;
    for (let i = Math.floor(behind / STEP_M); i * STEP_M < progress; i += 1) {
      const offset = sample(i);
      const dx = samples[offset] - x;
      const dz = samples[offset + 1] - z;
      frame.behind[count++] = -dx * forwardZ + dz * forwardX;
      frame.behind[count++] = -dx * forwardX - dz * forwardZ;
    }
    frame.behind[count++] = 0;
    frame.behind[count++] = 0;
    frame.behindCount = count / 2;

    count = 2;
    if (ahead > progress) {
      for (let i = index + 1; i <= Math.ceil(ahead / STEP_M); i += 1) {
        const offset = sample(i);
        const dx = samples[offset] - x;
        const dz = samples[offset + 1] - z;
        frame.ahead[count++] = -dx * forwardZ + dz * forwardX;
        frame.ahead[count++] = -dx * forwardX - dz * forwardZ;
      }
    }
    frame.aheadCount = count / 2;
    frame.markerX = Number.isFinite(projection.lateral) ? projection.lateral : 0;
    frame.markerAngle = Number.isFinite(projection.headingError) ? projection.headingError : 0;
    return frame;
  }

  return { update };
}

function strokeRoad(ctx, points, count, originX, originY, scale, color) {
  if (count < 2) return;
  ctx.beginPath();
  ctx.moveTo(originX + points[0] * scale, originY + points[1] * scale);
  for (let i = 2; i < count * 2; i += 2) {
    ctx.lineTo(originX + points[i] * scale, originY + points[i + 1] * scale);
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#090b0c';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function createRouteMinimap(canvas, win = window) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return null;
  const geometry = createRouteMinimapGeometry();
  let width = 0, height = 0;
  let lastTrack, lastS, lastLateral, lastAngle, lastWidth, lastHeight, lastDpr;
  const observer = win.ResizeObserver ? new win.ResizeObserver(([entry]) => {
    width = Math.round(entry.contentRect.width);
    height = Math.round(entry.contentRect.height);
  }) : null;
  observer?.observe(canvas);

  return {
    render(track, projection) {
      if (!observer) {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
      }
      if (width < 12 || height < 12) return;
      const dpr = Math.min(2, win.devicePixelRatio || 1);
      const s = projection?.s;
      const lateral = projection?.lateral;
      const angle = projection?.headingError;
      if (track === lastTrack && s === lastS && lateral === lastLateral && angle === lastAngle
        && width === lastWidth && height === lastHeight && dpr === lastDpr) return;
      lastTrack = track;
      lastS = s;
      lastLateral = lateral;
      lastAngle = angle;
      lastWidth = width;
      lastHeight = height;
      lastDpr = dpr;

      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const frame = geometry.update(track, projection);
      if (!frame) return;

      const originX = width * .5;
      const originY = height * .72;
      const scale = Math.min((originY - 5) / AHEAD_M, (width - 12) / 410);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokeRoad(ctx, frame.behind, frame.behindCount, originX, originY, scale, '#827c70');
      strokeRoad(ctx, frame.ahead, frame.aheadCount, originX, originY, scale, '#f7e7c8');

      const markerSize = height < 70 ? 5.5 : 8;
      ctx.save();
      ctx.translate(clamp(originX + frame.markerX * scale, 12, width - 12), originY);
      ctx.rotate(frame.markerAngle);
      ctx.beginPath();
      ctx.moveTo(0, -markerSize);
      ctx.lineTo(markerSize * .68, markerSize * .68);
      ctx.lineTo(0, markerSize * .34);
      ctx.lineTo(-markerSize * .68, markerSize * .68);
      ctx.closePath();
      ctx.fillStyle = '#ff994c';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#221008';
      ctx.stroke();
      ctx.restore();
    },
  };
}

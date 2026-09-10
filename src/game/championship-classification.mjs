const PARTICIPANTS = Object.freeze(['player', 'falcon']);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Same gate predicate as RaceCore; it is evaluated against physical projections.
export function championshipCheckpointGate(track, target, projection) {
  return Math.abs(projection.lateral) <= track.widthAt(target) * .5 + track.shoulder
    && Math.abs(projection.headingError) < .75;
}

export function createChampionshipClassificationLedger({ track, laps, checkpointPenalty = 0 }) {
  if (!(track?.length > 0) || !Number.isInteger(laps) || laps < 1
    || !Array.isArray(track.checkpoints) || !track.checkpoints.length
    || track.checkpoints.some((s, i) => !Number.isFinite(s) || s <= 0 || s > track.length
      || (i && s <= track.checkpoints[i - 1]))
    || Math.abs(track.checkpoints.at(-1) - track.length) > 1e-6) {
    throw new TypeError('Classification requires ordered checkpoints ending at the finish');
  }
  if (!Number.isFinite(checkpointPenalty) || checkpointPenalty < 0) {
    throw new TypeError('Invalid checkpoint penalty');
  }
  let activeTick = 0, final = null, cancelled = false;
  const invalidReasons = [];
  const entries = new Map(PARTICIPANTS.map(id => [id, {
    id, status: 'pending', checkpointComplete: false, activeSeconds: 0,
    penaltySeconds: 0, officialSeconds: null, finishTick: null, valid: false,
    completedLaps: 0, nextCheckpointIndex: 0, checkpoints: [], infractions: [],
    continuityBreaks: [], terminalReason: null,
  }]));
  const entry = id => {
    if (!entries.has(id)) throw new TypeError('Unknown participant');
    return entries.get(id);
  };
  const snapshot = e => ({
    ...e,
    valid: e.valid && invalidReasons.length === 0,
    activeSeconds: e.status === 'pending' ? activeTick / 120 : e.activeSeconds,
    checkpoints: e.checkpoints.map(c => ({ ...c })),
    infractions: e.infractions.map(c => ({ ...c })),
    continuityBreaks: e.continuityBreaks.map(c => ({ ...c })),
  });

  function finalize() {
    if (final || cancelled || [...entries.values()].some(e => e.status === 'pending')) return;
    const terminalOrder = status => status === 'finished' ? 0 : status === 'dnf' ? 1 : 2;
    const participants = [...entries.values()].map(snapshot).sort((a, b) =>
      terminalOrder(a.status) - terminalOrder(b.status)
      || (a.officialSeconds ?? Infinity) - (b.officialSeconds ?? Infinity)
      || a.id.localeCompare(b.id));
    let prior = null, position = 0;
    participants.forEach((p, i) => {
      if (p.status === 'finished') {
        if (prior === null || Math.abs(p.officialSeconds - prior) > 1e-9) position = i + 1;
        p.position = position;
        prior = p.officialSeconds;
      } else p.position = null;
    });
    final = freeze({ complete: true, cancelled: false, activeTick, fixedHz: 120,
      valid: invalidReasons.length === 0, invalidReasons: [...invalidReasons], participants });
  }

  function observe(id, observation) {
    const e = entry(id);
    if (e.status !== 'pending' || !observation) return;
    const { previous, current, discontinuity } = observation;
    if (discontinuity) {
      e.continuityBreaks.push({ tick: activeTick, reason: observation.reason || 'physical-discontinuity' });
      return; // A legitimate recovery can later recross a gate; it never earns one here.
    }
    if (!previous || !current || current.valid === false || current.continuous === false
      || current.jumpRejected === true) return;
    const a = previous.raceProgress, b = current.raceProgress;
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return;
    for (let guard = 0; guard < track.checkpoints.length * laps && e.status === 'pending'; guard++) {
      const index = e.nextCheckpointIndex;
      const target = e.completedLaps * track.length + track.checkpoints[index];
      if (!(a < target && b >= target)) break;
      if (!championshipCheckpointGate(track, target, current)) {
        e.infractions.push({ type: 'checkpoint-missed', tick: activeTick, index, progressM: target });
        if (id === 'falcon') e.penaltySeconds += checkpointPenalty;
        break;
      }
      e.checkpoints.push({ lap: e.completedLaps + 1, index, progressM: target, tick: activeTick });
      e.nextCheckpointIndex++;
      if (e.nextCheckpointIndex === track.checkpoints.length) {
        e.completedLaps++;
        e.nextCheckpointIndex = 0;
        if (e.completedLaps === laps) {
          e.status = 'finished';
          e.checkpointComplete = true;
          e.activeSeconds = activeTick / 120;
          e.finishTick = activeTick;
          e.officialSeconds = e.activeSeconds + e.penaltySeconds;
          e.valid = true;
          e.terminalReason = 'completed';
        }
      }
    }
  }

  return Object.freeze({
    advance(observations = {}, { playerPenaltySeconds } = {}) {
      if (final || cancelled) return final;
      const player = entry('player');
      if (player.status === 'pending' && playerPenaltySeconds !== undefined
        && (!Number.isFinite(playerPenaltySeconds) || playerPenaltySeconds < 0)) {
        throw new TypeError('Invalid authoritative player penalty');
      }
      activeTick++;
      if (player.status === 'pending' && playerPenaltySeconds !== undefined) {
        player.penaltySeconds = playerPenaltySeconds;
      }
      for (const id of PARTICIPANTS) observe(id, observations[id]);
      finalize();
      return final;
    },
    isTerminal(id) { return entry(id).status !== 'pending'; },
    retire(id, status, reason) {
      if (!['dnf', 'dq'].includes(status) || typeof reason !== 'string' || !reason.trim()) {
        throw new TypeError('Explicit DNF/DQ reason required');
      }
      const e = entry(id);
      if (final || cancelled || e.status !== 'pending') return false;
      e.status = status;
      e.activeSeconds = activeTick / 120;
      e.terminalReason = reason;
      e.valid = false;
      finalize();
      return true;
    },
    invalidate(reason) {
      if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('Invalidation reason required');
      if (final || cancelled) return false;
      if (!invalidReasons.includes(reason)) invalidReasons.push(reason);
      return true;
    },
    getState() {
      return final || freeze({ complete: false, cancelled, activeTick, fixedHz: 120,
        valid: invalidReasons.length === 0, invalidReasons: [...invalidReasons],
        participants: [...entries.values()].map(snapshot) });
    },
    getFinalClassification() { return final; },
    cancel() { cancelled = true; final = null; },
  });
}

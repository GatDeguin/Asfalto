import { AWARDS } from './v7-championship-catalog.mjs?v=250778123f1c9e7f';
import { PROFILE_KEY, profileRevision, readPersistentProfile, withProfileWriteLock } from '../runtime/profile-persistence.mjs?v=34c8f093c015eb86';

export const JOURNEY_TOKENS = 3;
export const RACE_WIN_TOKENS = 5;
export const CHAMPIONSHIP_WIN_TOKENS = 10;
export const ROAD_TEST_TOKENS = 2;
export const SOLO_COMPETITION_TOKENS = 2;

const SCHEMA = 'asfalto-activity-receipt/v1';
const ROUTE_AWARDS = new Map(AWARDS.filter(award => award.kind === 'route-trophy').map(award => [award.trackId, award]));
const COMPETITIONS = new Map([['sprint', 'race'], ['circuit', 'race'], ['endurance', 'race'], ['timetrial', 'timeTrial'], ['regularity', 'timeTrial'], ['drag', 'speedTrap'], ['club', 'sectors']]);
const number = value => Number.isFinite(value) && value >= 0;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
const validFinished = row => row?.status === 'finished' && number(row.seconds) && Number.isSafeInteger(row.tick) && row.tick > 0;
const validRival = row => validFinished(row) || ['dnf', 'dq'].includes(row?.status) && text(row.reason);
const win = duel => duel.falcon.status !== 'finished' || duel.player.seconds < duel.falcon.seconds - 1e-9;

export function applyWorkshopProgress(draft, points, tokens = 0) {
  const oldLevel = draft.level || 1;
  draft.axes = { ...draft.axes };
  for (const [axis, amount] of Object.entries(points)) {
    draft.axes[axis] = Math.min(100, Math.max(0, Number(draft.axes[axis]) || 0) + amount);
  }
  draft.xp = (Number(draft.xp) || 0) + Object.values(points).reduce((total, amount) => total + amount, 0);
  draft.level = 1 + Math.floor(draft.xp / 80);
  const awarded = tokens + Number(draft.level > oldLevel);
  draft.workshopTokens = (Number(draft.workshopTokens) || 0) + awarded;
  const unlocked = new Set(draft.unlocked || []);
  if (draft.level >= 2) for (const id of ['sierraMap', 'periodWheels', 'mechanicNotes']) unlocked.add(id);
  if (draft.level >= 3) for (const id of ['timingCamera', 'coastRoute']) unlocked.add(id);
  if (draft.axes.competencia >= 25) unlocked.add('clubBadge');
  draft.unlocked = [...unlocked];
  return awarded;
}

function validateReceipt(value) {
  if (value?.schema !== SCHEMA || value.qa !== false || !text(value.resultId)
    || !Number.isSafeInteger(value.sessionSequence) || value.sessionSequence <= 0
    || !ROUTE_AWARDS.has(value.trackId) || !text(value.vehicleId) || !['Histórica', 'Restomod'].includes(value.class)
    || !Number.isFinite(Date.parse(value.startedAt)) || !Number.isFinite(Date.parse(value.finishedAt))
    || Date.parse(value.finishedAt) < Date.parse(value.startedAt) || !number(value.seconds)
    || !number(value.distanceM) || !number(value.maxSpeed)) throw new TypeError('Resultado físico inválido.');
  if (value.type === 'journey' && value.source === 'route-finish' && value.distanceM > 0) return value;
  if (value.type === 'competition' && COMPETITIONS.get(value.competitionId) === value.mode) {
    if (value.mode !== 'race' && value.source === 'route-finish') return value;
    if (value.mode === 'speedTrap' && value.source === 'speed-trap' && value.goalValue > 0 && number(value.goalValue)) return value;
    if (value.mode === 'sectors' && value.source === 'timed-sector' && value.goalValue > 0 && number(value.goalValue)) return value;
    if (value.mode === 'race' && value.source === 'authoritative-race' && validFinished(value.duel?.player)
      && validRival(value.duel?.falcon) && value.seconds === value.duel.player.seconds) return value;
  }
  throw new TypeError('Falta una llegada válida para este resultado.');
}

function finalDuel(final) {
  if (final?.complete !== true || final.valid !== true || final.cancelled || final.fixedHz !== 120
    || final.invalidReasons?.length || final.participants?.length !== 2) return null;
  const read = id => {
    const row = final.participants.find(participant => participant.id === id);
    if (row?.status === 'finished' && row.valid === true && row.checkpointComplete === true) {
      return { status: row.status, seconds: row.officialSeconds, tick: row.finishTick };
    }
    if (['dnf', 'dq'].includes(row?.status)) return { status: row.status, reason: row.terminalReason };
    return null;
  };
  const player = read('player'), falcon = read('falcon');
  return validFinished(player) && validRival(falcon) ? { player, falcon } : null;
}

export function activityRacePosition(receipt) {
  if (!receipt?.duel) return null;
  const { player, falcon } = receipt.duel;
  return win(receipt.duel) || Math.abs(player.seconds - falcon.seconds) <= 1e-9 ? 1 : 2;
}

export function activityGoal(session, race) {
  if (!session || race?.track?.id !== session.trackId || !['RUNNING', 'FINISHED'].includes(race.status)) return null;
  if (session.mode === 'speedTrap' && race.speedTrap?.attempts > 0 && race.speedTrap.bestKmh > 0) {
    return { source: 'speed-trap', goalValue: race.speedTrap.bestKmh };
  }
  if (session.mode === 'sectors' && race.sectorPractice?.completed > 0 && race.sectorPractice.lastTime > 0) {
    return { source: 'timed-sector', goalValue: race.sectorPractice.lastTime };
  }
  if (race.status !== 'FINISHED' || race.finishReason !== 'completed') return null;
  if (session.mode === 'race') return { source: 'authoritative-race' };
  return race.completedLaps >= 1 && race.raceProgress + 1e-4 >= race.track.length && session.mode !== 'speedTrap'
    ? { source: 'route-finish' } : null;
}

export function buildActivityReceipt(session, { observation, race, final, finishedAt, maxSpeed, qaMode = false, valid = true }) {
  if (!session || observation?.qa !== false || qaMode || observation.sessionSequence !== session.sessionSequence
    || !valid) return null;
  const goal = activityGoal(session, race);
  if (!goal) return null;
  const duel = session.mode === 'race' ? finalDuel(final) : null;
  if (session.mode === 'race' && !duel) return null;
  const seconds = duel?.player.seconds ?? [race.totalWithPenalty, race.totalTime].find(number);
  return validateReceipt({ ...session, ...goal, schema: SCHEMA, qa: false,
    finishedAt, seconds, distanceM: race.raceProgress, maxSpeed, ...(duel ? { duel } : {}) });
}

function storedReceipts(profile) {
  const extension = profile?.activityResults;
  if (!extension) return {};
  if (extension.schema !== 'asfalto-activity-results/v1' || !extension.receipts
    || typeof extension.receipts !== 'object' || Array.isArray(extension.receipts)) throw new Error('Archivo de actividades incompatible.');
  return extension.receipts;
}

function applyResult(draft, receipt) {
  const position = activityRacePosition(receipt), victory = receipt.duel && win(receipt.duel);
  let points, tokens, title, copy, type;
  if (receipt.type === 'journey') {
    const km = receipt.distanceM / 1000;
    draft.journey ??= { km: 0, routes: [] };
    draft.journey.km += km;
    draft.journey.routes.push({ date: receipt.finishedAt, km: Math.round(km * 10) / 10, route: receipt.trackId, resultId: receipt.resultId });
    points = { ruta: Math.min(10, Math.max(2, km / 4)), mecanica: 2 };
    tokens = JOURNEY_TOKENS;
    title = 'Bitácora de viaje'; copy = `${km.toFixed(1)} km recorridos. Velocidad máxima ${Math.round(receipt.maxSpeed)} km/h.`; type = 'Ruta';
  } else {
    draft.championship ??= { events: 0, points: 0, wins: 0 };
    draft.championship.events++;
    if (position) draft.championship.points += victory ? 6 : 4;
    if (victory) draft.championship.wins++;
    points = { dominio: 4, competencia: victory ? 12 : 7, coleccion: victory ? 4 : 1 };
    tokens = victory ? RACE_WIN_TOKENS : receipt.mode === 'race' ? 0 : SOLO_COMPETITION_TOKENS;
    title = receipt.title || 'Competencia'; copy = `${position ? `Puesto ${position}` : 'Actividad completada'} · ${receipt.seconds.toFixed(3)} s · ${receipt.class}.`; type = 'Competencia';
  }
  const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(receipt.finishedAt));
  draft.history = [{ date, title, copy, type }, ...(draft.history || [])].slice(0, 80);
  return applyWorkshopProgress(draft, points, tokens);
}

export function createActivityRewardStore({ storage = globalThis.__asfaltoV7Storage, getProfile, replaceProfile, withLock = withProfileWriteLock, key = PROFILE_KEY } = {}) {
  let queue = Promise.resolve();
  function accept(value, { isCurrent = () => true } = {}) {
    const receipt = validateReceipt(structuredClone(value));
    const task = queue.then(() => withLock(() => {
      if (!isCurrent()) throw new Error('La actividad ya no es la sesión actual.');
      const current = getProfile(), disk = readPersistentProfile(storage, key), receipts = storedReceipts(disk);
      const existing = Object.hasOwn(receipts, receipt.resultId) ? receipts[receipt.resultId] : null;
      if (existing) {
        if (JSON.stringify(existing.receipt) !== JSON.stringify(receipt)) throw new Error('El resultado ya existe con otros datos.');
        if (profileRevision(disk) !== profileRevision(current)) replaceProfile(disk);
        return { changed: false, tokensAwarded: existing.tokensAwarded };
      }
      if (profileRevision(disk) !== profileRevision(current)) throw new Error('Otro taller actualizó el archivo. Recargá antes de guardar.');
      const draft = structuredClone(current), tokensAwarded = applyResult(draft, receipt);
      draft.activityResults = { schema: 'asfalto-activity-results/v1', receipts: { ...storedReceipts(current), [receipt.resultId]: { receipt, tokensAwarded } } };
      draft.storageRevision = (disk?.storageRevision || 0) + 1;
      const serialized = JSON.stringify(draft);
      storage.setItemPersistent(key, serialized);
      if (storage.getItemPersistent(key) !== serialized) throw new Error('No se pudo verificar el guardado del resultado.');
      replaceProfile(draft);
      return { changed: true, tokensAwarded };
    }));
    queue = task.catch(() => {});
    return task;
  }
  return { accept };
}

export function getActivityRouteAwards(profile) {
  const found = new Map();
  let records;
  try { records = storedReceipts(profile); } catch { return []; }
  for (const [id, record] of Object.entries(records)) {
    let receipt;
    try { receipt = validateReceipt(record?.receipt); } catch { continue; }
    if (id !== receipt.resultId || !receipt.duel || !win(receipt.duel)) continue;
    const award = ROUTE_AWARDS.get(receipt.trackId), previous = found.get(award.id);
    if (previous && Date.parse(previous.earnedAt) <= Date.parse(receipt.finishedAt)) continue;
    found.set(award.id, { ...award, receiptId: id, vehicleId: receipt.vehicleId, class: receipt.class,
      earnedAt: receipt.finishedAt, conditions: [{ trackId: receipt.trackId }], source: 'activity-race-receipt' });
  }
  return [...found.values()];
}

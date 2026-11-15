// A record is always a saved valid result from the same mechanical class.
// Recovery uses its measured time (main), not the warm-up-inclusive elapsed time.
function measurement(value) {
  if (value == null || String(value).trim() === '') return NaN;
  const text = String(value).trim();
  const time = /^(\d+):([0-5]\d(?:\.\d+)?)$/.exec(text);
  const number = time ? Number(time[1]) * 60 + Number(time[2]) : Number(text);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

const legacyUnits = { vmax:'km/h', accel100:'s', accel160:'s', m500:'s', m1000:'s', recovery:'s', brake100:'m', slalom:'puertas', turn:'m', wet:'m', speedo:'km/h', consumption:'L/100 km' };

export function formatRoadTestRecord(sheet) {
  if (!sheet) return 'Sin marca';
  if (/^\d+:[0-5]\d(?:\.\d+)?$/.test(String(sheet.main))) return `${measurement(sheet.main).toFixed(2)} s`;
  const unit = sheet.unit || legacyUnits[sheet.testId];
  return unit ? `${sheet.main} ${unit}` : String(sheet.main);
}

export function summarizeRoadTestRecords(sheets, testId, vehicleClass) {
  const attempts = (Array.isArray(sheets) ? sheets : []).filter(sheet => sheet?.testId === testId && sheet.class === vehicleClass);
  const valid = attempts.filter(sheet => sheet.valid === true && Number.isFinite(measurement(sheet.main)));
  const higherWins = testId === 'vmax' || testId === 'slalom';
  const best = valid.reduce((current, sheet) => {
    if (!current) return sheet;
    const difference = measurement(sheet.main) - measurement(current.main);
    return (higherWins ? difference > 0 : difference < 0) ? sheet : current;
  }, null);
  return { best, attempts: attempts.length, validAttempts: valid.length };
}

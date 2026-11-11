const minutesPerDay = 24 * 60;

export function createMinimapClock(host) {
  const time = host?.querySelector('time');
  if (!time) return null;
  let lastMinute = null;

  return {
    render(hour) {
      if (!Number.isFinite(hour)) {
        if (lastMinute !== null) host.hidden = true;
        lastMinute = null;
        return;
      }
      const minuteOfDay = (Math.floor(hour * 60) % minutesPerDay + minutesPerDay) % minutesPerDay;
      if (minuteOfDay === lastMinute) return;
      lastMinute = minuteOfDay;

      const hours = Math.floor(minuteOfDay / 60);
      const minutes = minuteOfDay % 60;
      const label = String(hours).padStart(2,'0') + ':' + String(minutes).padStart(2,'0');
      host.style.setProperty('--chevy-clock-hour', (minuteOfDay % 720) / 2 + 'deg');
      host.style.setProperty('--chevy-clock-minute', minutes * 6 + 'deg');
      time.dateTime = label;
      time.textContent = label;
      if (host.hidden) host.hidden = false;
    },
  };
}


(function(root){
"use strict";
function formatRadioTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function createRadioDisplayFrame({ state, mediaDuration = 0 }) {
  const track = state.tracks[state.currentIndex] || null;
  const duration = Math.max(0, Number(track?.duration) || Number(mediaDuration) || 0);
  return {
    powered: Boolean(state.powered),
    playing: Boolean(state.playing),
    title: String(track?.title || 'SIN MP3').toUpperCase(),
    artist: String(track?.artist || 'ARCHIVO LOCAL').toUpperCase(),
    indexLabel: String(state.tracks.length ? state.currentIndex + 1 : 0).padStart(2, '0') + ' / ' + String(state.tracks.length).padStart(2, '0'),
    timeLabel: formatRadioTime(state.currentTime) + '  ' + formatRadioTime(duration),
    progress: duration > 0 ? Math.max(0, Math.min(1, state.currentTime / duration)) : 0,
    volumeLabel: 'VOL ' + String(Math.round(Math.max(0, Math.min(1, state.volume)) * 100)).padStart(3, '0'),
  };
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function fitText(context, text, maxWidth, startSize, minSize) {
  let size = startSize;
  while (size > minSize) {
    context.font = '700 ' + size + 'px ui-monospace, Consolas, monospace';
    if (context.measureText(text).width <= maxWidth) return;
    size -= 2;
  }
  context.font = '700 ' + minSize + 'px ui-monospace, Consolas, monospace';
}

function drawRadioDisplay({ context, width, height, frame }) {
  context.clearRect(0, 0, width, height);

  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, frame.powered ? '#160c03' : '#050706');
  background.addColorStop(0.55, frame.powered ? '#291307' : '#070a08');
  background.addColorStop(1, '#030403');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = frame.powered ? 'rgba(255,151,46,.30)' : 'rgba(141,151,119,.18)';
  context.lineWidth = 3;
  context.strokeRect(5, 5, width - 10, height - 10);

  const glow = frame.powered ? '#ff9b38' : '#6f7864';
  context.fillStyle = glow;
  context.textBaseline = 'middle';

  if (!frame.powered) {
    context.font = '700 31px ui-monospace, Consolas, monospace';
    context.textAlign = 'center';
    context.fillText('CHEVROLET  ·  DELCO AM', width / 2, 48);

    const marks = ['55', '70', '90', '110', '140', '160'];
    context.font = '700 27px ui-monospace, Consolas, monospace';
    marks.forEach((mark, index) => {
      const x = 70 + index * ((width - 140) / (marks.length - 1));
      context.fillText(mark, x, 114);
      context.fillRect(x - 2, 143, 4, index % 2 ? 18 : 27);
    });
    context.font = '600 19px ui-monospace, Consolas, monospace';
    context.fillText('KILOCICLOS', width / 2, 190);
    return;
  }

  context.shadowColor = '#ff5b16';
  context.shadowBlur = 15;
  context.textAlign = 'left';
  fitText(context, frame.title, 720, 55, 30);
  context.fillText(frame.title, 44, 66);
  context.shadowBlur = 7;
  context.font = '600 23px ui-monospace, Consolas, monospace';
  context.fillStyle = '#d9772d';
  context.fillText(frame.artist || 'ARCHIVO LOCAL', 47, 112);

  context.textAlign = 'right';
  context.font = '700 25px ui-monospace, Consolas, monospace';
  context.fillStyle = glow;
  context.fillText(frame.indexLabel, width - 42, 50);
  context.font = '700 27px ui-monospace, Consolas, monospace';
  context.fillText(frame.timeLabel, width - 42, 105);

  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255,122,36,.18)';
  drawRoundedRect(context, 45, 154, width - 90, 18, 9);
  context.fillStyle = '#f47a28';
  drawRoundedRect(context, 45, 154, (width - 90) * frame.progress, 18, 9);

  context.font = '700 19px ui-monospace, Consolas, monospace';
  context.textAlign = 'left';
  context.fillStyle = '#b85e25';
  context.fillText(frame.playing ? '▶ REPRODUCIENDO' : 'Ⅱ PAUSA', 47, 198);
  context.textAlign = 'right';
  context.fillText(frame.volumeLabel, width - 45, 198);
}

root.AsfaltoNacionalRadioDisplay=Object.freeze({formatRadioTime,createRadioDisplayFrame,drawRadioDisplay});
})(globalThis);

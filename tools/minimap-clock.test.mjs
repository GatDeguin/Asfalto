import test from 'node:test';
import assert from 'node:assert/strict';
import {createMinimapClock} from '../src/ui/minimap-clock.mjs?v=a166d5eeda99d094';
import {createRaceDayCycle,racePresetHour} from '../src/environment/race-day-cycle.mjs?v=35b730ba327a62ee';

function fixture() {
  const time = {dateTime: '', textContent: ''};
  const hands = new Map();
  let writes = 0;
  const host = {
    hidden: true,
    querySelector: selector => selector === 'time' ? time : null,
    style: {setProperty(name,value) { hands.set(name,value); writes++; }},
  };
  return {host,time,hands,writes:()=>writes,clock:createMinimapClock(host)};
}

test('the dial shows hour and minute hands with an unambiguous 24-hour reading', () => {
  const {host,time,hands,clock} = fixture();
  clock.render(6.5);
  assert.equal(host.hidden,false);
  assert.equal(time.dateTime,'06:30');
  assert.equal(time.textContent,'06:30');
  assert.equal(hands.get('--chevy-clock-hour'),'195deg');
  assert.equal(hands.get('--chevy-clock-minute'),'180deg');

  clock.render(18.5);
  assert.equal(time.textContent,'18:30');
  assert.equal(hands.get('--chevy-clock-hour'),'195deg');
  assert.equal(hands.get('--chevy-clock-minute'),'180deg');
});

test('the dial stays idle within a minute and wraps at midnight', () => {
  const {host,time,hands,writes,clock} = fixture();
  clock.render(23+59/60);
  assert.equal(time.textContent,'23:59');
  assert.equal(hands.get('--chevy-clock-hour'),'359.5deg');
  clock.render(23.999);
  assert.equal(writes(),2);

  clock.render(0);
  assert.equal(time.textContent,'00:00');
  assert.equal(hands.get('--chevy-clock-minute'),'0deg');
  clock.render(null);
  assert.equal(host.hidden,true);
  clock.render(0);
  assert.equal(host.hidden,false);
});

test('fixed sky presets use the same starting hour as the environmental clock', () => {
  for (const [skyId,hour] of Object.entries({
    clear:10,overcast:13,'golden-hour':17,sunset:18.5,moonrise:20,night:0,
  })) {
    const clock = createRaceDayCycle({skyId,enabled:false});
    assert.equal(racePresetHour(skyId),hour);
    assert.equal(clock.state.hour,hour);
    clock.reset('sunset');
    assert.equal(clock.state.hour,racePresetHour('sunset'));
  }
});

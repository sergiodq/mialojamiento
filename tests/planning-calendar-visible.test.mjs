import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('calendar stylesheet loads last on dashboard and the empty-period notice is available',async()=>{
  const html=await read('dashboard.html');
  const dom=new JSDOM(html);
  try{
    const styles=[...dom.window.document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.getAttribute('href'));
    assert.equal(styles.at(-1),'css/planning-bookings-compact.css');
    assert.ok(dom.window.document.querySelector('#plannerCalendarHint[hidden]'));
    assert.ok(dom.window.document.querySelector('.planning-board-scroll'));
  }finally{dom.window.close()}
});
test('desktop calendar builds a colgroup and 7 separate days in weekly view',async()=>{
  const code=await read('js/dashboard.js');
  assert.match(code,/colgroup/);
  assert.match(code,/planning-room-column/);
  assert.match(code,/visibleDates\.map\(\(\) => '<col class="planning-date-column">'\)/);
  assert.match(code,/planning-day-number/);
  assert.match(code,/planning-day-header/);
  assert.match(code,/planning-cell-free/);
  assert.match(code,/data-date/);
  assert.match(code,/Sin reservas registradas en estas fechas/);
});
test('CSS restores table-cell semantics for property summary and date cells',async()=>{
  const css=await read('css/planning-calendar-visible.css');
  assert.match(css,/td\.planning-property-summary-spacer\s*\{[\s\S]*?display:table-cell!important/);
  assert.match(css,/\.planning-board-table thead\s*\{[\s\S]*?display:table-header-group!important/);
  assert.match(css,/\.planning-board-table col\.planning-room-column/);
  assert.match(css,/\.planning-board-table \.planning-day-header/);
  assert.match(css,/\.planning-board-table \.planning-day-cell \.planning-cell-free/);
  assert.match(css,/@media \(max-width:839px\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('property calendar cards group rooms without repeating property rows',async()=>{
  const source=await read('js/dashboard.js');
  assert.match(source,/class="planning-property-collection"/);
  assert.match(source,/class="planning-property-section"/);
  assert.match(source,/class="planning-property-card-heading"/);
  assert.match(source,/group\.rows\.map\(\(row\) => renderUnitScheduleRow\(row, visibleDates, range\)\)/);
  assert.doesNotMatch(source,/class="planning-property-row"/);
  assert.match(source,/visibleDates\.map\(\(\) => '<col class="planning-date-column">'\)/);
  assert.match(source,/renderReservationCell\(item, span\)/);
  assert.match(source,/canCreateReservations\(currentProfile\)/);
});
test('new final CSS removes repetitive Libre labels and preserves separate mobile cards',async()=>{
  const css=await read('css/planning-property-cards.css');
  assert.match(css,/\.planning-property-section/);
  assert.match(css,/\.planning-day-cell \.planning-cell-free\s*\{[\s\S]*?display:none!important/);
  assert.match(css,/@media \(min-width:840px\)/);
  assert.match(css,/@media \(max-width:839px\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('desktop property calendars allow page scroll for all accommodations',async()=>{
  const css=await read('css/planning-property-cards.css');
  const legacy=await read('css/styles.css');
  assert.match(legacy,/body\.dashboard-page \.main\s*\{\s*height: 100vh;\s*overflow: hidden;/);
  const final=css.slice(css.indexOf('La página debe desplazarse completa'));
  for(const selector of [
    'body.dashboard-page',
    'body.dashboard-page .page-shell',
    'body.dashboard-page .main',
    'body.dashboard-page .dashboard-page-frame',
    'body.dashboard-page .planning-board-scroll'
  ]) {
    assert.ok(final.includes(selector),selector);
  }
  assert.match(final,/\.dashboard-page \.main\s*\{[^}]*height:auto!important;[^}]*overflow:visible!important/s);
  assert.match(final,/\.dashboard-page \.dashboard-page-frame\s*\{[^}]*height:auto!important;[^}]*overflow:visible!important/s);
  assert.match(final,/\.dashboard-page \.planning-board-scroll\s*\{[^}]*overflow:visible!important;overscroll-behavior:auto!important/s);
  assert.match(final,/\.planning-property-grid-scroll\s*\{[^}]*overflow-x:auto!important;overflow-y:hidden!important/s);
});

test('planning shows only the selected accommodation, with tabs and arrows',async()=>{
  const source=await read('js/dashboard.js');
  assert.match(source,/let activePlannerPropertyId = null/);
  assert.match(source,/function selectedPlannerGroup\(\)/);
  assert.match(source,/function renderPlannerPropertyNavigation\(\)/);
  assert.match(source,/data-planner-property/);
  assert.match(source,/data-planner-step/);
  assert.match(source,/bindPlannerPropertyNavigation\(\)/);
  assert.match(source,/\[selectedPlannerGroup\(\)\]\.filter\(Boolean\)\.map\(\(group\) =>/);
  const html=await read('dashboard.html');
  assert.match(html,/id="plannerPropertyNavigation"/);
  assert.ok(html.indexOf('id="plannerPropertyNavigation"') < html.indexOf('id="planningBoard"'));
});
test('one-screen layout uses accommodation tabs and a bounded desktop planning',async()=>{
  const css=await read('css/planning-single-screen.css');
  assert.match(css,/\.planner-screen-navigation/);
  assert.match(css,/\.planner-screen-tabs/);
  assert.match(css,/\.planner-screen-arrow/);
  assert.match(css,/max-height:clamp\(165px,42vh,540px\)!important/);
  assert.match(css,/@media \(max-width:839px\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

test('booking strips truncate the guest name and expose detail on click', async()=>{
  const js=await read('js/dashboard.js');
  const css=await read('css/planning-bookings-compact.css');
  assert.match(js,/class="planning-booking-open"/);
  assert.match(js,/class="planning-booking-label"/);
  assert.match(js,/class="planning-reservation-bar planning-reservation-compact/);
  assert.match(js,/function openPlannerReservationDetail\(reservationId\)/);
  assert.match(js,/function closePlannerReservationDetail\(\)/);
  assert.match(css,/white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important/);
  assert.match(css,/text-overflow:ellipsis!important/);
  assert.match(css,/\.planner-reservation-detail-root\[hidden\]/);
  assert.match(css,/@media \(max-width:839px\)/);
  assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
});

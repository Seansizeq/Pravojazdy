/**
 * Що має бути на дорозі навколо точки, щоб офіційне питання відповідало ситуації в грі.
 * Складено вручну за фото й текстом кожного питання бази МІ (огляд: tools/scenes/).
 *
 * Токени (через пробіл, усі мають виконуватися; `a|b` — будь-який з варіантів; `!x` — x бути НЕ повинно):
 *   sign:X        знак X у напрямку руху: у точці, до 2 клітинок попереду або щойно проїханий (до 2 позаду)
 *   plate:TEXT    табличка з таким текстом під одним із цих знаків (пробіли в тексті — як «_»)
 *   junction      перехрестя (≥3 виїзди, не рондо) до 2 клітинок попереду; tee — ти на «ніжці» Т-перехрестя
 *   rondo         рондо попереду; xwalk — «зебра» поруч
 *   rail          переїзд поруч; rail:barrier — зі шлагбаумами; rail:stop — зі STOP; rail:open — без STOP і шлагбаумів;
 *   rail:2        переїзд з двома коліями
 *   left right straight turn   маневр на найближчому перехресті (turn — ліворуч або праворуч)
 *   ped wheel cane cyc scooter bus schoolbus truck worker   учасники поруч
 *   carR carL carX onc ahead   авто на перехресті праворуч / ліворуч / будь-яке поперечне / зустрічне / попереду
 *   acc           місце аварії поруч (розбите авто, аварійка)
 *   city country highway snow fog night   середовище; motorway / expressway — ти на автостраді (A) / швидкісній (S)
 *   gen           загальне знання — сцена не важлива
 * Чого в грі поки немає (такі питання на карті не ставимо):
 *   light (світлофор)  tram  lanes (кілька смуг в один бік)  emerg (спецтранспорт, «коридор життя»)
 *   tunnel  bridge  hill  rain  passing (тебе обганяють)  pedroad (пішоходи йдуть проїжджою частиною)
 *   jam (затор)  bikepath  disabledbay  unsup (інше, чого не відтворити)
 */

/** Вимога за замовчуванням для всіх питань пулу. */
export const POOL_SCENE: Record<string, string> = {
  q_speed50: 'sign:D-42',
  q_crosswalk: 'xwalk ped',
  q_right_hand: 'sign:A-5 junction',
  q_bus_stop: 'sign:D-15',
  q_no_overtaking: 'sign:B-25',
  q_uturn: 'sign:B-23',
  q_parking: 'sign:B-35',
  q_no_stopping: 'sign:B-36',
  q_left_position: 'left',
  q_zipper: 'lanes',
  q_stop: 'sign:B-20 junction',
  q_left_oncoming: 'left onc',
  q_children: 'sign:A-17',
  q_lights: 'gen',
  q_rondo_priority: 'rondo sign:C-12 sign:A-7',
  q_rondo_warn: 'sign:A-8',
  q_priority_road: 'sign:D-1',
  q_end_priority: 'sign:D-2',
  q_yield_a7: 'sign:A-7',
  q_zone20: 'sign:D-40',
  q_zone_exit: 'sign:D-41',
  q_park_crosswalk: 'xwalk',
  q_park_sidewalk: 'city',
  q_leave_parking: 'gen',
  sch_white_cane: 'cane',
  sch_turn_peds: 'turn ped',
  sch_cyclist: 'cyc',
  sch_cyclist_xing: 'cyc',
  sch_no_overtake_xing: 'xwalk cyc',
  sch_school_bus: 'schoolbus',
  sch_trust: 'city',
  sch_horn: 'cyc',
  cty_exit_town: 'sign:D-43',
  cty_speed90: 'sign:D-43',
  cty_curve_r: 'sign:A-1',
  cty_curve_l: 'sign:A-2',
  cty_curves: 'sign:A-3|A-4',
  cty_a5: 'sign:A-5',
  cty_a6: 'sign:A-5|A-6a|A-6b|A-6c|A-6d',
  cty_bump: 'sign:A-11|A-11a',
  cty_narrow: 'sign:A-12a',
  cty_works: 'sign:A-14',
  cty_animals: 'sign:A-18a|A-18b',
  cty_hill: 'sign:A-22|A-23',
  cty_overtake: 'ahead',
  cty_overtaken: 'passing',
  cty_wind: 'sign:A-19',
  cty_signs_dist: 'sign:A-20',
  cty_twoway: 'sign:A-20',
  cty_cyclists: 'sign:A-24',
  cty_lights_ahead: 'sign:A-29 light',
  cty_gravel: 'sign:A-28',
  rail_a9: 'sign:A-9',
  rail_a10: 'sign:A-10',
  rail_posts: 'sign:G-1a|G-1b|G-1c',
  rail_cross: 'rail',
  rail_stop: 'rail:stop',
  rail_signal: 'rail:barrier',
  rail_queue: 'rail ahead',
  rail_stuck: 'rail',
  rail_after: 'rail',
  hw_motorway: 'sign:D-9',
  hw_express: 'sign:D-7',
  hw_distance: 'expressway|motorway',
  hw_tunnel: 'tunnel',
  hw_breakdown: 'expressway|motorway',
  hw_reverse: 'expressway|motorway',
  hw_corridor: 'emerg lanes',
  hw_exit: 'lanes',
  hw_overtake_right: 'lanes',
  hw_towing: 'gen',
  fog_lights: 'fog',
  fog_drive: 'fog',
  night_beams: 'night',
  night_parked: 'night',
  dash_lamps: 'gen',
  win_frost: 'sign:A-32',
  win_slippery: 'snow',
  win_rain: 'rain',
  win_lights: 'snow',
  win_overtake: 'snow ahead',
  win_abs: 'gen',
  win_crosswalk: 'snow xwalk !ped',
  acc_witness: 'acc',
  acc_duties: 'acc',
  acc_triangle: 'acc',
  acc_firstaid: 'acc',
  acc_112: 'acc',
  dt_bus_bay: 'sign:D-15',
  dt_bridge: 'bridge',
  dt_junction: 'junction',
  dt_disabled: 'disabledbay',
  dt_engine: 'gen',
  dt_left_edge: 'country',
  dt_bike_path: 'bikepath',
  dt_tow: 'sign:B-36',
  taxi_belts: 'gen',
  taxi_kids: 'gen',
  taxi_capacity: 'gen',
  taxi_phone: 'gen',
};

/** Питання, ситуація яких відрізняється від решти пулу. */
export const QUESTION_SCENE: Record<string, string> = {
  // --- місто
  n13404: 'xwalk wheel|cane', // особа з інвалідністю або з обмеженою рухливістю входить на перехід
  n13529: 'xwalk wheel', // людина на візку в'їжджає на перехід
  n13446: 'xwalk light', // світлофор на переході
  n898: 'sign:A-5',
  n3904: 'sign:A-5',
  n13553: 'bus sign:D-15', // зупинка без острівця, пасажири виходять на дорогу
  n9564: 'sign:B-35 country', // зупинка на узбіччі
  n8373: 'sign:B-20 junction right',
  n8586: 'sign:B-20 junction carX',
  n13648: 'sign:B-20 junction carR',
  n1421: 'sign:B-20 tee',
  n6115: 'sign:A-7 left onc', // A-7 з табличкою форми головної дороги
  n3083: 'sign:D-1 straight',
  n9555: 'sign:D-1 junction carR',
  n9556: 'sign:D-1 junction carR',
  n8588: 'sign:D-1 junction straight',
  n6032: 'sign:D-2 junction carR', // після D-2 перехрестя рівнозначне
  n3414: 'sign:D-2 sign:A-7',
  n8086: 'sign:A-7 plate:80_m', // «проїхавши 80 м» — табличка T-1
  n7444: 'sign:A-7 junction',
  n1590: 'xwalk sign:D-6',
  n8555: 'sign:D-47', // виїзд з внутрішньої дороги
  n8522: 'sign:D-41',
  n14060: 'carR !sign:D-1', // на головній дорозі (D-1) поступатися праворуч не треба
  // --- біля школи
  n13522: 'wheel', // особа з обмеженою рухливістю переходить поза переходом
  n7434: 'right ped xwalk',
  n9554: 'right ped',
  n13528: 'turn wheel',
  n13654: 'scooter',
  n13662: 'scooter',
  n13478: 'sign:D-6a',
  n13485: 'sign:D-6b',
  n8517: 'sign:D-6b',
  n8282: 'right cyc',
  n8296: 'right cyc',
  n9706: 'cyc xwalk',
  n13639: 'cyc straight sign:D-1',
  n13754: 'xwalk lanes',
  n8163: 'schoolbus country !builtup', // зупинка поза населеним пунктом
  n7230: 'ped city',
  n6272: 'cyc',
  n3420: 'cyc',
  n1647: 'tram',
  n8292: 'jam cyc',
  n13764: 'pedroad',
  // --- за містом
  n3040: 'sign:E-17a', // зелена табличка з назвою — не кінець населеного пункту
  n891: 'sign:A-1',
  n892: 'sign:A-2',
  n893: 'sign:A-3 plate:3',
  n894: 'sign:A-4',
  n3176: 'sign:A-4 plate:3',
  n3439: 'sign:A-3 plate:Koniec',
  n1035: 'sign:A-4 plate:Droga_kręta',
  n3655: 'sign:A-4 plate:Droga_kręta',
  n6086: 'sign:A-5 junction',
  n6097: 'sign:A-5 left', // на фото — A-5 (рівнозначне перехрестя), не A-6a
  n13277: 'sign:A-6b',
  n8085: 'sign:A-6c',
  n13504: 'sign:A-5',
  n978: 'sign:A-6d',
  n988: 'sign:A-11',
  n991: 'sign:A-11',
  n992: 'sign:A-11a plate:25_m',
  n990: 'sign:A-11 plate:1,2_km',
  n7450: 'sign:A-14 worker',
  n9640: 'sign:A-14 worker',
  n6355: 'sign:A-18b plate:3_km',
  n13447: 'sign:A-18a',
  n4257: 'sign:A-23 plate:10%',
  n1015: 'sign:A-22',
  n7777: 'hill',
  n13497: 'hill',
  n13513: 'hill',
  n1127: 'ahead sign:A-1|A-2',
  n1482: 'ahead rail',
  n1484: 'ahead rail',
  n1520: 'ahead rail',
  n2940: 'lanes',
  n3657: 'ahead truck',
  n788: 'ahead city',
  n3863: 'sign:A-20 builtup', // «не більше 100 м» — так ставлять знаки лише в населеному пункті
  n3905: 'plate:90_m',
  n11402: 'sign:A-25 cyc', // A-25 «spadające odłamki skalne», велосипедист попереду
  // --- переїзди
  n3661: 'rail:open',
  n3662: 'rail:open',
  n8311: 'rail',
  n13465: 'rail:barrier rail:2',
  n3664: 'rail:stop ahead',
  // --- траса: «на автомагістралі (А)» — треба бути на автостраді; «після цього знака» — знак поруч
  n13058: 'motorway',
  n8891: 'motorway',
  n8898: 'motorway',
  n8876: 'expressway',
  n7249: 'expressway',
  n2860: 'sign:D-7 plate:1000_m',
  n3623: 'sign:D-7 !plate:1000_m', // «після проїзду знака» — не попереджувальний знак за 1000 м
  n13051: 'sign:D-7 !plate:1000_m',
  n13781: 'expressway',
  n13782: 'motorway',
  n13783: 'motorway',
  n13052: 'expressway',
  n6300: 'expressway',
  n6301: 'expressway acc',
  n6302: 'motorway acc',
  n6312: 'motorway acc',
  n6405: 'motorway acc',
  n9791: 'gen',
  n9792: 'expressway',
  n6203: 'motorway',
  n6207: 'expressway',
  n6208: 'expressway',
  n6201: 'bridge',
  n6206: 'bridge',
  n10762: 'emerg',
  n10080: 'motorway',
  n7454: 'highway',
  // --- туман, ніч, зима
  n6216: 'rain',
  n13444: 'snow',
  n6358: 'night onc',
  n6354: 'snow junction',
  n7466: 'rain',
  n8203: 'snow ahead truck',
  // --- аварії
  n6303: 'acc !builtup', // «поза населеним пунктом»
  n6304: 'acc !builtup',
  n6305: 'acc !builtup',
  // «Ні» лише там, де зупинка дозволена: не за B-36 і не на S/A (art. 50)
  n6306: 'acc !builtup !sign:B-36 !expressway !motorway',
  n7166: 'expressway acc',
  n8352: 'acc builtup',
  n13212: 'sign:B-36',
  n10048: 'gen',
  // --- центр
  n3426: 'sign:B-36',
  n6166: 'city',
  n6173: 'city',
};

/** Перший пул, у якому є питання (для режиму іспиту, де питання беруться з усієї бази). */
function poolOf(id: string, pools: Record<string, { ids: string[] }>) {
  for (const [key, p] of Object.entries(pools)) if (p.ids.includes(id)) return key;
  return null;
}

/** Вимога до сцени для питання (у межах пулу). */
export function sceneSpec(id: string, pool: string | null, pools: Record<string, { ids: string[] }>): string {
  if (QUESTION_SCENE[id]) return QUESTION_SCENE[id];
  const key = pool && pools[pool]?.ids.includes(id) ? pool : poolOf(id, pools);
  return (key && POOL_SCENE[key]) || 'gen';
}

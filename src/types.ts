export type Dir = 'N' | 'S' | 'E' | 'W';
export type Cell = [number, number];

export type SignType =
  // ostrzegawcze
  | 'A-1' | 'A-2' | 'A-3' | 'A-4' | 'A-5' | 'A-6a' | 'A-6b' | 'A-6c' | 'A-6d' | 'A-7' | 'A-8' | 'A-9' | 'A-10'
  | 'A-11' | 'A-11a' | 'A-12a' | 'A-14' | 'A-16' | 'A-17' | 'A-18a' | 'A-18b' | 'A-19' | 'A-20' | 'A-22' | 'A-23'
  | 'A-24' | 'A-25' | 'A-28' | 'A-29' | 'A-32'
  // zakazu
  | 'B-20' | 'B-23' | 'B-25' | 'B-35' | 'B-36'
  | 'B-33-30' | 'B-33-40' | 'B-33-50' | 'B-33-70' | 'B-43' | 'B-44'
  // nakazu, informacyjne
  | 'C-12'
  | 'D-1' | 'D-2' | 'D-6' | 'D-6a' | 'D-6b' | 'D-7' | 'D-9' | 'D-10' | 'D-15' | 'D-18' | 'D-40' | 'D-41' | 'D-42' | 'D-43'
  | 'D-47' | 'E-17a'
  // kolejowe
  | 'G-1a' | 'G-1b' | 'G-1c' | 'G-3';

/** route — проїхати маршрут; park — маршрут + паркування; taxi — доставка пасажирів; free — вільна їзда */
export type Task = 'route' | 'park' | 'taxi' | 'free';

/** Офіційне питання з бази Ministerstwa Infrastruktury (текст PL + офіційний переклад UA). */
export interface Question {
  /** 'n' + номер питання в базі */
  id: string;
  num: number;
  /** вага питання на іспиті: 1–3 бали */
  points: number;
  tag: string;
  /** перевірене джерело правила */
  law: string;
  ua: { text: string; options: string[] };
  pl: { text: string; options: string[] };
  correct: number;
  /** фото з офіційних матеріалів до питання */
  image?: string;
}

export interface Actor {
  cell: Cell;
  /**
   * pedestrian — стоїть біля «зебри» в клітинці cell і переходить дорогу в напрямку face;
   * cyclist — їде правим краєм смуги в напрямку face; train — їде по коліях переїзду в напрямку face
   */
  kind: 'car' | 'bus' | 'police' | 'pedestrian' | 'cyclist' | 'train';
  face: Dir;
  /** Різновид моделі (див. ActorVariant). */
  variant?: ActorVariant;
  /**
   * Якими ще може бути цей учасник, щоб сцена відповідала питанню, що випало в точці `go`:
   * наприклад, пішохід біля «зебри» стає людиною на візку, якщо питання саме про це.
   */
  adapt?: ActorVariant[];
  /** поворотник, що блимає, доки машина стоїть; hazard — аварійка (блимає завжди) */
  blink?: 'left' | 'right' | 'hazard';
  color?: number;
  /** ключ точки (Trigger.q), після якої актор рушає */
  go?: string;
  /** скільки метрів проїхати після старту, потім зникнути */
  travel?: number;
  /** зміщення від осі дороги праворуч (за замовчуванням — центр смуги) */
  lateral?: number;
  /** зміщення вздовж напрямку руху від центру клітинки */
  along?: number;
  /** додатковий поворот корпусу (градуси) — для розбитих авто після ДТП */
  yaw?: number;
  /**
   * pedestrian: іде не впоперек, а вздовж проїжджої частини біля краю (lateral), туди й назад
   * на стільки метрів — як пішоходи в «strefa zamieszkania» чи на дорозі без тротуару
   */
  walk?: number;
}

/**
 * pedestrian: wheelchair (на візку), cane (незрячий з білою тростиною), worker (дорожній робітник);
 * cyclist: scooter (електросамокат); bus: school (шкільний); car: truck (вантажівка).
 */
export type ActorVariant = 'wheelchair' | 'cane' | 'worker' | 'scooter' | 'school' | 'truck';

/** Варіант знака, який може з'явитися замість основного (для підлаштування під питання). */
export interface SignAlt {
  type: SignType;
  below?: SignType;
  plate?: string;
}

export interface SignDef {
  cell: Cell;
  /** напрямок руху водія, для якого знак */
  travel: Dir;
  type: SignType;
  /** другий знак під основним на тому ж стовпі */
  below?: SignType;
  /** табличка під знаком: відстань («80 m»), кількість вигинів («3»), «Koniec» тощо */
  plate?: string;
  /** точка-питання, під яку підлаштовується знак, і варіанти, якими він може стати */
  go?: string;
  alts?: SignAlt[];
  /** зміщення вздовж дороги (м) */
  along?: number;
}

export interface Trigger {
  cell: Cell;
  /** ключ ситуації: пул офіційних питань у POOLS (questions.ts) */
  q: string;
  /** питання лише для руху в цьому напрямку */
  dir?: Dir;
}

export interface Zone {
  from: Cell;
  to: Cell;
  limit: number;
  name: string;
  /** знак на в'їзді в зону і на виїзді (для перевірки рівня) */
  sign?: SignType;
  end?: SignType;
}

/** Залізничний переїзд: колії впоперек дороги в клітинці cell. */
export interface Rail {
  cell: Cell;
  /** 'v' — дорога йде N–S (колії E–W), 'h' — дорога E–W */
  axis: 'v' | 'h';
  /** шлагбауми (напівшлагбауми) і світлофори з червоними вогнями */
  barrier?: boolean;
  /** кількість колій (1 або 2) */
  tracks?: number;
  /** ключ точки, після якої їде потяг (шлагбауми закриваються) */
  go?: string;
}

/** Дрібні об'єкти сцени: трикутник аварійної зупинки, конуси тощо. */
export interface Prop {
  cell: Cell;
  kind: 'triangle' | 'cone' | 'barrier';
  /** напрямок, з якого під'їжджає водій (для орієнтації) */
  face: Dir;
  lateral?: number;
  along?: number;
}

export interface Level {
  id: string;
  name: string;
  icon: string;
  description: string;
  task: Task;
  cols: number;
  rows: number;
  /** '#' — дорога, '.' — забудова */
  map: string[];
  start: { cell: Cell; dir: Dir };
  route?: Cell[];
  park?: { cell: Cell; travel: Dir };
  stops?: { cell: Cell; kind: 'pickup' | 'dropoff' }[];
  triggers: Trigger[];
  signs: SignDef[];
  crosswalks: { cell: Cell; axis: 'v' | 'h' }[];
  actors: Actor[];
  roundabouts?: Cell[];
  zones?: Zone[];
  rails?: Rail[];
  props?: Prop[];
  /** розмічені паркувальні місця вздовж бордюру; disabled — для людей з інвалідністю (синя заливка, знак візка) */
  bays?: { cell: Cell; travel: Dir; along?: number; disabled?: boolean }[];
  /** ліміт швидкості поза зонами (за замовчуванням 50 — населений пункт) */
  limit?: number;
  /** максимальна швидкість авто гравця, км/год (за замовчуванням 60) */
  maxSpeed?: number;
  /** city — місто; country — поля й села; highway — траса з відбійниками */
  scenery?: 'city' | 'country' | 'highway';
  weather?: 'clear' | 'fog' | 'night' | 'snow';
  /** ділянки з іншою погодою (наприклад, туман у низині посеред нічного рівня) */
  weatherZones?: { from: Cell; to: Cell; weather: 'clear' | 'fog' | 'night' | 'snow' }[];
  /** режим іспиту: питання з усієї бази, підсумок у балах як на WORD */
  exam?: boolean;
  /** частота питань: мінімальна відстань між ними (м) і частка активних точок */
  quiz?: { gap?: number; chance?: number };
  /** кількість машин міського трафіку */
  traffic?: number;
  seed?: number;
  /** вигляд місцевості (лише оформлення: будинки, рослини, небо — на правила й питання не впливає) */
  theme?: Theme;
  /** вода (озеро, річка, море): прямокутники клітинок без доріг; дорога над водою — міст */
  water?: { from: Cell; to: Cell; frozen?: boolean }[];
  /** приметні споруди в клітинках без доріг */
  landmarks?: { cell: Cell; kind: Landmark; face?: Dir }[];
}

/**
 * desert — пустеля й оаза; euro — європейське місто; taiga — хвойний ліс і озера; village — поля й села;
 * mountain — засніжені гори; coast — морське узбережжя.
 */
export type Theme = 'desert' | 'euro' | 'taiga' | 'village' | 'mountain' | 'coast';

/** face — у який бік від клітинки дивиться споруда (для пірсу — куди він веде в море). */
export type Landmark =
  | 'church' | 'townhall' | 'square' | 'fountain' | 'park' | 'school'
  | 'fuel' | 'lighthouse' | 'pier' | 'windmill';

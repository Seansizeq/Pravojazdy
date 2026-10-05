"""Генерує src/data/questions.ts і public/q/*.jpg з офіційної бази питань (Ministerstwo Infrastruktury).

Запуск (з кореня проєкту):
    pip install openpyxl pillow remotezip
    python tools/questions/build.py                 # згенерувати питання й фото
    python tools/questions/build.py --sheet out.jpg 891 892 ...   # аркуш фото для ручної перевірки

Що робить:
1. Завантажує KATALOG_dla_kandydatów_na_kierowców_*.xlsx з gov.pl/web/infrastruktura/prawo-jazdy (у tools/questions/cache).
2. Бере з бази лише питання категорії B, перелічені в pools.py (ключ точки на карті → номери питань).
3. Фото до питань витягує з офіційного архіву «Multimedia do pytań» (9,5 ГБ) поштучно через HTTP Range,
   решту — з «Multimedia do pytań – cz. 2». Відео (wmv) не використовуються.
4. Текст PL, офіційний переклад UA і правильну відповідь бере з бази без змін.

Якщо міністерство опублікує нову версію каталогу — онови KATALOG_URL і перевір pools.py
(номери питань могли змінитися або питання могли вилучити).
"""
import io
import json
import os
import re
import sys
import textwrap
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(HERE, 'cache')
IMGS = os.path.join(CACHE, 'imgs')
OUT_TS = os.path.join(ROOT, 'src', 'data', 'questions.ts')
OUT_IMG = os.path.join(ROOT, 'public', 'q')

# KATALOG_dla_kandydatów_na_kierowców_072026.xlsx
KATALOG_URL = 'https://www.gov.pl/attachment/a5c6c329-28a5-4274-a1a8-e2813f0a51bd'
MEDIA_URL = 'https://www.gov.pl/pliki/mi/multimedia_do_pytan.zip'
MEDIA2_URL = 'https://www.gov.pl/attachment/10d143bf-9e93-4d82-935d-48c89353d3ce'
UA = {'User-Agent': 'Mozilla/5.0'}


def download(url, path):
    if not os.path.exists(path):
        print('download', url)
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path


def load_base():
    """Питання категорії B: номер → рядок каталогу."""
    cache = os.path.join(CACHE, 'B.json')
    if os.path.exists(cache):
        return json.load(open(cache, encoding='utf-8'))
    import openpyxl
    xlsx = download(KATALOG_URL, os.path.join(CACHE, 'katalog.xlsx'))
    rows = list(openpyxl.load_workbook(xlsx, read_only=True).worksheets[0].iter_rows(values_only=True))
    head = rows[0]
    base = {}
    for r in rows[1:]:
        d = {k: (v if v is None or isinstance(v, (int, float, str)) else str(v)) for k, v in zip(head, r) if k}
        if 'B' in str(d.get('Kategorie') or '').split(','):
            base[str(d['Numer pytania']).strip()] = d
    json.dump(base, open(cache, 'w', encoding='utf-8'), ensure_ascii=False)
    return base


B = None


def media_index():
    idx = {}
    names = os.path.join(CACHE, 'zipnames.txt')
    if not os.path.exists(names):
        from remotezip import RemoteZip
        with RemoteZip(MEDIA_URL, headers=UA) as z:
            open(names, 'w', encoding='utf-8').write('\n'.join(z.namelist()))
    for name in open(names, encoding='utf-8').read().split('\n'):
        idx[name.split('/')[-1].lower()] = ('main', name)
    z2 = zipfile.ZipFile(download(MEDIA2_URL, os.path.join(CACHE, 'media2.zip')))
    for name in z2.namelist():
        idx[name.split('/')[-1].lower()] = ('cz2', name)
    return idx, z2


def fetch_images(nums):
    """Зберігає фото до питань у cache/imgs/<номер>.jpg (ширина до 720 px)."""
    from PIL import Image
    todo = [n for n in nums if (B[n]['Media'] or '').strip() and not os.path.exists(os.path.join(IMGS, f'{n}.jpg'))]
    if not todo:
        return
    idx, z2 = media_index()
    rz = None
    for n in todo:
        media = B[n]['Media'].strip()
        src, name = idx[media.lower()]
        if src == 'cz2':
            data = z2.read(name)
        else:
            if rz is None:
                from remotezip import RemoteZip
                rz = RemoteZip(MEDIA_URL, headers=UA)
            data = rz.read(name)
        im = Image.open(io.BytesIO(data)).convert('RGB')
        im.thumbnail((720, 720))
        im.save(os.path.join(IMGS, f'{n}.jpg'), quality=82)
        print('image', n, media)


def clean(s):
    s = re.sub(r'\s+', ' ', (s or '').replace(' ', ' ')).strip()
    s = re.sub(r'\s+([?.,:;!])', r'\1', s)
    return s[:-1] if s.endswith('?"') else s


def options(r, suffix):
    a = r['Poprawna odp']
    if a in ('T', 'N'):
        return (['Tak', 'Nie'] if suffix == '' else ['Так', 'Ні']), 0 if a == 'T' else 1
    return [clean(r[f'Odpowiedź {k}{suffix}']) for k in 'ABC'], 'ABC'.index(a)


def build():
    from PIL import Image
    from pools import POOLS
    os.makedirs(OUT_IMG, exist_ok=True)
    questions, pools, media_file = {}, {}, {}
    for key, (tag, law, nums) in POOLS.items():
        ids = []
        for n in map(str, nums):
            r = B[n]
            qid = f'n{n}'
            ids.append(qid)
            if qid in questions:
                continue
            pl_opts, correct = options(r, '')
            ua_text, (ua_opts, _) = clean(r['Pytanie [UA]']), options(r, ' [UA]')
            if not ua_text or not all(ua_opts):
                ua_text, ua_opts = clean(r['Pytanie']), pl_opts
            q = {
                'id': qid, 'num': int(n), 'points': int(r['Liczba punktów']), 'tag': tag, 'law': law,
                'ua': {'text': ua_text, 'options': ua_opts},
                'pl': {'text': clean(r['Pytanie']), 'options': pl_opts},
                'correct': correct,
            }
            media = (r['Media'] or '').strip()
            if media:
                fetch_images([n])
                if media not in media_file:
                    media_file[media] = f'{n}.jpg'
                    im = Image.open(os.path.join(IMGS, f'{n}.jpg'))
                    im.thumbnail((640, 640))
                    im.save(os.path.join(OUT_IMG, f'{n}.jpg'), quality=74, optimize=True, progressive=True)
                q['image'] = 'q/' + media_file[media]
            questions[qid] = q
        pools[key] = {'tag': tag, 'law': law, 'ids': ids}

    def lines(d):
        return ''.join(f'  {k}: {json.dumps(v, ensure_ascii=False)},\n' for k, v in d.items())

    header = (
        '// АВТОМАТИЧНО ЗГЕНЕРОВАНО (tools/questions/build.py) — не редагувати вручну.\n'
        '// Джерело: офіційна база питань на іспит з ПДР, Ministerstwo Infrastruktury,\n'
        '// «KATALOG_dla_kandydatów_na_kierowców_072026.xlsx» (gov.pl/web/infrastruktura/prawo-jazdy),\n'
        '// категорія B; текст PL та офіційний переклад UA, правильні відповіді — з бази без змін.\n'
        '// Фото — з офіційного архіву «Multimedia do pytań». Посилання на закон — перевірені вручну\n'
        '// за текстом PoRD (Dz.U. 2024 poz. 1251 ze zm.) і Rozporządzenia o znakach (Dz.U. 2019 poz. 2310 ze zm.).\n'
        "import type { Question } from '../types';\n\n"
    )
    body = 'export const QUESTIONS: Record<string, Question> = {\n' + lines(questions) + '};\n\n'
    body += '/** Тематичні пули: ключ точки на карті → офіційні питання, що відповідають цій ситуації. */\n'
    body += 'export const POOLS: Record<string, { tag: string; law: string; ids: string[] }> = {\n' + lines(pools) + '};\n'
    open(OUT_TS, 'w', encoding='utf-8', newline='\n').write(header + body)

    used = {q['image'].split('/')[-1] for q in questions.values() if 'image' in q}
    for f in os.listdir(OUT_IMG):
        if f not in used:
            os.remove(os.path.join(OUT_IMG, f))
    size = sum(os.path.getsize(os.path.join(OUT_IMG, f)) for f in os.listdir(OUT_IMG))
    print(f'questions {len(questions)}, pools {len(pools)}, images {len(used)} ({size / 1e6:.1f} MB)')


def sheet(out, nums, cols=3):
    """Аркуш фото з текстом питання й офіційною відповіддю — для ручної перевірки."""
    from PIL import Image, ImageDraw, ImageFont
    fetch_images([n for n in nums if (B[n]['Media'] or '').strip()])
    font = ImageFont.truetype('arial.ttf', 15)
    cw, ih, th = 480, 270, 92
    S = Image.new('RGB', (cols * cw, ((len(nums) + cols - 1) // cols) * (ih + th)), 'white')
    d = ImageDraw.Draw(S)
    for i, n in enumerate(nums):
        x, y = (i % cols) * cw, (i // cols) * (ih + th)
        p = os.path.join(IMGS, f'{n}.jpg')
        if os.path.exists(p):
            im = Image.open(p)
            im.thumbnail((cw - 6, ih - 4))
            S.paste(im, (x + 3, y + 2))
        r = B[n]
        a = r['Poprawna odp']
        ans = {'T': 'TAK', 'N': 'NIE'}.get(a) or f"{a}) {r['Odpowiedź ' + a]}"
        rows = textwrap.wrap(f"#{n}: {r['Pytanie']}", 58)[:3] + ['=> ' + ans[:60]]
        for k, t in enumerate(rows):
            d.text((x + 4, y + ih + 2 + k * 21), t, fill='red' if k == len(rows) - 1 else 'black', font=font)
    S.save(out, quality=80)
    print('sheet', out)


if __name__ == '__main__':
    os.makedirs(IMGS, exist_ok=True)
    sys.path.insert(0, HERE)
    B = load_base()
    if len(sys.argv) > 2 and sys.argv[1] == '--sheet':
        sheet(sys.argv[2], sys.argv[3:])
    else:
        build()

"""Зводить фото питань у таблиці-мініатюри з номерами (для перегляду сцен)."""
import json
from PIL import Image, ImageDraw, ImageFont

rows = json.load(open('tools/scenes/images.json', encoding='utf-8'))
W, H, COLS, PER = 400, 260, 4, 12
try:
    font = ImageFont.truetype('arialbd.ttf', 22)
except OSError:
    font = ImageFont.load_default()
for s in range(0, len(rows), PER):
    chunk = rows[s:s + PER]
    sheet = Image.new('RGB', (W * COLS, (H + 30) * ((len(chunk) + COLS - 1) // COLS)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, r in enumerate(chunk):
        x, y = (i % COLS) * W, (i // COLS) * (H + 30)
        img = Image.open('public/' + r['image']).convert('RGB')
        img.thumbnail((W - 6, H - 4))
        sheet.paste(img, (x + 3, y + 30))
        d.rectangle([x, y, x + W, y + 28], fill='#222')
        d.text((x + 6, y + 3), f"{r['id']}  {r['pool']}", fill='#ffd23f', font=font)
    sheet.save(f'tools/scenes/sheets/{s // PER:02d}.jpg', quality=72)
print('sheets:', (len(rows) + PER - 1) // PER)

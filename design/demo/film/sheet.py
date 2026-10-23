import json, sys
from PIL import Image
def sheet(shot, secs, out, cols=3, w=640):
    t = json.load(open(f'frames/{shot}/times.json')); t0 = t[0]['t']
    ims = []
    for s in secs:
        best = t[0]
        for f in t:
            if f['t'] - t0 <= s: best = f
        im = Image.open(f'frames/{shot}/' + best['file']); im = im.resize((w, int(w * im.height / im.width))); ims.append(im)
    rows = (len(ims) + cols - 1) // cols; h = ims[0].height
    S = Image.new('RGB', (cols * w, rows * h), 'white')
    for i, im in enumerate(ims): S.paste(im, ((i % cols) * w, (i // cols) * h))
    S.save(out, quality=82)
shot = sys.argv[1]; secs = [float(x) for x in sys.argv[2].split(',')]
sheet(shot, secs, f'sheet-{shot}.jpg')

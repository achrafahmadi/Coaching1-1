"""Build /en/ and /fr/ copies of the homepage and /trtprotocol.
Run from the repo root after editing index.html or trtprotocol.html:  python3 tools/langpages.py
Root files stay Arabic; language buttons link between the three URLs."""
import re, os
SITE = 'https://achrafahmadi.com'
PAGES = {  # source file -> (url path per lang, output file per lang)
  'index.html':       ({'ar': '/', 'en': '/en/', 'fr': '/fr/'}, {'en': 'en/index.html', 'fr': 'fr/index.html'}),
  'trtprotocol.html': ({'ar': '/trtprotocol', 'en': '/en/trtprotocol', 'fr': '/fr/trtprotocol'}, {'en': 'en/trtprotocol.html', 'fr': 'fr/trtprotocol.html'}),
}
META = {
  'index.html': {
    'en': ('Achraf Ahmadi · TRT Coaching', '1-on-1 TRT coaching with Achraf: bloodwork, nutrition plan and weekly WhatsApp follow-up. Plans from $150.'),
    'fr': ('Achraf Ahmadi · Coaching TRT', 'Coaching TRT 1-1 avec Achraf : analyses, plan nutritionnel et suivi WhatsApp chaque semaine. Dès 150 €.'),
  },
  'trtprotocol.html': {
    'en': ('Achraf Ahmadi · TRT Protocol', '1-on-1 TRT coaching with Achraf. Plans from $150.'),
    'fr': ('Achraf Ahmadi · Protocole TRT', 'Coaching TRT 1-1 avec Achraf. Dès 150 €.'),
  },
}
LANGMAP = "var LANG_URLS=%s;"

def alt_links(urls):
    out = ''.join(f'<link rel="alternate" hreflang="{l}" href="{SITE}{u}">' for l, u in urls.items())
    return out + f'<link rel="alternate" hreflang="x-default" href="{SITE}{urls["ar"]}">'

def strip_ours(s):
    s = re.sub(r'<!--lp-->.*?<!--/lp-->', '', s, flags=re.S)
    return s

def head_block(urls, lang):
    js = "<script>window.FORCE_LANG=%s;%s</script>" % (repr(lang) if lang != 'ar' else 'null', LANGMAP % repr(urls).replace("'", '"'))
    return f'<!--lp--><link rel="canonical" href="{SITE}{urls[lang]}">{alt_links(urls)}{js}<!--/lp-->'

for src, (urls, outs) in PAGES.items():
    s = strip_ours(open(src).read())
    s = re.sub(r'(<head>)', lambda m: m.group(1) + head_block(urls, 'ar'), s, count=1)
    open(src, 'w').write(s)
    for lang, out in outs.items():
        t = s.replace(head_block(urls, 'ar'), head_block(urls, lang), 1)
        t = re.sub(r'<html lang="[^"]*" dir="rtl">', f'<html lang="{lang}" dir="ltr">', t, count=1)
        title, desc = META[src][lang]
        t = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', t, count=1, flags=re.S)
        t = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', t, count=1)
        t = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{SITE}{urls[lang]}">', t, count=1)
        t = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{desc}">', t, count=1)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(t)
        print('wrote', out)

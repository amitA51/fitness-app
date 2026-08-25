import os

# Normalize the hand-rolled '22px 16px 22px 16px' asymmetric radius to a token
# reference: var(--radius-card). Define token first, then swap usages.

token_path = 'src/styles/tokens.css'
with open(token_path, encoding='utf-8') as f:
    tok = f.read()
if '--radius-card:' not in tok:
    tok = tok.replace(
        '  --radius-2xl: 22px;',
        '  --radius-2xl: 22px;\n  /* Signature card corner: asymmetric "leaf" used across cards. */\n  --radius-card: 22px 16px 22px 16px;',
    )
    with open(token_path, 'w', encoding='utf-8') as f:
        f.write(tok)
    print('token added')

files = set()
for root, dirs, names in os.walk('src'):
    for fn in names:
        if fn.endswith('.tsx'):
            p = os.path.join(root, fn).replace(os.sep, '/')
            with open(p, encoding='utf-8') as f:
                s = f.read()
            if "'22px 16px 22px 16px'" in s:
                s2 = s.replace("'22px 16px 22px 16px'", "'var(--radius-card)'")
                with open(p, 'w', encoding='utf-8') as f:
                    f.write(s2)
                files.add(p)
print('files updated:', len(files))
for p in sorted(files):
    print(' ', p)

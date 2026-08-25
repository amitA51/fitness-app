import os

# Sweep: letterSpacing '0.04em' on Hebrew text → '-0.01em'. 0.04em was the
# Latin-display leftover; on Hebrew it breaks the word rhythm. The earlier
# sweep (46 files) only covered 0.05em+; 0.04em survived.

changed = []
count = 0
for root, dirs, names in os.walk('src'):
    for fn in names:
        if fn.endswith('.tsx'):
            p = os.path.join(root, fn).replace(os.sep, '/')
            with open(p, encoding='utf-8') as f:
                s = f.read()
            n = s.count("letterSpacing: '0.04em'")
            if n:
                s = s.replace("letterSpacing: '0.04em'", "letterSpacing: '-0.01em'")
                with open(p, 'w', encoding='utf-8') as f:
                    f.write(s)
                changed.append((p, n))
                count += n

print('files:', len(changed), 'occurrences:', count)
for p, n in sorted(changed):
    print(f'  {p} ({n})')

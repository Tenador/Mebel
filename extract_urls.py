import re

with open('unsplash_dump.html', 'r', encoding='utf-8') as f:
    text = f.read()

imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', text)
print(f'Total img tags: {len(imgs)}')
for img in imgs[:15]:
    if 'images.unsplash.com' in img:
        print(img)

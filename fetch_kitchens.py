import urllib.request
import re

headers = {'User-Agent': 'Mozilla/5.0'}

pages = [
    ('n4WauWDc3LQ', 'https://unsplash.com/photos/white-and-gray-concrete-kitchen-counter-n4WauWDc3LQ'),
    ('Z7W3w63mB_k', 'https://unsplash.com/photos/black-wooden-kitchen-cabinet-Z7W3w63mB_k'),
    ('or_UUf0a8z4', 'https://unsplash.com/photos/a-kitchen-with-grey-cabinets-a-white-island-and-three-pendant-lights-or_UUf0a8z4')
]

for name, url in pages:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'https://images\.unsplash\.com/photo-[a-zA-Z0-9_\-]+', html)
            if m:
                img_url = m.group(0) + '?auto=format&fit=crop&w=1400&q=80'
                print(name, img_url)
                req_img = urllib.request.Request(img_url, headers=headers)
                with urllib.request.urlopen(req_img) as img_resp, open(f'demo/images/{name}.jpg', 'wb') as f:
                    f.write(img_resp.read())
                print('Downloaded', name)
    except Exception as e:
        print('Error:', name, e)

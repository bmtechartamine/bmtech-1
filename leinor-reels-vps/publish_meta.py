#!/usr/bin/env python3
"""Publie les Reels LEINOR prévus dans queue.json sur la Page Facebook et le compte Instagram.
Lancé chaque jour par cron. Publie chaque Reel dont la date/heure est passée et qui n'est pas encore publié.
  python3 publish_meta.py           -> publie ce qui est dû
  python3 publish_meta.py --check   -> vérifie le token et les IDs, ne publie rien
  python3 publish_meta.py --dry     -> affiche ce qui serait publié
"""
import json, os, sys, time, datetime as dt
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
QUEUE = os.path.join(HERE, 'queue.json')
LOG = os.path.join(HERE, 'logs', 'publish.log')

def env():
    e = {}
    for line in open(os.path.join(HERE, '.env')):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1); e[k.strip()] = v.strip()
    return e

E = env()
V = E.get('GRAPH_VERSION', 'v21.0')
G = f'https://graph.facebook.com/{V}'
TOKEN, PAGE, IG = E['META_PAGE_TOKEN'], E['META_PAGE_ID'], E['IG_USER_ID']

def log(msg):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    line = f"{dt.datetime.now():%Y-%m-%d %H:%M} {msg}"
    print(line); open(LOG, 'a').write(line + '\n')

def ok(r):
    j = r.json()
    if r.status_code >= 400 or 'error' in j:
        raise RuntimeError(json.dumps(j.get('error', j))[:500])
    return j

def post_facebook(video_url, caption):
    j = ok(requests.post(f'{G}/{PAGE}/video_reels', data={'upload_phase': 'start', 'access_token': TOKEN}))
    vid = j['video_id']
    ok(requests.post(f'https://rupload.facebook.com/video-upload/{V}/{vid}',
                     headers={'Authorization': f'OAuth {TOKEN}', 'file_url': video_url}))
    ok(requests.post(f'{G}/{PAGE}/video_reels', data={'upload_phase': 'finish', 'video_id': vid,
                     'video_state': 'PUBLISHED', 'description': caption, 'access_token': TOKEN}))
    return vid

def post_instagram(video_url, caption):
    j = ok(requests.post(f'{G}/{IG}/media', data={'media_type': 'REELS', 'video_url': video_url,
                         'caption': caption, 'share_to_feed': 'true', 'access_token': TOKEN}))
    cid = j['id']
    for _ in range(40):  # jusqu'à ~10 min de traitement
        s = ok(requests.get(f'{G}/{cid}', params={'fields': 'status_code', 'access_token': TOKEN}))
        if s.get('status_code') == 'FINISHED': break
        if s.get('status_code') == 'ERROR': raise RuntimeError('Instagram a refusé la vidéo')
        time.sleep(15)
    else:
        raise RuntimeError('Instagram : traitement trop long')
    return ok(requests.post(f'{G}/{IG}/media_publish', data={'creation_id': cid, 'access_token': TOKEN}))['id']

def main():
    if '--check' in sys.argv:
        p = ok(requests.get(f'{G}/{PAGE}', params={'fields': 'name,instagram_business_account', 'access_token': TOKEN}))
        print('Page :', p.get('name'), '| Instagram relié :', p.get('instagram_business_account'))
        print('IG_USER_ID du .env :', IG)
        return
    q = json.load(open(QUEUE))
    now = dt.datetime.now()
    changed = False
    for item in q:
        when = dt.datetime.fromisoformat(item['publish_at'])
        if when > now:
            continue
        for net, fn in (('facebook', post_facebook), ('instagram', post_instagram)):
            if item.get(net):
                continue
            if '--dry' in sys.argv:
                print('[dry]', net, item['title']); continue
            try:
                item[net] = fn(item['video_url'], item['caption'])
                log(f"OK {net} : {item['title']} -> {item[net]}"); changed = True
            except Exception as e:
                log(f"ERREUR {net} : {item['title']} : {e}")
    if changed:
        # écriture atomique : queue.json n'est jamais laissé à moitié écrit
        tmp = QUEUE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(q, f, ensure_ascii=False, indent=1)
        os.replace(tmp, QUEUE)

if __name__ == '__main__':
    main()

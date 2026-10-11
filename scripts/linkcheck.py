#!/usr/bin/env python3
"""Check every URL in the Markdown files of a folder (the packs: plan L1, T6.6). ponytail: stdlib only, no model needed.
Usage: linkcheck.py <dir> [glob, default *.md]   Prints one line per non-OK URL, then a summary.
Exit 1 if any is dead, or if there is no address at all: a check that reads nothing proves nothing (p6 P6.1)."""
import re, sys, pathlib, urllib.request, urllib.error, concurrent.futures as cf
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
def urls(d, pat="*.md"):
    seen = {}
    for f in sorted(pathlib.Path(d).glob(pat)):
        for line in f.read_text().splitlines():
            if "expected 404" in line: continue   # a documented negative result (e.g. a DOI that does not exist) is evidence, not a dead link
            for u in re.findall(r"https?://[^\s)\]|>\"'`]+", line):
                seen.setdefault(u.rstrip(".,;:"), f.name)
    return seen
def status(u):
    for method in ("HEAD", "GET"):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA, method=method), timeout=20) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 400, 404, 429, 501): continue
            return e.code
        except Exception as e:
            if method == "HEAD": continue
            return type(e).__name__
    return "?"
if __name__ == "__main__":
    found = urls(sys.argv[1], *sys.argv[2:3])
    if not found: sys.exit(f"SUMMARY urls=0: no address in {sys.argv[1]}")
    with cf.ThreadPoolExecutor(16) as ex:
        res = dict(zip(found, ex.map(status, found)))
    bad = {u: s for u, s in res.items() if not (isinstance(s, int) and s < 400)}
    blocked = {u: s for u, s in bad.items() if s in (401, 403, 429)}  # bot walls: re-check by reading, not dead
    dead = {u: s for u, s in bad.items() if u not in blocked}
    for u, s in sorted(dead.items()): print(f"DEAD {s} {found[u]} {u}")
    for u, s in sorted(blocked.items()): print(f"BOTWALL {s} {found[u]} {u}")
    print(f"SUMMARY urls={len(res)} ok={len(res)-len(bad)} dead={len(dead)} botwall={len(blocked)}")
    sys.exit(1 if dead else 0)

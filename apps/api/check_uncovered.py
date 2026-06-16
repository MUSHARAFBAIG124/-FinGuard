import json
with open('coverage/coverage-final.json') as f:
    data = json.load(f)

d = None
for k, v in data.items():
    if 'drift-detection' in k:
        d = v
        break

print("Uncovered functions:")
for fid, fn in d['fnMap'].items():
    if d['f'].get(fid, 0) == 0:
        print(f"  Function {fid}: '{fn.get('name', '?')}' at line {fn.get('line', '?')}")

print("\nUncovered statements:")
for sid in sorted(d['s'].keys(), key=int):
    if d['s'][sid] == 0:
        loc = d['statementMap'].get(sid, {})
        print(f"  Statement {sid}: line {loc.get('start', {}).get('line', '?')}")

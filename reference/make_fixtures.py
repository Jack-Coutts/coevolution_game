"""Regenerate tests/fixtures/python-reference.json from the benchmark's coevo.py.

    python3 reference/make_fixtures.py
"""
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
sys.dont_write_bytecode = True

import coevo  # noqa: E402

runs = [coevo.run(seed)[0] for seed in range(10)]
out = os.path.join(here, "..", "tests", "fixtures", "python-reference.json")
with open(out, "w") as f:
    json.dump({"source": "coevolution_demo/coevo.py (GAP_FROM_OWN_BIRTH = False)", "runs": runs}, f, indent=2)
    f.write("\n")
print(json.dumps(runs))

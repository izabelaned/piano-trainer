# piano-trainer
## Deploying

Before each commit run `python3 tools/bump-version.py`. It stamps a version into
`index.html` (CSS link + an import map for every module), so browsers load the new
files right away instead of a cached copy.

# Python

This project uses **pyenv** (`.python-version`) and **penv** for the virtualenv. Run `./penv setup` once, then `./penv python script.py` or `./penv run pytest`. Activate manually with `source .venv/bin/activate`. Add deps to `requirements.txt`; install via `./penv pip install -r requirements.txt`.

# JavaScript

This project uses **nvm** (`.nvmrc`, v23.5.0). Run `nvm use`, then `npm install`. Use `node script.js` or `npm run <script>`. Add deps with `npm install <pkg>`; they are tracked in `package.json` and `package-lock.json`.

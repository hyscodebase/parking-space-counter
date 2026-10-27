#!/bin/sh
set -eu
app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$app_dir/serve.py" --port "${1:-8000}"

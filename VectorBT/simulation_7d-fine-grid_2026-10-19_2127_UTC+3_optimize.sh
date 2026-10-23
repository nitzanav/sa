#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/optimize.py fine --signal-name yahoo-7d-window --end 2026-10-16

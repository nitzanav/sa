#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-23_1827_UTC+3_all-sources-7d-window__optimize.py wide --signal-name all_sources-7d-window --end 2026-10-22

#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-23_1250_UTC+3_all-sources-analysts-7-10__optimize.py analysts --signal-name all_sources-7d-window --end 2026-10-22

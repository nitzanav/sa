#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-23_2014_UTC+3_full-all-signals__optimize.py full --signal-name all_sources-daily --signal-name all_sources-7d-window --signal-name yahoo-daily --signal-name yahoo-7d-window --signal-name tipranks-daily --signal-name tipranks-7d-window --end 2026-10-22

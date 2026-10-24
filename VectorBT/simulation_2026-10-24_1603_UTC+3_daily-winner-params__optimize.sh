#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-24_1603_UTC+3_daily-winner-params__optimize.py winners --signal-name yahoo-daily --signal-name tipranks-daily --signal-name google-daily --signal-name all_sources-daily --signal-name yahoo_and_google-daily --end 2026-10-22

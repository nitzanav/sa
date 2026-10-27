#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-24_2032_UTC+3_loss-dd-profit-protect__optimize.py protect --signal-name yahoo-daily --signal-name tipranks-daily --signal-name google-daily --signal-name all_sources-daily --signal-name yahoo_and_google-daily --end 2026-10-22

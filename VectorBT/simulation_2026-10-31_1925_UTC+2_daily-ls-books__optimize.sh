#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-31_1925_UTC+2_daily-ls-books__optimize.py daily --end 2026-10-26

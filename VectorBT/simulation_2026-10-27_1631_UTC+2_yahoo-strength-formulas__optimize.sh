#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-27_1631_UTC+2_yahoo-strength-formulas__optimize.py formulas --signal-name yahoo-daily --end 2026-10-26

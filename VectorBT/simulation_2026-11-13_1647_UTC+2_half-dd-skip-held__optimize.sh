#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-13_1647_UTC+2_half-dd-skip-held__optimize.py once --end 2026-10-26

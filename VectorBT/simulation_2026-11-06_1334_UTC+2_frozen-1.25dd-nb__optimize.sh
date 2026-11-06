#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-11-06_1334_UTC+2_frozen-1.25dd-nb__optimize.py nb125 --end 2026-10-26

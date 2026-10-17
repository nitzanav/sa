SELECT * FROM signals WHERE signal_name = 'yahoo-daily' AND analyst_projections_count > 2 AND average_projected > 10 ORDER BY signal_percentile DESC

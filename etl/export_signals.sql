SELECT
    *
FROM
    signals
WHERE
    signal_name in('yahoo-daily', 'yahoo-7d-window', 'google-daily', 'google-7d-window') AND
    analyst_projections_count > 2 AND
    average_projected > 10
ORDER BY signal_percentile DESC

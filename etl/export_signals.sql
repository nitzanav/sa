-- Combined signals. Percentile is ranked within each signal_name.
-- Score views are source-specific so google and yahoo do not replace each other.
CREATE OR REPLACE VIEW signals AS
SELECT
  u.*,
  PERCENT_RANK() OVER (
    PARTITION BY signal_name
    ORDER BY signal_score ASC NULLS FIRST
  ) AS signal_percentile
FROM (
  SELECT 'google-daily' AS signal_name, *
  FROM google_signal_score_daily
  WHERE analyst_projections_count > 2 and average_projected > 10
  UNION ALL
  SELECT 'google-7d-window' AS signal_name, *
  FROM google_signal_score_7d_window
  WHERE analyst_projections_count > 2 and average_projected > 10
  UNION ALL
  SELECT 'yahoo-daily' AS signal_name, *
  FROM yahoo_signal_score_daily
  WHERE analyst_projections_count > 2 and average_projected > 10
  UNION ALL
  SELECT 'yahoo-7d-window' AS signal_name, *
  FROM yahoo_signal_score_7d_window
  WHERE analyst_projections_count > 2 and average_projected > 10
) u;

SELECT
    *
FROM
    signals
WHERE
    signal_name in('yahoo-daily', 'yahoo-7d-window', 'google-daily', 'google-7d-window') AND
    analyst_projections_count > 2 AND
    average_projected > 10
ORDER BY signal_percentile DESC

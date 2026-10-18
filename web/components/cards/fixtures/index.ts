// The 12 engine-built fixture cards (agent/scripts/make_fixtures.py), for the /cards gallery.
import type { Card } from "../types";
import f01 from "./01_rank_total_risk.json";
import f02 from "./02_rank_spend_log.json";
import f03 from "./03_scatter_financial_credit.json";
import f04 from "./04_scatter_performance.json";
import f05 from "./05_table_overall_benchmark.json";
import f06 from "./06_table_replaceability_grid.json";
import f07 from "./07_edge_tight_cluster.json";
import f08 from "./08_edge_extreme_outlier.json";
import f09 from "./09_rank_esg_cluster.json";
import f10 from "./10_table_hidden_outliers.json";
import f11 from "./11_composite_topics.json";
import f12 from "./12_composite_all_metrics.json";

export const FIXTURES: { name: string; card: Card }[] = Object.entries({
  "01_rank_total_risk": f01,
  "02_rank_spend_log": f02,
  "03_scatter_financial_credit": f03,
  "04_scatter_performance": f04,
  "05_table_overall_benchmark": f05,
  "06_table_replaceability_grid": f06,
  "07_edge_tight_cluster": f07,
  "08_edge_extreme_outlier": f08,
  "09_rank_esg_cluster": f09,
  "10_table_hidden_outliers": f10,
  "11_composite_topics": f11,
  "12_composite_all_metrics": f12,
}).map(([name, card]) => ({ name, card: card as unknown as Card }));

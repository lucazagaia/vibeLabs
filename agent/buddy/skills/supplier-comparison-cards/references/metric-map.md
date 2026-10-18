# Metric map

Generated from `buddy/cards/schema.py`; do not edit by hand. All risk scores: 0 = no risk, 100 = maximum risk.

| Metric key | Meaning | Better | Cluster |
|---|---|---|---|
| `Total_Risk_Index` | overall risk profile (weighted average of all risk categories) | lower | overall (also in exposure) |
| `Industry_Benchmark_Score` | risk compared with industry peers and regional standards | lower | reputation |
| `Media_Sentiment_Score` | news, social media and public reports | lower | reputation |
| `External_Intelligence_Score` | third-party intelligence and external databases | lower | reputation |
| `Sub_Tier_Visibility_Score` | risks in the supplier's own supply chain (Tier-N, sub-suppliers) | lower | operational_chain |
| `Labor_Stability_Score` | strikes, protests, labor disputes | lower | esg_workforce |
| `Financial_Health_Score` | financial stability, liquidity, bankruptcy risk | lower | financial |
| `Compliance_Risk_Score` | lawsuits, regulatory fines, legal disputes | lower | compliance_governance |
| `Safety_Incident_Score` | industrial accidents, safety violations | lower | esg_workforce |
| `Environmental_Exposure_Score` | earthquakes, floods, extreme weather exposure | lower | geopolitical_external |
| `ESG_Performance_Score` | sustainability and ethical practices (environmental, social, governance) | lower | esg_workforce |
| `Digital_Security_Score` | data breaches, hacking, digital infrastructure failures | lower | operational_chain |
| `Operational_Resilience_Score` | day-to-day production and logistics capability | lower | operational_chain |
| `Market_Sentiment_Score` | public and consumer perception | lower | reputation |
| `Quality_Risk_Score` | product defects, recalls, quality management | lower | operational_chain |
| `Governance_Risk_Score` | corporate leadership, ethics, internal controls | lower | compliance_governance |
| `Geopolitical_Risk_Score` | humanitarian crises, regional instability, war, sanctions | lower | geopolitical_external |
| `Political_Stability_Score` | political unrest, government changes | lower | geopolitical_external |
| `Credit_Rating_Score` | creditworthiness (international rating standards) | lower | financial |
| `Purchase Order Volume (EUR)` | total value of orders placed = spend / financial exposure (not risk) | n/a (exposure, not risk) | exposure |
| `Order Change Rate` | how often existing orders are changed (%) | lower | performance |
| `Supplier Delivery Rating` | delivery timeliness and accuracy (%) | higher | performance |
| `Order Confirmation Rate` | orders confirmed within the requested timeframe (%) | higher | performance |
| `Sourcing Risk Level` | difficulty of replacing the supplier (Low / Medium / High) | Low / Simple | replaceability |
| `Supply Chain Complexity` | complexity of logistics routes and sub-tiers (Simple / Moderate / Complex) | Low / Simple | replaceability |

## Clusters (topics that group several metrics)

- **financial**: `Financial_Health_Score`, `Credit_Rating_Score`
- **compliance_governance**: `Compliance_Risk_Score`, `Governance_Risk_Score`
- **geopolitical_external**: `Geopolitical_Risk_Score`, `Political_Stability_Score`, `Environmental_Exposure_Score`
- **esg_workforce**: `ESG_Performance_Score`, `Labor_Stability_Score`, `Safety_Incident_Score`
- **operational_chain**: `Operational_Resilience_Score`, `Quality_Risk_Score`, `Sub_Tier_Visibility_Score`, `Digital_Security_Score`
- **reputation**: `Media_Sentiment_Score`, `Market_Sentiment_Score`, `External_Intelligence_Score`, `Industry_Benchmark_Score`
- **performance**: `Supplier Delivery Rating`, `Order Confirmation Rate`, `Order Change Rate`
- **exposure**: `Purchase Order Volume (EUR)`, `Total_Risk_Index`
- **replaceability**: `Sourcing Risk Level`, `Supply Chain Complexity`

"""Frozen types for the comparison-card skill (plan 05, docs/specs/card-contract.md).

Single source of truth for: the 25 metric keys, their glossary and clusters, the tool arguments the
agent fills (`compare_suppliers`), and the card contract the frontend renders. Change only together
with docs/specs/card-contract.md and web/components/cards/types.ts.
"""

from typing import Literal

from pydantic import BaseModel, Field

# --- Metrics -------------------------------------------------------------------------------------

MetricKey = Literal[
    "Total_Risk_Index",
    "Industry_Benchmark_Score",
    "Media_Sentiment_Score",
    "External_Intelligence_Score",
    "Sub_Tier_Visibility_Score",
    "Labor_Stability_Score",
    "Financial_Health_Score",
    "Compliance_Risk_Score",
    "Safety_Incident_Score",
    "Environmental_Exposure_Score",
    "ESG_Performance_Score",
    "Digital_Security_Score",
    "Operational_Resilience_Score",
    "Market_Sentiment_Score",
    "Quality_Risk_Score",
    "Governance_Risk_Score",
    "Geopolitical_Risk_Score",
    "Political_Stability_Score",
    "Credit_Rating_Score",
    "Purchase Order Volume (EUR)",
    "Order Change Rate",
    "Supplier Delivery Rating",
    "Order Confirmation Rate",
    "Sourcing Risk Level",
    "Supply Chain Complexity",
]

# One line per metric, from data/risk_criteria_description.md. Part of the tool description on every call:
# tests showed bare keys map only 17/34 natural-language requests correctly, with the glossary 34/34.
GLOSSARY: dict[str, str] = {
    "Total_Risk_Index": "overall risk profile (weighted average of all risk categories)",
    "Industry_Benchmark_Score": "risk compared with industry peers and regional standards",
    "Media_Sentiment_Score": "news, social media and public reports",
    "External_Intelligence_Score": "third-party intelligence and external databases",
    "Sub_Tier_Visibility_Score": "risks in the supplier's own supply chain (Tier-N, sub-suppliers)",
    "Labor_Stability_Score": "strikes, protests, labor disputes",
    "Financial_Health_Score": "financial stability, liquidity, bankruptcy risk",
    "Compliance_Risk_Score": "lawsuits, regulatory fines, legal disputes",
    "Safety_Incident_Score": "industrial accidents, safety violations",
    "Environmental_Exposure_Score": "earthquakes, floods, extreme weather exposure",
    "ESG_Performance_Score": "sustainability and ethical practices (environmental, social, governance)",
    "Digital_Security_Score": "data breaches, hacking, digital infrastructure failures",
    "Operational_Resilience_Score": "day-to-day production and logistics capability",
    "Market_Sentiment_Score": "public and consumer perception",
    "Quality_Risk_Score": "product defects, recalls, quality management",
    "Governance_Risk_Score": "corporate leadership, ethics, internal controls",
    "Geopolitical_Risk_Score": "humanitarian crises, regional instability, war, sanctions",
    "Political_Stability_Score": "political unrest, government changes",
    "Credit_Rating_Score": "creditworthiness (international rating standards)",
    "Purchase Order Volume (EUR)": "total value of orders placed = spend / financial exposure (not risk)",
    "Order Change Rate": "how often existing orders are changed (%)",
    "Supplier Delivery Rating": "delivery timeliness and accuracy (%)",
    "Order Confirmation Rate": "orders confirmed within the requested timeframe (%)",
    "Sourcing Risk Level": "difficulty of replacing the supplier (Low / Medium / High)",
    "Supply Chain Complexity": "complexity of logistics routes and sub-tiers (Simple / Moderate / Complex)",
}

# Short labels for cards and clarification options.
LABELS: dict[str, str] = {
    "Total_Risk_Index": "Total risk",
    "Industry_Benchmark_Score": "Industry benchmark",
    "Media_Sentiment_Score": "Media sentiment",
    "External_Intelligence_Score": "External intelligence",
    "Sub_Tier_Visibility_Score": "Sub-tier visibility",
    "Labor_Stability_Score": "Labor stability",
    "Financial_Health_Score": "Financial health",
    "Compliance_Risk_Score": "Compliance risk",
    "Safety_Incident_Score": "Safety incidents",
    "Environmental_Exposure_Score": "Environmental exposure",
    "ESG_Performance_Score": "ESG performance",
    "Digital_Security_Score": "Digital security",
    "Operational_Resilience_Score": "Operational resilience",
    "Market_Sentiment_Score": "Market sentiment",
    "Quality_Risk_Score": "Quality risk",
    "Governance_Risk_Score": "Governance risk",
    "Geopolitical_Risk_Score": "Geopolitical risk",
    "Political_Stability_Score": "Political stability",
    "Credit_Rating_Score": "Credit rating",
    "Purchase Order Volume (EUR)": "Spend (PO volume, EUR)",
    "Order Change Rate": "Order change rate",
    "Supplier Delivery Rating": "Delivery rating",
    "Order Confirmation Rate": "Order confirmation rate",
    "Sourcing Risk Level": "Sourcing risk (replaceability)",
    "Supply Chain Complexity": "Supply chain complexity",
}

ValueDirection = Literal["lower_is_better", "higher_is_better", "higher_means_more_exposure", "categorical"]

VALUE_DIRECTION: dict[str, ValueDirection] = {
    **{k: "lower_is_better" for k in GLOSSARY if k.endswith("_Score") or k in ("Total_Risk_Index", "Order Change Rate")},
    "Supplier Delivery Rating": "higher_is_better",
    "Order Confirmation Rate": "higher_is_better",
    "Purchase Order Volume (EUR)": "higher_means_more_exposure",
    "Sourcing Risk Level": "categorical",
    "Supply Chain Complexity": "categorical",
}

# Metric clusters = the spec's combined cards. Within-cluster correlation ~0.71 vs ~0.46 across (data check).
CLUSTERS: dict[str, list[str]] = {
    "financial": ["Financial_Health_Score", "Credit_Rating_Score"],
    "compliance_governance": ["Compliance_Risk_Score", "Governance_Risk_Score"],
    "geopolitical_external": ["Geopolitical_Risk_Score", "Political_Stability_Score", "Environmental_Exposure_Score"],
    "esg_workforce": ["ESG_Performance_Score", "Labor_Stability_Score", "Safety_Incident_Score"],
    "operational_chain": ["Operational_Resilience_Score", "Quality_Risk_Score", "Sub_Tier_Visibility_Score", "Digital_Security_Score"],
    "reputation": ["Media_Sentiment_Score", "Market_Sentiment_Score", "External_Intelligence_Score", "Industry_Benchmark_Score"],
    "performance": ["Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"],
    "exposure": ["Purchase Order Volume (EUR)", "Total_Risk_Index"],
    "replaceability": ["Sourcing Risk Level", "Supply Chain Complexity"],
}

# Risk-score colour bands: identical for every *_Score and Total_Risk_Index in the data (verified).
REFERENCE_BANDS = [
    {"label": "Low", "min": 0, "max": 24},
    {"label": "Medium", "min": 25, "max": 49},
    {"label": "High", "min": 50, "max": 74},
    {"label": "Critical", "min": 75, "max": 100},
]

# --- Tool arguments (filled by the agent) ------------------------------------------------------

Intent = Literal["compare", "overview", "watchlist", "exposure", "choose"]
Direction = Literal["safest", "watch"]


class Mention(BaseModel):
    """One topic the buyer mentioned. More than one candidate metric = ambiguous: the buyer is asked."""

    phrase: str = Field(description="The buyer's words for this topic, e.g. 'financial risk'.")
    metrics: list[MetricKey] = Field(description="Every metric key this phrase could reasonably mean.")


# --- Card contract (rendered by the frontend) ---------------------------------------------------

Renderer = Literal["rank", "scatter", "table", "composite"]
Scale = Literal["fixed_0_100", "zoomed", "log", "linear", "percentile", "categorical"]


class DataShape(BaseModel):
    flags: list[str] = []
    scale: Scale = "fixed_0_100"
    fallbackApplied: str | None = None
    notes: list[str] = []


class Quadrants(BaseModel):
    x: MetricKey
    y: MetricKey
    xThreshold: float
    yThreshold: float
    labels: dict[Literal["topLeft", "topRight", "bottomLeft", "bottomRight"], str]
    goodZone: Literal["topLeft", "topRight", "bottomLeft", "bottomRight"]


class CardSupplier(BaseModel):
    supplierID: str
    supplierName: str
    values: dict[str, float | str]
    levels: dict[str, str] = {}
    flags: list[str] = []  # e.g. "hidden_watchout", "outlier", "best", "worst"


class Card(BaseModel):
    cardId: str
    renderer: Renderer
    template: str  # spec template id, e.g. "financial_credit_card"
    title: str
    intent: Intent
    direction: Direction
    metrics: list[MetricKey]
    metricLabels: dict[str, str]
    valueDirection: dict[str, ValueDirection]
    sort: dict[str, str]  # {"field": <metric>, "direction": "asc" | "desc"}
    dataShape: DataShape
    referenceBands: list[dict] = REFERENCE_BANDS
    quadrants: Quadrants | None = None
    suppliers: list[CardSupplier]
    facts: dict
    summary: str
    panels: list["Card"] | None = None  # composite only: one full card per buyer topic, each with its own chart


Card.model_rebuild()


class ToolResult(BaseModel):
    status: Literal["ok", "needs_clarification", "error"]
    card: Card | None = None
    summary: str | None = None
    question: str | None = None
    options: list[str] | None = None
    message: str | None = None

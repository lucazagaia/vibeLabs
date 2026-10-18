"""Card engine checks: no LLM, no API key needed. Run: uv run pytest -q"""

import pytest

from buddy.cards import data
from buddy.cards.route import route
from buddy.cards.schema import Card
from buddy.cards.tool import build_card, compare_suppliers
from buddy.cards.validate import needs_choice, resolve_intent, supplier_ids_in

IDS = ["SUPP_00012", "SUPP_00450", "SUPP_00731", "SUPP_00141", "SUPP_00287", "SUPP_00018"]

# Spec "Harness-Friendly Metric Map": default card per metric (single-metric request, intent=compare).
SPEC_DEFAULTS = {
    "Total_Risk_Index": "ranked_lollipop_card",
    "Industry_Benchmark_Score": "ranked_lollipop_card",
    "Media_Sentiment_Score": "ranked_lollipop_card",
    "External_Intelligence_Score": "ranked_lollipop_card",
    "Sub_Tier_Visibility_Score": "ranked_lollipop_card",
    "Labor_Stability_Score": "ranked_lollipop_card",
    "Financial_Health_Score": "financial_credit_card",
    "Credit_Rating_Score": "financial_credit_card",
    "Compliance_Risk_Score": "compliance_governance_card",
    "Governance_Risk_Score": "compliance_governance_card",
    "Safety_Incident_Score": "ranked_lollipop_card",
    "Environmental_Exposure_Score": "ranked_lollipop_card",
    "ESG_Performance_Score": "ranked_lollipop_card",
    "Digital_Security_Score": "ranked_lollipop_card",
    "Operational_Resilience_Score": "paired_scatter_card",
    "Market_Sentiment_Score": "ranked_lollipop_card",
    "Quality_Risk_Score": "paired_scatter_card",
    "Geopolitical_Risk_Score": "ranked_lollipop_card",
    "Political_Stability_Score": "ranked_lollipop_card",
    "Purchase Order Volume (EUR)": "log_exposure_bar_card",
    "Order Change Rate": "ranked_lollipop_card",
    "Supplier Delivery Rating": "performance_reliability_card",
    "Order Confirmation Rate": "performance_reliability_card",
    "Sourcing Risk Level": "replaceability_complexity_card",
    "Supply Chain Complexity": "replaceability_complexity_card",
}


@pytest.mark.parametrize("metric,template", SPEC_DEFAULTS.items())
def test_single_metric_routes_to_spec_default(metric, template):
    assert route("compare", "safest", [metric], IDS).template == template


@pytest.mark.parametrize("metrics,template,renderer", [
    (["Financial_Health_Score", "Credit_Rating_Score"], "financial_credit_card", "scatter"),
    (["Purchase Order Volume (EUR)", "Total_Risk_Index"], "exposure_vs_risk_card", "scatter"),
    (["ESG_Performance_Score", "Labor_Stability_Score", "Safety_Incident_Score"], "esg_workforce_card", "rank"),
    (["Media_Sentiment_Score", "Market_Sentiment_Score", "External_Intelligence_Score"], "reputation_cluster_card", "rank"),
    (["Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"], "performance_reliability_card", "scatter"),
    (["Operational_Resilience_Score", "Quality_Risk_Score", "Digital_Security_Score"], "operational_chain_card", "table"),
    (["Financial_Health_Score", "Media_Sentiment_Score", "Quality_Risk_Score"], "risk_heatmap_matrix_card", "table"),
])
def test_multi_metric_routes(metrics, template, renderer):
    r = route("compare", "safest", metrics, IDS)
    assert (r.template, r.renderer) == (template, renderer)


@pytest.mark.parametrize("intent,metrics,template", [
    ("overview", [], "overall_supplier_benchmark_card"),
    ("choose", [], "shortlist_decision_card"),
    ("watchlist", [], "hidden_outlier_card"),
    ("watchlist", ["Total_Risk_Index"], "hidden_outlier_card"),
    ("watchlist", ["Quality_Risk_Score"], "outlier_watchlist_card"),
    ("exposure", [], "exposure_vs_risk_card"),
    ("exposure", ["Purchase Order Volume (EUR)"], "log_exposure_bar_card"),
])
def test_intent_routes(intent, metrics, template):
    assert route(intent, "safest", metrics, IDS).template == template


def test_ambiguity_rules():
    fin = ["Financial_Health_Score", "Credit_Rating_Score"]
    assert needs_choice(fin, "Compare the financial risk of SUPP_00012 and SUPP_00450")
    assert not needs_choice(fin, "Compare the financial health and credit rating of SUPP_00012 and SUPP_00450")
    assert not needs_choice(["Credit_Rating_Score"], "anything")
    assert resolve_intent("compare", []) == "overview"


def test_supplier_ids_only_from_request():
    assert supplier_ids_in("compare SUPP_00012 and SUPP_00450, SUPP_00012 again") == ["SUPP_00012", "SUPP_00450"]
    result = compare_suppliers(request="Who has the best credit rating among these?", intent="compare", direction="safest",
                               mentions=[{"phrase": "credit rating", "metrics": ["Credit_Rating_Score"]}],
                               supplier_ids=["SUPP_00001", "SUPP_00002"])  # invented by the model
    assert result["status"] == "needs_clarification"  # IDs not in the request are ignored -> ask which suppliers


def test_tool_ambiguous_asks_buyer_to_choose():
    result = compare_suppliers(request="Compare the financial risk of SUPP_00012 and SUPP_00450", intent="compare",
                               direction="safest", mentions=[{"phrase": "financial risk",
                                                              "metrics": ["Financial_Health_Score", "Credit_Rating_Score"]}])
    assert result["status"] == "needs_clarification"
    assert len(result["options"]) == 2 and result["options"][0].startswith("Financial health")


def test_tool_unknown_supplier_is_an_error():
    result = compare_suppliers(request="Compare SUPP_99999 and SUPP_00012 on total risk", intent="compare",
                               direction="safest", mentions=[{"phrase": "total risk", "metrics": ["Total_Risk_Index"]}])
    assert result["status"] == "error" and "SUPP_99999" in result["message"]


def test_card_facts_match_data():
    card = build_card("compare", "safest", ["Total_Risk_Index"], IDS)
    Card.model_validate(card)
    values = {i: data.by_id()[i]["Total_Risk_Index"] for i in IDS}
    assert card["facts"]["best"]["value"] == min(values.values())
    assert card["facts"]["worst"]["value"] == max(values.values())
    assert [s["supplierID"] for s in card["suppliers"]][0] == min(values, key=values.get)  # safest first
    assert str(int(min(values.values()))) in card["summary"]


def test_spend_uses_log_scale_and_is_called_exposure():
    ids = [r["supplierID"] for r in data.rows()[:9]] + \
          [next(r["supplierID"] for r in data.rows() if r["Purchase Order Volume (EUR)"] >= 40_000_000)]
    card = build_card("compare", "safest", ["Purchase Order Volume (EUR)"], ids)
    assert card["dataShape"]["scale"] == "log" and "skewed_positive" in card["dataShape"]["flags"]
    assert card["summary"].startswith("Spend is exposure, not risk")


def test_scatter_has_quadrants_and_hidden_watchouts_are_flagged():
    card = build_card("compare", "safest", ["Financial_Health_Score"], IDS)
    assert card["renderer"] == "scatter" and card["quadrants"]["xThreshold"] == 50
    hidden = [r["supplierID"] for r in data.rows()
              if r["Total_Risk_Index_Level"] in ("Low", "Medium") and r["Geopolitical_Risk_Score_Level"] == "Critical"][:3]
    card = build_card("watchlist", "watch", [], hidden + ["SUPP_00012"])
    assert card["template"] == "hidden_outlier_card"
    assert {h["supplierID"] for h in card["facts"]["hiddenWatchouts"]} >= set(hidden)


def test_regressions_from_live_run():
    # A mention without metrics must not crash routing: compare with no metric -> overview.
    r = compare_suppliers(request="Compare SUPP_00012 and SUPP_00450 somehow", intent="compare", direction="safest",
                          mentions=[{"phrase": "somehow", "metrics": []}])
    assert r["status"] == "ok" and r["card"]["template"] == "overall_supplier_benchmark_card"
    # 'Which has the best credit rating' labelled as choose -> ranks on the named metric instead.
    r = compare_suppliers(request="Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the best credit rating?",
                          intent="choose", direction="safest",
                          mentions=[{"phrase": "credit rating", "metrics": ["Credit_Rating_Score"]}])
    assert r["card"]["template"] == "financial_credit_card" and r["card"]["sort"]["field"] == "Credit_Rating_Score"


def test_invalid_enums_are_normalised_not_fatal():
    # Seen live: the model put the direction value into `intent`.
    r = compare_suppliers(request="Which of SUPP_00141, SUPP_00143, SUPP_00287 and SUPP_00012 hide risks behind a low total risk?",
                          intent="watch", direction="watch", mentions=[])
    assert r["status"] == "ok" and r["card"]["template"] == "hidden_outlier_card"
    r = compare_suppliers(request="Compare SUPP_00012 and SUPP_00450", intent="bogus", direction="bogus",
                          mentions=[{"phrase": "x", "metrics": ["Not_A_Metric"]}])
    assert r["status"] == "ok" and r["card"]["template"] == "overall_supplier_benchmark_card"


def test_show_notice_hidden_unless_asked():
    from types import SimpleNamespace

    from google.adk.models.llm_request import LlmRequest
    from google.genai import types

    from buddy.data_buddy.agent import hide_notice_unless_asked

    def request():
        decls = [types.FunctionDeclaration(name="show_notice"), types.FunctionDeclaration(name="compare_suppliers")]
        req = LlmRequest(config=types.GenerateContentConfig(tools=[types.Tool(function_declarations=decls)]))
        req.tools_dict.update({"show_notice": object(), "compare_suppliers": object()})
        return req

    def offered(req):
        return [d.name for t in req.config.tools for d in t.function_declarations], sorted(req.tools_dict)

    def ctx(text):
        return SimpleNamespace(user_content=types.Content(role="user", parts=[types.Part(text=text)]))

    req = request()
    hide_notice_unless_asked(ctx("Compare SUPP_00012 and SUPP_00450"), req)
    assert offered(req) == (["compare_suppliers"], ["compare_suppliers"])
    req = request()
    hide_notice_unless_asked(ctx("Show a notice saying hello"), req)
    assert offered(req) == (["show_notice", "compare_suppliers"], ["compare_suppliers", "show_notice"])


def test_clear_cue_words_decide():
    req = "Which of SUPP_00012, SUPP_00450 and SUPP_00731 is least likely to go bankrupt?"
    # Model listed both financial metrics: "bankrupt" settles it, no question.
    r = compare_suppliers(request=req, intent="compare", direction="safest",
                          mentions=[{"phrase": "go bankrupt", "metrics": ["Financial_Health_Score", "Credit_Rating_Score"]}])
    assert r["status"] == "ok" and r["card"]["sort"]["field"] == "Financial_Health_Score"
    # Model gave no metric at all (seen live: shortlist on total risk): the cue fills it in.
    r = compare_suppliers(request=req, intent="choose", direction="safest", mentions=[])
    assert r["status"] == "ok" and r["card"]["template"] == "financial_credit_card"
    # No cue word: a broad phrase still asks the buyer.
    r = compare_suppliers(request="Compare the financial risk of SUPP_00012 and SUPP_00450", intent="compare",
                          direction="safest", mentions=[{"phrase": "financial risk",
                                                         "metrics": ["Financial_Health_Score", "Credit_Rating_Score"]}])
    assert r["status"] == "needs_clarification"


def test_model_sees_results_without_the_card():
    from google.adk.models.llm_request import LlmRequest
    from google.genai import types

    from buddy.cards.tool import slim_card_results

    full = compare_suppliers(request="Compare SUPP_00012 and SUPP_00450 on total risk", intent="compare", direction="safest",
                             mentions=[{"phrase": "total risk", "metrics": ["Total_Risk_Index"]}])
    stored = types.Content(role="user", parts=[types.Part(function_response=types.FunctionResponse(
        id="c1", name="compare_suppliers", response=full))])
    req = LlmRequest(contents=[types.Content(role="user", parts=[types.Part(text="hi")]), stored])
    slim_card_results(None, req)
    sent = req.contents[1].parts[0].function_response.response
    assert sent == {"status": "ok", "summary": full["summary"]}
    assert "card" in stored.parts[0].function_response.response  # the stored session keeps the card

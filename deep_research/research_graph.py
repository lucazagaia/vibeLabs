"""Fixed-node supplier research graph.

Same stages as agent/src/graph.ts: orchestrate, plan, four research lanes,
up to three red-flag dives, synthesize, and one follow-up turn.
Orchestrator model plans and writes. Worker model extracts lane findings.
Search goes through LangChain Tavily.
"""

from __future__ import annotations

import json
import operator
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Annotated

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import interrupt
from typing_extensions import TypedDict

from models import build_model
from red_flags import (
    downgrade_resolved_finding,
    looks_resolved,
    rank_red_flags,
    replace_finding,
)
from search import (
    SearchBudgetError,
    allowlisted_urls,
    create_search_budget,
    lane_search_mode,
    tavily_search,
    to_sources,
    build_search_tool,
)

LANE_TITLES = {
    "financial": "Financial health & credit",
    "esg": "ESG, governance & labor",
    "compliance": "Compliance, safety, quality & digital security",
    "news": "News, market sentiment & geopolitical",
}
ALL_LANES = ("financial", "esg", "compliance", "news")
LANE_FOCUS = {
    "financial": (
        "Financial health, liquidity, bankruptcy risk, creditworthiness, "
        "and current annual report or credit opinions."
    ),
    "esg": (
        "ESG performance, governance, ethics, labor stability, strikes, "
        "and current ESG or sustainability reports."
    ),
    "compliance": (
        "Lawsuits, regulatory fines, safety incidents, product recalls, "
        "quality failures, and digital security breaches."
    ),
    "news": (
        "News, media and market sentiment, and geopolitical or political "
        "exposure within the last 12 months."
    ),
}
SEVERITIES = {"low", "moderate", "high", "unknown"}
FOLLOW_UP_SEARCH = re.compile(
    r"source|url|latest|news|update|confirm|more|detail|when|lawsuit|recall|breach",
    re.IGNORECASE,
)


def _merge_dicts(left: dict | None, right: dict | None) -> dict:
    merged = dict(left or {})
    merged.update(right or {})
    return merged


class ResearchState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    company: str
    phase: str
    clarifiers: list
    clarifierAnswers: Annotated[dict, _merge_dicts]
    plan: list
    activity: Annotated[list, operator.add]
    findings: list
    sources: list
    report: dict | None
    followUpBudgetRemaining: int
    searchBudget: dict
    error: str | None
    researched: bool
    headless: bool


def initial_state(question: str, *, headless: bool = False) -> ResearchState:
    return {
        "messages": [HumanMessage(content=question)],
        "company": "",
        "phase": "idle",
        "clarifiers": [],
        "clarifierAnswers": {},
        "plan": [],
        "activity": [],
        "findings": [],
        "sources": [],
        "report": None,
        "followUpBudgetRemaining": 1,
        "searchBudget": create_search_budget(1),
        "error": None,
        "researched": False,
        "headless": headless,
    }


def uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def message_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                parts.append(str(part["text"]))
        return "".join(parts)
    return ""


def parse_json_object(raw: str) -> dict | None:
    trimmed = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", trimmed, re.IGNORECASE)
    candidate = fence.group(1).strip() if fence else trimmed
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        parsed = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def activity(
    *,
    kind: str,
    label: str,
    lane: str | None = None,
    detail: str | None = None,
    status: str = "running",
) -> dict[str, Any]:
    step: dict[str, Any] = {
        "id": uid("act"),
        "kind": kind,
        "label": label,
        "status": status,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    if lane:
        step["lane"] = lane
    if detail:
        step["detail"] = detail
    return step


def _clean_company(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip().strip("\"'")).strip()


def extract_company_name(text: str) -> str:
    trimmed = text.strip()
    patterns = (
        r"research\s+(.+?)(?:\s+and\b|\s+for\b|\.|$)",
        r"company\s*(?:named|:)?\s*[\"']?([A-Za-z0-9][\w .,&'-]{1,80})",
        r"look\s+(?:into|up)\s+(.+?)(?:\.|$)",
    )
    for pattern in patterns:
        match = re.search(pattern, trimmed, re.IGNORECASE)
        if match and match.group(1):
            return _clean_company(match.group(1))
    if trimmed and len(trimmed) < 80 and "?" not in trimmed:
        return _clean_company(trimmed)
    return ""


def _is_human(message: Any) -> bool:
    if isinstance(message, HumanMessage):
        return True
    if isinstance(message, dict):
        return message.get("role") in ("user", "human") or message.get("type") in (
            "human",
            "user",
        )
    return getattr(message, "type", None) == "human"


def _message_content(message: Any) -> Any:
    if isinstance(message, dict):
        return message.get("content", "")
    return getattr(message, "content", "")


def last_human_text(state: ResearchState) -> str:
    for message in reversed(state.get("messages") or []):
        if _is_human(message):
            return message_text(_message_content(message))
    return ""


def merge_sources(
    existing: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen = {source.get("url") for source in existing}
    merged = list(existing)
    for source in incoming:
        if source.get("url") not in seen:
            seen.add(source.get("url"))
            merged.append(source)
    return merged


def _normalize_clarifiers(raw: list | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    clarifiers: list[dict[str, Any]] = []
    for index, question in enumerate(raw[:3]):
        if not isinstance(question, dict):
            continue
        options = []
        for option_index, option in enumerate((question.get("options") or [])[:3]):
            if not isinstance(option, dict):
                continue
            options.append(
                {
                    "id": option.get("id") or f"opt-{index}-{option_index}",
                    "label": option.get("label") or f"Option {option_index + 1}",
                }
            )
        while len(options) < 3:
            options.append({"id": f"opt-{index}-{len(options)}", "label": "No preference"})
        clarifiers.append(
            {
                "id": question.get("id") or f"q-{index + 1}",
                "question": question.get("question") or f"Clarifying question {index + 1}",
                "options": options,
            }
        )
    return clarifiers


def default_plan(company: str) -> list[dict[str, str]]:
    return [
        {
            "id": uid("plan"),
            "lane": "orchestrator",
            "title": "Orchestrator",
            "detail": f"Coordinate research for {company} and rank red flags.",
        },
        {
            "id": uid("plan"),
            "lane": "financial",
            "title": "Financial health & credit",
            "detail": "Annual report, liquidity, credit opinions.",
        },
        {
            "id": uid("plan"),
            "lane": "esg",
            "title": "ESG, governance & labor",
            "detail": "ESG report, governance, labor stability.",
        },
        {
            "id": uid("plan"),
            "lane": "compliance",
            "title": "Compliance, safety, quality & digital security",
            "detail": "Lawsuits, fines, safety, recalls, breaches.",
        },
        {
            "id": uid("plan"),
            "lane": "news",
            "title": "News & geopolitical (12 months)",
            "detail": "Recent news, sentiment, geopolitical exposure.",
        },
        {
            "id": uid("plan"),
            "lane": "red_flag",
            "title": "Red-flag deep dives",
            "detail": "Up to three concrete unresolved events.",
        },
        {
            "id": uid("plan"),
            "lane": "synthesize",
            "title": "Risk report",
            "detail": "Cited summary with lane sections.",
        },
    ]


def _severity(value: Any) -> str:
    return value if value in SEVERITIES else "unknown"


class ResearchRuntime:
    def __init__(
        self,
        orchestrator: Any | None = None,
        worker: Any | None = None,
        search_factory: Any | None = None,
    ) -> None:
        self._orchestrator = orchestrator
        self._worker = worker
        self._search_factory = search_factory
        self.graph = self._compile()

    def orchestrator_model(self) -> Any:
        if self._orchestrator is not None:
            return self._orchestrator
        return build_model("orchestrator")

    def worker_model(self) -> Any:
        if self._worker is not None:
            return self._worker
        return build_model("worker")

    def search_tool(self, mode: str) -> Any:
        if self._search_factory is not None:
            return self._search_factory(mode)
        return build_search_tool("news" if mode == "news" else "filing")

    def orchestrate(self, state: ResearchState) -> dict[str, Any]:
        if state.get("researched") and state.get("report"):
            return {"phase": "follow_up"}

        human = last_human_text(state)
        heuristic = state.get("company") or extract_company_name(human)
        decision = {
            "company": heuristic,
            "needsClarifiers": not bool(heuristic),
            "clarifiers": [],
            "reason": "heuristic",
        }
        try:
            response = self.orchestrator_model().invoke(
                [
                    {"role": "system", "content": "Return strict JSON only."},
                    {
                        "role": "user",
                        "content": (
                            "You are the orchestrator for a supplier risk deep-research agent.\n"
                            "Decide whether the buyer's brief is clear enough to research ONE real public company.\n\n"
                            f'Buyer message:\n"""{human}"""\n\n'
                            f'Current company guess: "{heuristic}"\n\n'
                            "Rules:\n"
                            "- If a real company is clearly named, needsClarifiers=false and clarifiers=[].\n"
                            "- If the brief is ambiguous (missing company, region, risk focus, or buyer use-case), "
                            "set needsClarifiers=true and invent 1-3 clarifier questions.\n"
                            "- Each clarifier MUST have exactly 3 short selectable answer options.\n"
                            "- Never invent scores. Research happens later.\n\n"
                            "Return ONLY JSON:\n"
                            '{"company":"string","needsClarifiers":false,"clarifiers":[],"reason":"short"}'
                        ),
                    },
                ]
            )
            parsed = parse_json_object(message_text(_message_content(response)))
            if parsed:
                decision = {
                    "company": parsed.get("company") or heuristic,
                    "needsClarifiers": bool(parsed.get("needsClarifiers"))
                    and not state.get("clarifiers"),
                    "clarifiers": _normalize_clarifiers(parsed.get("clarifiers")),
                    "reason": parsed.get("reason") or "model",
                }
        except Exception:
            pass

        if not decision["company"]:
            return {
                "phase": "clarify",
                "activity": [
                    activity(
                        kind="clarify",
                        lane="orchestrator",
                        label="Need a company name",
                        detail="Ask the buyer to name one real public company.",
                        status="done",
                    )
                ],
                "messages": [
                    AIMessage(
                        "Name one real public company to research (for example: Knorr-Bremse)."
                    )
                ],
            }

        answers = dict(state.get("clarifierAnswers") or {})
        clarifiers = decision["clarifiers"] if decision["needsClarifiers"] else []
        if answers:
            clarifiers = []

        if clarifiers and not state.get("headless"):
            for question in clarifiers:
                if answers.get(question["id"]):
                    continue
                picked = interrupt(
                    {
                        "type": "clarifier",
                        "questionId": question["id"],
                        "question": question["question"],
                        "options": question["options"],
                    }
                )
                option_id = picked if isinstance(picked, str) else ""
                if isinstance(picked, dict):
                    option_id = picked.get("optionId") or picked.get("label") or ""
                match = next(
                    (
                        option
                        for option in question["options"]
                        if option["id"] == option_id or option["label"] == option_id
                    ),
                    None,
                )
                answers[question["id"]] = (
                    (match or {}).get("label") or option_id or question["options"][0]["label"]
                )
            return {
                "company": decision["company"],
                "phase": "plan",
                "clarifiers": clarifiers,
                "clarifierAnswers": answers,
                "activity": [
                    activity(
                        kind="clarify",
                        lane="orchestrator",
                        label="Clarifiers answered",
                        detail="; ".join(f"{key}: {value}" for key, value in answers.items()),
                        status="done",
                    )
                ],
            }

        return {
            "company": decision["company"],
            "phase": "plan",
            "clarifiers": [],
            "clarifierAnswers": answers,
            "activity": [
                activity(
                    kind="plan",
                    lane="orchestrator",
                    label=f"Research {decision['company']}",
                    detail=str(decision["reason"]),
                    status="done",
                )
            ],
        }

    def plan(self, state: ResearchState) -> dict[str, Any]:
        plan = default_plan(state.get("company") or "")
        lines = "\n".join(
            f"{index}. {step['title']} — {step['detail']}"
            for index, step in enumerate(plan, start=1)
        )
        return {
            "phase": "research",
            "plan": plan,
            "activity": [
                activity(
                    kind="plan",
                    lane="orchestrator",
                    label="Research plan ready",
                    detail=" → ".join(step["title"] for step in plan),
                    status="done",
                )
            ],
            "messages": [
                AIMessage(
                    f"Research plan for {state.get('company') or 'the company'}:\n"
                    f"{lines}\n\nStarting the four research lanes now."
                )
            ],
        }

    def _research_lane(
        self,
        company: str,
        lane: str,
        clarifier_answers: dict[str, str],
        budget: dict[str, Any],
    ) -> dict[str, list]:
        steps: list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []
        sources: list[dict[str, Any]] = []
        mode = lane_search_mode(lane)
        context = "; ".join(f"{key}: {value}" for key, value in clarifier_answers.items())
        query = f"{company} {LANE_FOCUS[lane]}"
        pivots = 0
        steps.append(
            activity(
                kind="search",
                lane=lane,
                label=f"Searching {LANE_TITLES[lane]}",
                detail=query,
                status="running",
            )
        )
        try:
            while int(budget["laneSearches"].get(lane, 0)) < 4:
                hits = tavily_search(
                    query=query,
                    mode=mode,
                    budget=budget,
                    budget_key=lane,
                    kind="lane",
                    search_tool=self.search_tool(mode),
                )
                sources.extend(to_sources(hits, lane))
                steps.append(
                    activity(
                        kind="search" if pivots == 0 else "pivot",
                        lane=lane,
                        label=(
                            f"Tavily returned {len(hits)} sources"
                            if pivots == 0
                            else f"Pivot search #{pivots}"
                        ),
                        detail=query,
                        status="done",
                    )
                )
                if not hits:
                    findings.append(
                        {
                            "id": uid("find"),
                            "lane": lane,
                            "claim": f"No usable public sources found for {LANE_TITLES[lane]}.",
                            "severity": "unknown",
                            "isRedFlag": False,
                            "eventName": None,
                            "resolved": False,
                            "sourceUrls": [],
                            "documentDate": None,
                        }
                    )
                    break

                evidence = "\n\n".join(
                    f"[{index}] {hit['title']}\nURL: {hit['url']}\n"
                    f"Date: {hit.get('publishedDate') or 'unknown'}\n{hit.get('content')}"
                    for index, hit in enumerate(hits, start=1)
                )
                response = self.worker_model().invoke(
                    [
                        {"role": "system", "content": "Return strict JSON only."},
                        {
                            "role": "user",
                            "content": (
                                f"You are the {lane} researcher for supplier risk.\n"
                                f"Company: {company}\n"
                                f"Lane focus: {LANE_FOCUS[lane]}\n"
                                f"Buyer clarifiers: {context or 'none'}\n"
                                f"Search mode: {mode} "
                                f"({'only cite sources from the last 12 months' if mode == 'news' else 'filings and current reports allowed; include documentDate'})\n\n"
                                "Evidence (you may ONLY cite URLs listed here):\n"
                                f"{evidence}\n\n"
                                "Return ONLY JSON with findings, nextQuery, done, and note.\n"
                                "No invented 0-100 scores. isRedFlag=true only for a concrete "
                                "unresolved event with eventName set. Prefer 1-3 findings."
                            ),
                        },
                    ]
                )
                parsed = parse_json_object(message_text(_message_content(response))) or {}
                allowed = [hit["url"] for hit in hits]
                steps.append(
                    activity(
                        kind="reason",
                        lane=lane,
                        label=parsed.get("note") or "Reasoning over sources",
                        status="done",
                    )
                )
                for item in parsed.get("findings") or []:
                    if not isinstance(item, dict) or not item.get("claim"):
                        continue
                    urls = allowlisted_urls(item.get("sourceUrls") or [], allowed)
                    findings.append(
                        {
                            "id": uid("find"),
                            "lane": lane,
                            "claim": item["claim"],
                            "severity": _severity(item.get("severity")),
                            "isRedFlag": bool(item.get("isRedFlag") and item.get("eventName")),
                            "eventName": item.get("eventName"),
                            "resolved": False,
                            "sourceUrls": urls,
                            "documentDate": item.get("documentDate"),
                        }
                    )
                if parsed.get("done") is not False or not parsed.get("nextQuery"):
                    break
                if int(budget["laneSearches"].get(lane, 0)) >= 4:
                    break
                pivots += 1
                query = str(parsed["nextQuery"])
        except Exception as err:
            message = err.args[0] if isinstance(err, SearchBudgetError) else str(err)
            steps.append(
                activity(
                    kind="reason",
                    lane=lane,
                    label=f"Lane stopped: {message}",
                    status="done",
                )
            )
            if not findings:
                findings.append(
                    {
                        "id": uid("find"),
                        "lane": lane,
                        "claim": f"Unable to complete {LANE_TITLES[lane]} research ({message}).",
                        "severity": "unknown",
                        "isRedFlag": False,
                        "eventName": None,
                        "resolved": False,
                        "sourceUrls": [],
                        "documentDate": None,
                    }
                )

        if not findings:
            findings.append(
                {
                    "id": uid("find"),
                    "lane": lane,
                    "claim": f"No cited findings for {LANE_TITLES[lane]}.",
                    "severity": "unknown",
                    "isRedFlag": False,
                    "eventName": None,
                    "resolved": False,
                    "sourceUrls": [],
                    "documentDate": None,
                }
            )
        return {"findings": findings, "sources": sources, "activity": steps}

    def research(self, state: ResearchState) -> dict[str, Any]:
        budget = state.get("searchBudget") or create_search_budget(
            int(state.get("followUpBudgetRemaining") or 1)
        )
        company = state.get("company") or ""
        answers = state.get("clarifierAnswers") or {}
        lane_results = [
            self._research_lane(company, lane, answers, budget) for lane in ALL_LANES
        ]
        findings = [finding for result in lane_results for finding in result["findings"]]
        sources = list(state.get("sources") or [])
        steps: list[dict[str, Any]] = []
        for result in lane_results:
            sources = merge_sources(sources, result["sources"])
            steps.extend(result["activity"])
        return {
            "phase": "red_flags",
            "findings": findings,
            "sources": sources,
            "searchBudget": budget,
            "activity": steps,
        }

    def red_flag_dives(self, state: ResearchState) -> dict[str, Any]:
        candidates = rank_red_flags(state.get("findings") or [])
        budget = state.get("searchBudget") or create_search_budget()
        findings = list(state.get("findings") or [])
        sources = list(state.get("sources") or [])
        steps: list[dict[str, Any]] = []
        if not candidates:
            steps.append(
                activity(
                    kind="red_flag",
                    lane="red_flag",
                    label="No concrete unresolved red flags",
                    detail="Skipping deep dives.",
                    status="skipped",
                )
            )
            return {
                "phase": "synthesize",
                "activity": steps,
                "findings": findings,
                "sources": sources,
            }

        for candidate in candidates:
            query = f"{state.get('company') or ''} {candidate.get('eventName')} resolution status latest"
            steps.append(
                activity(
                    kind="red_flag",
                    lane="red_flag",
                    label=f"Deep dive: {candidate.get('eventName')}",
                    detail=query,
                    status="running",
                )
            )
            try:
                hits = tavily_search(
                    query=query,
                    mode="news",
                    budget=budget,
                    budget_key="red_flag",
                    kind="red_flag",
                    search_tool=self.search_tool("news"),
                )
                sources = merge_sources(sources, to_sources(hits, "red_flag"))
                blob = "\n".join(f"{hit['title']} {hit.get('content')}" for hit in hits)
                urls = allowlisted_urls(
                    [hit["url"] for hit in hits],
                    [hit["url"] for hit in hits],
                )
                if hits and looks_resolved(blob):
                    findings = replace_finding(
                        findings,
                        downgrade_resolved_finding(candidate, urls),
                    )
                    steps.append(
                        activity(
                            kind="red_flag",
                            lane="red_flag",
                            label=f"Resolved: {candidate.get('eventName')}",
                            detail="Severity downgraded after follow-up sources.",
                            status="done",
                        )
                    )
                else:
                    merged_urls = list(
                        dict.fromkeys([*(candidate.get("sourceUrls") or []), *urls])
                    )
                    findings = replace_finding(
                        findings,
                        {**candidate, "sourceUrls": merged_urls},
                    )
                    steps.append(
                        activity(
                            kind="red_flag",
                            lane="red_flag",
                            label=f"Still open: {candidate.get('eventName')}",
                            detail=(
                                "No recent sources found."
                                if not hits
                                else "Sources do not show a clear resolution."
                            ),
                            status="done",
                        )
                    )
            except Exception as err:
                steps.append(
                    activity(
                        kind="red_flag",
                        lane="red_flag",
                        label=f"Deep dive failed: {candidate.get('eventName')}",
                        detail=str(err),
                        status="done",
                    )
                )
        return {
            "phase": "synthesize",
            "findings": findings,
            "sources": sources,
            "searchBudget": budget,
            "activity": steps,
        }

    def synthesize(self, state: ResearchState) -> dict[str, Any]:
        open_flags = rank_red_flags(state.get("findings") or [])
        red_flag_summary = (
            "No concrete unresolved red flags were confirmed after research."
            if not open_flags
            else "Open red flags: "
            + "; ".join(str(flag.get("eventName")) for flag in open_flags)
            + "."
        )
        sections = []
        for lane in ALL_LANES:
            lane_findings = [
                finding
                for finding in (state.get("findings") or [])
                if finding.get("lane") == lane
            ]
            sections.append(
                {
                    "lane": lane,
                    "title": LANE_TITLES[lane],
                    "body": "\n".join(
                        f"• {finding.get('claim')} [{finding.get('severity')}]"
                        for finding in lane_findings
                    ),
                    "findingIds": [finding.get("id") for finding in lane_findings],
                }
            )
        company = state.get("company") or "The company"
        report: dict[str, Any] = {
            "summary": f"{company} public-source risk scan. {red_flag_summary}",
            "sections": sections,
            "redFlagSummary": red_flag_summary,
        }
        try:
            payload = {
                "company": company,
                "findings": state.get("findings") or [],
                "sources": [
                    {
                        "title": source.get("title"),
                        "url": source.get("url"),
                        "date": source.get("date"),
                        "lane": source.get("lane"),
                    }
                    for source in (state.get("sources") or [])
                ],
                "clarifierAnswers": state.get("clarifierAnswers") or {},
            }
            response = self.orchestrator_model().invoke(
                [
                    {"role": "system", "content": "Return strict JSON only."},
                    {
                        "role": "user",
                        "content": (
                            "Write a short cited supplier risk report from these findings.\n"
                            "Do NOT invent 0-100 scores. Only mention URLs that appear in findings/sources.\n"
                            'Return ONLY JSON: {"summary":"...","sections":[{"lane":"financial","title":"...","body":"...","findingIds":[]}],"redFlagSummary":"..."}\n\n'
                            f"Data:\n{json.dumps(payload)}"
                        ),
                    },
                ]
            )
            parsed = parse_json_object(message_text(_message_content(response)))
            if parsed and parsed.get("summary") and parsed.get("sections"):
                report = {
                    "summary": parsed["summary"],
                    "sections": parsed["sections"],
                    "redFlagSummary": parsed.get("redFlagSummary") or red_flag_summary,
                }
        except Exception:
            pass

        budget = state.get("searchBudget") or {}
        return {
            "phase": "done",
            "researched": True,
            "report": report,
            "followUpBudgetRemaining": budget.get("followUpRemaining", 1),
            "activity": [
                activity(
                    kind="synthesize",
                    lane="orchestrator",
                    label="Risk report ready",
                    detail=report["redFlagSummary"],
                    status="done",
                )
            ],
            "messages": [
                AIMessage(
                    f"## Risk report — {company}\n\n{report['summary']}\n\n"
                    f"### Red flags\n{report['redFlagSummary']}\n\n"
                    "Ask a follow-up about this report, or start a new thread for a different company."
                )
            ],
        }

    def follow_up(self, state: ResearchState) -> dict[str, Any]:
        question = last_human_text(state)
        budget = state.get("searchBudget") or create_search_budget(0)
        sources = list(state.get("sources") or [])
        steps: list[dict[str, Any]] = []
        extra = ""
        needs_search = bool(FOLLOW_UP_SEARCH.search(question)) and int(
            budget.get("followUpRemaining") or 0
        ) > 0
        if needs_search:
            try:
                query = f"{state.get('company') or ''} {question}"
                steps.append(
                    activity(
                        kind="follow_up",
                        lane="orchestrator",
                        label="One follow-up search",
                        detail=query,
                        status="running",
                    )
                )
                hits = tavily_search(
                    query=query,
                    mode="news",
                    budget=budget,
                    budget_key="follow_up",
                    kind="follow_up",
                    search_tool=self.search_tool("news"),
                )
                sources = merge_sources(sources, to_sources(hits, "follow_up"))
                extra = "\n".join(
                    f"{hit['title']} ({hit['url']}): {hit.get('content')}" for hit in hits
                )
                steps.append(
                    activity(
                        kind="follow_up",
                        lane="orchestrator",
                        label=f"Follow-up search returned {len(hits)} sources",
                        status="done",
                    )
                )
            except Exception as err:
                label = (
                    "Follow-up search budget already used"
                    if isinstance(err, SearchBudgetError)
                    else f"Follow-up search failed: {err}"
                )
                steps.append(
                    activity(
                        kind="follow_up",
                        lane="orchestrator",
                        label=label,
                        status="done",
                    )
                )
        else:
            steps.append(
                activity(
                    kind="follow_up",
                    lane="orchestrator",
                    label="Answering from existing report",
                    detail="No extra search.",
                    status="done",
                )
            )

        answer = (
            "I can only answer from the current report for this company. "
            "Start a new thread to research a different company."
        )
        try:
            response = self.orchestrator_model().invoke(
                [
                    {"role": "system", "content": "Return strict JSON only."},
                    {
                        "role": "user",
                        "content": (
                            "Answer the buyer's follow-up using ONLY the existing report, findings, "
                            "sources, and optional extra evidence.\n"
                            "Do not restart research. Do not invent 0-100 scores. "
                            "Only cite URLs present in the data.\n"
                            "If they name a different company, tell them to start a new thread.\n\n"
                            f"Company: {state.get('company')}\nQuestion: {question}\n\n"
                            f"Report:\n{json.dumps(state.get('report'))}\n\n"
                            f"Extra evidence:\n{extra or 'none'}\n\n"
                            'Return ONLY JSON: {"answer":"markdown string"}'
                        ),
                    },
                ]
            )
            parsed = parse_json_object(message_text(_message_content(response)))
            if parsed and parsed.get("answer"):
                answer = str(parsed["answer"])
        except Exception:
            summary = (state.get("report") or {}).get("summary")
            if summary:
                answer = f"From the existing report on {state.get('company')}:\n\n{summary}"

        return {
            "phase": "done",
            "sources": sources,
            "searchBudget": budget,
            "followUpBudgetRemaining": budget.get("followUpRemaining", 0),
            "activity": steps,
            "messages": [AIMessage(answer)],
        }

    def _compile(self):
        workflow = StateGraph(ResearchState)
        workflow.add_node("orchestrate", self.orchestrate)
        workflow.add_node("build_plan", self.plan)
        workflow.add_node("research", self.research)
        workflow.add_node("red_flag_dives", self.red_flag_dives)
        workflow.add_node("synthesize", self.synthesize)
        workflow.add_node("follow_up", self.follow_up)
        workflow.add_edge(START, "orchestrate")
        workflow.add_conditional_edges(
            "orchestrate",
            route_after_orchestrate,
            {"build_plan": "build_plan", "follow_up": "follow_up", END: END},
        )
        workflow.add_edge("build_plan", "research")
        workflow.add_edge("research", "red_flag_dives")
        workflow.add_edge("red_flag_dives", "synthesize")
        workflow.add_edge("synthesize", END)
        workflow.add_edge("follow_up", END)
        # The LangGraph API server supplies persistence when this graph is served.
        return workflow.compile()


def route_after_orchestrate(state: ResearchState) -> str:
    phase = state.get("phase")
    if phase == "follow_up":
        return "follow_up"
    if phase in ("plan", "research"):
        return "build_plan"
    return END


runtime = ResearchRuntime()
graph = runtime.graph

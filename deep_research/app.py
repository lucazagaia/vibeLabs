"""CLI for the fixed-node supplier research graph.

The Next.js test UI talks to the same stages in agent/. This process runs
them with Nebius (orchestrator + worker) and LangChain Tavily.
"""

from __future__ import annotations

import sys
from typing import Any

from models import (
    DEFAULT_ORCHESTRATOR_MODEL,
    DEFAULT_WORKER_MODEL,
    build_model,
    require_env,
)
from research_graph import graph, initial_state
from search import build_search_tool

DEFAULT_QUESTION = (
    "Research Knorr-Bremse as a supplier risk target. Cover financial health "
    "and credit, ESG/governance/labor, compliance/safety/quality/digital "
    "security, and news/market sentiment/geopolitical exposure from the last "
    "12 months. Cite sources. Flag up to three concrete unresolved red-flag "
    "events. Do not invent 0-100 risk scores."
)

REPORT_PREFIX = "Deep research report:"


def extract_final_text(result: Any) -> str:
    if isinstance(result, dict) and "messages" in result:
        messages = result["messages"]
        if not messages:
            return ""
        last = messages[-1]
        content = getattr(last, "content", None)
        if content is None and isinstance(last, dict):
            content = last.get("content", "")
        if isinstance(content, list):
            parts: list[str] = []
            for part in content:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict) and "text" in part:
                    parts.append(str(part["text"]))
            return "".join(parts).strip()
        return str(content or "").strip()
    return str(result).strip()


def run_research(question: str, agent: Any | None = None) -> str:
    if agent is not None:
        result = agent.invoke(
            {"messages": [{"role": "user", "content": question}]}
        )
        return extract_final_text(result)
    result = graph.invoke(initial_state(question, headless=True))
    return extract_final_text(result)


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    question = args[0] if args else DEFAULT_QUESTION
    report = run_research(question)
    print(f"{REPORT_PREFIX} {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

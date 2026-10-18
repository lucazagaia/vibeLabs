"""Rank and resolve concrete red-flag findings."""

from __future__ import annotations

from typing import Any


def rank_red_flags(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = [
        finding
        for finding in findings
        if finding.get("isRedFlag")
        and finding.get("severity") == "high"
        and not finding.get("resolved")
        and str(finding.get("eventName") or "").strip()
    ]
    ranked.sort(key=lambda finding: len(finding.get("sourceUrls") or []), reverse=True)
    return ranked[:3]


def downgrade_resolved_finding(
    finding: dict[str, Any],
    resolution_urls: list[str],
) -> dict[str, Any]:
    urls: list[str] = []
    seen: set[str] = set()
    for url in [*(finding.get("sourceUrls") or []), *resolution_urls]:
        if url not in seen:
            seen.add(url)
            urls.append(url)
    severity = "moderate" if finding.get("severity") == "high" else finding.get("severity")
    return {
        **finding,
        "resolved": True,
        "severity": severity,
        "claim": (
            f"{finding.get('claim')} Follow-up sources indicate this event has been resolved."
        ),
        "sourceUrls": urls,
    }


def looks_resolved(text: str) -> bool:
    lowered = text.lower()
    positive = (
        "resolved",
        "settled",
        "dismissed",
        "closed the case",
        "no longer",
        "withdrawn",
        "acquitted",
        "cleared",
    )
    negative = (
        "unresolved",
        "ongoing",
        "pending",
        "still open",
        "continues",
        "under investigation",
    )
    if any(word in lowered for word in negative):
        return False
    return any(word in lowered for word in positive)


def replace_finding(
    findings: list[dict[str, Any]],
    updated: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        updated if finding.get("id") == updated.get("id") else finding
        for finding in findings
    ]

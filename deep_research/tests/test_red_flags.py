from red_flags import downgrade_resolved_finding, looks_resolved, rank_red_flags


def _finding(**overrides):
    base = {
        "id": "1",
        "lane": "compliance",
        "claim": "A concrete event",
        "severity": "high",
        "isRedFlag": True,
        "eventName": "Case X",
        "resolved": False,
        "sourceUrls": ["https://example.com/1"],
        "documentDate": None,
    }
    base.update(overrides)
    return base


def test_rank_keeps_three_high_unresolved_events() -> None:
    ranked = rank_red_flags(
        [
            _finding(id="1", eventName="Lawsuit A", sourceUrls=["a", "b"]),
            _finding(id="2", severity="moderate", eventName="Fine B"),
            _finding(id="3", isRedFlag=False, eventName="Noise"),
            _finding(id="4", eventName=None),
            _finding(id="5", eventName="Strike E", sourceUrls=["e"]),
            _finding(id="6", eventName="Breach F", sourceUrls=["f"]),
            _finding(id="7", eventName="Recall G", sourceUrls=["g"]),
        ]
    )
    assert [item["id"] for item in ranked] == ["1", "5", "6"]


def test_downgrade_marks_resolved() -> None:
    updated = downgrade_resolved_finding(
        _finding(),
        ["https://example.com/resolution"],
    )
    assert updated["resolved"] is True
    assert updated["severity"] == "moderate"
    assert "resolved" in updated["claim"]


def test_looks_resolved_rejects_ongoing_language() -> None:
    assert looks_resolved("The case was settled last year.") is True
    assert looks_resolved("The case was settled but remains ongoing.") is False

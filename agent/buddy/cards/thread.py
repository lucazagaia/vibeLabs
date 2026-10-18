"""What the conversation so far contains: the buyer's messages and the cards already shown.

Supplier IDs may come from any of these (never invented by the model): the buyer named them, or they were on
a card. Read from the ADK session, so it works for follow-ups like "compare these on all metrics".
"""


def _events(tool_context) -> list:
    session = getattr(tool_context, "session", None) if tool_context is not None else None
    return list(getattr(session, "events", None) or [])


def user_texts(tool_context) -> list[str]:
    """The buyer's messages in this thread, oldest first."""
    texts = []
    for e in _events(tool_context):
        parts = e.content.parts if e.content and e.content.parts else []
        text = "".join(p.text or "" for p in parts if not getattr(p, "thought", False))
        if e.author == "user" and text.strip():
            texts.append(text)
    return texts


def card_supplier_lists(tool_context) -> list[list[str]]:
    """Supplier IDs of every card shown in this thread (in card order), oldest first."""
    lists = []
    for e in _events(tool_context):
        for p in (e.content.parts if e.content and e.content.parts else []):
            fr = p.function_response
            if fr and fr.name == "compare_suppliers" and isinstance(fr.response, dict) and fr.response.get("status") == "ok":
                lists.append([s["supplierID"] for s in fr.response["card"]["suppliers"]])
    return lists

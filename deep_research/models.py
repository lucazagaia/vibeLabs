"""Nebius Token Factory chat models for the research graph."""

from __future__ import annotations

import os
from typing import Any, Literal

from langchain_nebius import ChatNebius

DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
DEFAULT_ORCHESTRATOR_MODEL = "nvidia/Nemotron-3.5-Super-VL"
DEFAULT_WORKER_MODEL = "nvidia/Nemotron-3_5-Lightning"

ModelRole = Literal["orchestrator", "worker"]


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def nebius_base_url() -> str:
    return (
        os.environ.get("NEBIUS_BASE_URL")
        or os.environ.get("NEBIUS_API_BASE")
        or DEFAULT_NEBIUS_BASE_URL
    ).strip()


def model_id_for(role: ModelRole) -> str:
    if role == "orchestrator":
        # NEBIUS_ORCHESTRATOR_MODEL wins; NEBIUS_MODEL is a legacy alias.
        return (
            os.environ.get("NEBIUS_ORCHESTRATOR_MODEL")
            or os.environ.get("NEBIUS_MODEL")
            or DEFAULT_ORCHESTRATOR_MODEL
        ).strip()
    return (os.environ.get("NEBIUS_WORKER_MODEL") or DEFAULT_WORKER_MODEL).strip()


def build_model(role: ModelRole = "orchestrator") -> Any:
    api_key = require_env("NEBIUS_API_KEY")
    base_url = nebius_base_url()
    os.environ.setdefault("NEBIUS_API_BASE", base_url)
    return ChatNebius(
        model=model_id_for(role),
        api_key=api_key,
        base_url=base_url,
    )

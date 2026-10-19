"""AG-UI server: Data Buddy at /data (contract C2). Research Buddy runs on LangGraph (`npm run dev`).

    cd agent && uv run uvicorn main:app --port 8000
"""

from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from fastapi import FastAPI
from google.adk.agents import LlmAgent
from google.adk.apps import App, ResumabilityConfig

from buddy.data_buddy.agent import build_data_buddy

app = FastAPI(title="vibeLabs Buddy agents")

AGENTS: list[str] = []


def serve(root_agent: LlmAgent, path: str) -> None:
    """Expose one ADK agent as an AG-UI endpoint at `path`."""
    adk_app = App(
        name=root_agent.name,
        root_agent=root_agent,
        # Frontend tools pause the run until the browser answers; resumability lets ADK pick up again.
        resumability_config=ResumabilityConfig(is_resumable=True),
    )
    agent = ADKAgent.from_app(
        adk_app,
        user_id="demo",  # single demo user for the hackathon
        session_timeout_seconds=3600,
        use_in_memory_services=True,
        use_thread_id_as_session_id=True,
    )
    add_adk_fastapi_endpoint(app, agent, path=path)
    AGENTS.append(root_agent.name)


serve(build_data_buddy(), "/data")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "agents": AGENTS}

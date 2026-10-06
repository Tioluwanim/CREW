import json

import httpx
import pytest

from app.config import get_settings
from app.extension.groq_agent import GroqAgent, unsupported_amounts
from app.extension.registry import NullAgent

GROUNDING = {"upfrontExposure": 133000, "gapDate": "2026-10-05", "expectedProfit": 190000, "profitMarginPct": 39.6,
             "depositPct": 40, "paymentWindow": {"expected": "2026-11-05"}, "projectId": "project-x", "recommendations": []}


def _agent(reply, status=200, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(json.loads(request.content))
            seen.append(request.headers)
        if isinstance(reply, Exception):
            raise reply
        return httpx.Response(status, json={"choices": [{"message": {"content": reply}}]})
    return GroqAgent(NullAgent(), transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    assert get_settings().groq_api_key == "test-key"


def test_grounded_reply_is_used_with_allowed_actions_only():
    out = _agent(json.dumps({"text": "Your upfront exposure is ₦133,000.", "actions": ["simulate_deposit", "delete_everything"]})) \
        .chat("u", "what's my gap?", "p", GROUNDING)
    assert out["agent"] == "groq" and out["grounded"] is True
    assert "₦133,000" in out["text"]
    assert [a["kind"] for a in out["actions"]] == ["simulate_deposit"]


def test_invented_amount_falls_back_to_the_deterministic_answer():
    out = _agent(json.dumps({"text": "You will make ₦999,999 profit.", "actions": []})).chat("u", "profit?", "p", GROUNDING)
    assert out["agent"] == "null" and out["fallbackReason"] == "ungrounded_amount"
    assert "999,999" not in out["text"] and "190,000" in out["text"]


@pytest.mark.parametrize("failure", [httpx.ConnectTimeout("slow"), "not json"])
def test_errors_and_bad_json_fall_back(failure):
    out = _agent(failure).chat("u", "profit?", "p", GROUNDING)
    assert out["agent"] == "null" and out["grounded"] is True


def test_rate_limit_falls_back():
    out = _agent("{}", status=429).chat("u", "profit?", "p", GROUNDING)
    assert out["agent"] == "null" and out["fallbackReason"] == "HTTPStatusError"


def test_no_project_means_no_model_call():
    seen = []
    out = _agent("{}", seen=seen).chat("u", "hi", None, {})
    assert seen == [] and out["agent"] == "null"


def test_request_is_json_mode_authenticated_and_sends_no_ids():
    seen = []
    _agent(json.dumps({"text": "ok", "actions": []}), seen=seen).chat("u", "hi", "p", GROUNDING)
    body, headers = seen
    assert body["response_format"] == {"type": "json_object"}
    assert headers["authorization"] == "Bearer test-key"
    assert "project-x" not in json.dumps(body)


def test_unsupported_amounts_helper():
    assert unsupported_amounts("₦133,000 and ₦5", GROUNDING) == [5]
    assert unsupported_amounts("no money here", GROUNDING) == []

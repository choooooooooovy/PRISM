from __future__ import annotations

from typing import Any

from tavily import TavilyClient

from app.core.config import get_settings


class TavilyService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = TavilyClient(api_key=self.settings.tavily_api_key) if self.settings.tavily_api_key else None

    def is_configured(self) -> bool:
        return bool(self.client)

    def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        if self.settings.llm_mock_mode:
            return []
        if not self.client:
            raise RuntimeError('TAVILY_API_KEY is required for dynamic retrieval in live mode.')

        result = self.client.search(
            query=query,
            max_results=min(max_results, self.settings.tavily_max_results),
            timeout=self.settings.tavily_timeout_sec,
        )
        rows = result.get('results', [])
        return [
            {
                'url': item.get('url'),
                'title': item.get('title'),
                'snippet': item.get('content') or item.get('snippet') or '',
            }
            for item in rows
        ]

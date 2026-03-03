from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = Field(default='PRISM API', alias='APP_NAME')
    app_env: str = Field(default='dev', alias='APP_ENV')
    app_debug: bool = Field(default=True, alias='APP_DEBUG')
    api_host: str = Field(default='0.0.0.0', alias='API_HOST')
    api_port: int = Field(default=8000, alias='API_PORT')
    cors_allow_origins: str = Field(
        default=(
            'http://localhost:3000,http://127.0.0.1:3000,'
            'http://localhost:3001,http://127.0.0.1:3001'
        ),
        alias='CORS_ALLOW_ORIGINS',
    )
    cors_allow_credentials: bool = Field(default=True, alias='CORS_ALLOW_CREDENTIALS')
    cors_allow_origin_regex: str = Field(
        default=r'https?://(localhost|127\.0\.0\.1)(:\d+)?$',
        alias='CORS_ALLOW_ORIGIN_REGEX',
    )
    purge_conversation_on_new_session: bool = Field(
        default=True,
        alias='PURGE_CONVERSATION_ON_NEW_SESSION',
    )

    database_url: str = Field(
        default='postgresql+asyncpg://postgres:postgres@localhost:5432/prism',
        alias='DATABASE_URL',
    )
    database_url_sync: str = Field(
        default='postgresql+psycopg://postgres:postgres@localhost:5432/prism',
        alias='DATABASE_URL_SYNC',
    )

    openai_api_key: str = Field(default='', alias='OPENAI_API_KEY')
    openai_model: str = Field(default='gpt-4o', alias='OPENAI_MODEL')
    openai_embedding_model: str = Field(
        default='text-embedding-3-small', alias='OPENAI_EMBEDDING_MODEL'
    )
    embedding_dimensions: int = Field(default=3072, alias='EMBEDDING_DIMENSIONS')

    tavily_api_key: str = Field(default='', alias='TAVILY_API_KEY')
    tavily_max_results: int = Field(default=3, alias='TAVILY_MAX_RESULTS')
    tavily_timeout_sec: float = Field(default=15.0, alias='TAVILY_TIMEOUT_SEC')

    rag_top_k: int = Field(default=6, alias='RAG_TOP_K')
    llm_mock_mode: bool = Field(default=False, alias='LLM_MOCK_MODE')
    openai_timeout_sec: float = Field(default=90.0, alias='OPENAI_TIMEOUT_SEC')
    storage_mode: str = Field(default='postgres', alias='STORAGE_MODE')
    storage_dir: str = Field(default='runtime', alias='STORAGE_DIR')

    @model_validator(mode='after')
    def validate_live_mode_requirements(self) -> 'Settings':
        if self.storage_mode not in {'postgres', 'file'}:
            raise ValueError('STORAGE_MODE must be one of: postgres, file')
        if not self.llm_mock_mode and not self.openai_api_key.strip():
            raise ValueError(
                'OPENAI_API_KEY is required when LLM_MOCK_MODE=false. '
                'Set OPENAI_API_KEY or enable mock mode.'
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

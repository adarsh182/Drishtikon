from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./policylens.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"

    evolution_improved_drop_pct: float = 40.0
    evolution_emerging_min_growth_pct: float = 100.0
    evolution_persistent_max_change_pct: float = 25.0
    evolution_worsened_min_growth_pct: float = 50.0

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

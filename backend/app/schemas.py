from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Title = Field(min_length=1, max_length=200)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Card(ApiModel):
    id: str
    title: str
    details: str


class Column(ApiModel):
    id: str
    title: str
    card_ids: list[str]


class Board(ApiModel):
    columns: list[Column]
    cards: dict[str, Card]


class ColumnUpdate(ApiModel):
    title: str = Title


class CardCreate(ApiModel):
    column_id: str
    title: str = Title
    details: str = Field(default="", max_length=5000)


class CardUpdate(ApiModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    details: str | None = Field(default=None, max_length=5000)


class CardMove(ApiModel):
    column_id: str
    position: int = Field(ge=0)

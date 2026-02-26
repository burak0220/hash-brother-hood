from pydantic import BaseModel, field_validator


class AlgorithmResponse(BaseModel):
    id: int
    name: str
    display_name: str
    unit: str
    description: str | None = None
    coins: str | None = None
    diff_suggested: int | None = None
    diff_min: int | None = None
    diff_max: int | None = None
    is_active: bool

    class Config:
        from_attributes = True


class AlgorithmCreate(BaseModel):
    display_name: str
    unit: str = "MH/s"

    @field_validator("display_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Algorithm name must be between 2 and 50 characters")
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        v = v.strip()
        allowed = ["TH/s", "GH/s", "MH/s", "KH/s", "H/s", "Sol/s", "G/s"]
        if v not in allowed:
            raise ValueError(f"Unit must be one of: {', '.join(allowed)}")
        return v

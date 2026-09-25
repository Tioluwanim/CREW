from datetime import date, datetime
from zoneinfo import ZoneInfo

LAGOS_TZ = ZoneInfo("Africa/Lagos")

def today_lagos() -> date:
    return datetime.now(LAGOS_TZ).date()

def days_between(start: date, end: date) -> int:
    return (end - start).days
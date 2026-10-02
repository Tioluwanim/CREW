from datetime import date, datetime
from zoneinfo import ZoneInfo

LAGOS_TZ = ZoneInfo("Africa/Lagos")

def today_lagos() -> date:
    return datetime.now(LAGOS_TZ).date()

def days_between(start: date, end: date) -> int:
    return (end - start).days

def project_future_date(start: date, days: int) -> date:
    """Calendar-date arithmetic (never timestamps) - see NTELLIGENCE_ENGINE.md section 2."""
    from datetime import timedelta
    return start + timedelta(days=days)

def naira_to_kobo(naira: int)-> int:
    return naira * 100

def kobo_to_naira(kobo: int)-> int:
    return kobo // 100

def points_for_percentage(percentage: float)-> int:
    return int(percentage * 100)

def calculate_cost_buffer(amount_kobo: int, rate_bp: int)-> int:
    return (amount_kobo * rate_bp)//10000

def calculate_margin_dp(profit_kobo: int, revenue_kobo: int)-> int:
    if revenue_kobo == 0:
        return 0
    return (profit_kobo * 10000)// revenue_kobo
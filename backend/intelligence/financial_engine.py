from intelligence.interfaces import ProjectDTO
import money

class FinancialEngine:
    @staticmethod
    def calculate_profit(project: ProjectDTO) -> tuple[int, int]:
        """
            Returns (profit_kobo, margin_bp).
            Takes a stateless DTO to avoid mutating global state.
        """
        revenue_kobo = money.naira_to_kobo(project.revenue)
        costs_kobo = sum(money.naira_to_kobo(c.amount) for c in project.costs)
        profit_kobo = revenue_kobo - costs_kobo
        margin_bp = money.calculate_margin_dp(profit_kobo, revenue_kobo)
        return profit_kobo, margin_bp
    @staticmethod
    def build_timeline(project: ProjectDTO, expected_payment_day: int) -> list[dict]:
        revenue_kobo = money.naira_to_kobo(project.revenue)
        deposit_basic_points = money.points_for_percentage(project.deposit_pct)
        deposit_kobo = (revenue_kobo * deposit_basic_points) // 10000
        remaining_kobo = revenue_kobo - deposit_kobo
        costs_by_day = {}
        for cost in project.costs:
            costs_by_day[cost.paid_on_day] = costs_by_day.get(cost.paid_on_day, 0) + money.naira_to_kobo(cost.amount)
        current_balance_kobo = 0
        timeline = []

        # Loop from 0 up to and including the expected_payment_day
        for day in range(expected_payment_day + 1):
            money_moved = False
            inflow_kobo = 0
            outflow_kobo = 0

            # 1. Check for Inflows (Money entering the bank)
            if day == 0:
                inflow_kobo += deposit_kobo
                money_moved = True

            if day == expected_payment_day:
                inflow_kobo += remaining_kobo
                money_moved = True

            # 2. Check for Outflows (Money leaving the bank)
            if day in costs_by_day:
                outflow_kobo += costs_by_day[day]
                money_moved = True

            # 3. Update Bank Balance & Record (Only if something actually happened)
            if money_moved:
                current_balance_kobo += inflow_kobo
                current_balance_kobo -= outflow_kobo

                timeline.append({
                    "day": day,
                    "balance": money.kobo_to_naira(current_balance_kobo),  # Convert back to Naira for API
                    "inflow": money.kobo_to_naira(inflow_kobo),
                    "outflow": money.kobo_to_naira(outflow_kobo)
                })

        return timeline

    @staticmethod
    def calculate_risk_metrics(timeline: list[dict]) -> dict:
        """
        Scans a generated cash flow timeline to find the upfront exposure
        and the exact day a cash gap occurs.
        """
        min_balance = 0
        gap_day = None

        for point in timeline:
            current_balance = point["balance"]

            # 1. Track the deepest hole (Upfront Exposure)
            if current_balance < min_balance:
                min_balance = current_balance

            # 2. Track the FIRST day the balance drops below zero (Cash Gap)
            if current_balance < 0 and gap_day is None:
                gap_day = point["day"]

        # Exposure is the absolute value of the lowest negative balance.
        # If min_balance never dropped below 0, exposure is 0.
        upfront_exposure = abs(min_balance) if min_balance < 0 else 0

        return {
            "upfront_exposure": upfront_exposure,
            "has_cash_gap": gap_day is not None,
            "cash_gap_day": gap_day,
            "cash_gap_amount": upfront_exposure  # The amount they are short is the same as the exposure
        }
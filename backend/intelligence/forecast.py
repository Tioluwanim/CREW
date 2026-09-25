from datetime import date
from intelligence.dates import project_future_date

class ForecastEngine:
    @staticmethod
    def predict_completion_timeline(
        expected_payment_date: date, 
        predicted_client_delay_days: float
    ) -> dict[str, date]:
        """
        Provides a 3-point timeline (Optimistic, Expected, Pessimistic)
        based on the Bayesian statistical prediction.
        """
        delay_int = int(round(predicted_client_delay_days))
        
        # Expected: The exact Bayesian prediction
        expected = project_future_date(expected_payment_date, delay_int)
        
        # Optimistic: If the client pays on the exact day agreed in the contract
        optimistic = expected_payment_date if delay_int > 0 else expected
        
        # Pessimistic: Adding a 50% variance buffer to the expected delay
        pessimistic_delay = int(delay_int * 1.5)
        pessimistic = project_future_date(expected_payment_date, pessimistic_delay)

        return {
            "optimistic": optimistic,
            "expected": expected,
            "pessimistic": pessimistic
        }
